import os
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from config import (
    logger,
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_CONTAINER_NAME,
    AZURE_RAW_RESUME_PATH,
    AZURE_FORMATTED_RESUME_PATH,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID,
    AZURE_STORAGE_ACCOUNT_NAME,
)
from database import DBManager, Candidate

from services.resume_formatter.config.settings import Settings as FormatterSettings
from services.resume_formatter.schemas.resume_schema import LLMAttemptInfo, LLMInfo, ResumeContent, ResumeContentUpdate
from services.resume_formatter.extraction.llm_provider_factory import BaseLLMProvider, get_fallback_llm_provider, get_llm_provider
from services.resume_formatter.extraction.llm_resume_extractor import build_resume_prompt, parse_resume_response
from services.resume_formatter.extraction.llm_types import LLMTokenUsage
from services.resume_formatter.extraction.prompt_templates import SYSTEM_PROMPT
from services.resume_formatter.generation.resume_docx_generator import ResumeDocxGenerator
from services.resume_formatter.ingestion.file_router import parse_resume_file
from services.resume_formatter.ingestion.text_normalizer import normalize_resume_text
from services.resume_formatter.validation.resume_required_fields_validator import (
    get_identity_mismatch_details,
    get_missing_required_field_details,
)


FORMATTER_STATUS_NOT_STARTED = "not_started"
FORMATTER_STATUS_PROCESSING = "processing"
FORMATTER_STATUS_NEEDS_INPUT = "needs_input"
FORMATTER_STATUS_COMPLETED = "completed"
FORMATTER_STATUS_FAILED = "failed"


@dataclass
class LLMAttemptResult:
    attempt_info: LLMAttemptInfo
    resume_content: ResumeContent


@dataclass
class LLMExtractionResult:
    selected_attempt: str
    attempts: list[LLMAttemptInfo]
    resume_content: ResumeContent


class LLMExtractionAttemptError(Exception):
    def __init__(
        self,
        attempt_info: LLMAttemptInfo,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(attempt_info.error_message or "LLM extraction attempt failed.")
        self.attempt_info = attempt_info
        self.original_error = original_error


class CandidateResumeFormatterService:
    def __init__(self) -> None:
        self.settings = FormatterSettings()
        self.settings.generated_resume_dir = (
            Path(tempfile.gettempdir()) / "konfigai-candidate-formatted-resumes"
        )
        self.primary_provider = get_llm_provider(self.settings)
        self.docx_generator = ResumeDocxGenerator(self.settings)

    def _invalidate_candidate_caches(self, unique_id: str) -> None:
        try:
            from app.cache.redis_client import cache

            cache.delete_pattern("candidates_v6:*")
        except Exception as cache_error:
            logger.warning(
                f"Failed to invalidate candidate caches for {unique_id}: {cache_error}"
            )

    def mark_candidate_processing(self, unique_id: str) -> None:
        dm = DBManager()
        try:
            dm.update_candidate(
                unique_id,
                {
                    "formatted_resume_status": FORMATTER_STATUS_PROCESSING,
                    "formatted_resume_path": None,
                    "formatted_resume_content": None,
                    "formatted_resume_missing_field_details": [],
                    "formatted_resume_llm_info": None,
                    "formatted_resume_error": None,
                    "formatted_resume_processed_at": datetime.utcnow(),
                },
            )
            self._invalidate_candidate_caches(unique_id)
        finally:
            dm.close()

    def process_candidate_resume(self, unique_id: str, raw_resume_path: str) -> None:
        dm = DBManager()
        try:
            candidate = (
                dm.session.query(Candidate)
                .filter(Candidate.unique_id == unique_id)
                .first()
            )
            if not candidate:
                raise LookupError(f"Candidate {unique_id} not found for resume formatting.")

            blob_service_client = self._get_blob_service_client()
            file_name = os.path.basename(raw_resume_path)
            file_bytes = self._download_blob_bytes(blob_service_client, raw_resume_path)
            self._delete_blobs_under_prefix(
                blob_service_client,
                f"{AZURE_FORMATTED_RESUME_PATH}{unique_id}/",
            )

            extraction_result = self._extract_resume_content(
                file_bytes=file_bytes,
                file_name=file_name,
            )
            extracted_resume_content = extraction_result.resume_content
            resume_content = self._populate_candidate_identity_fields(
                extracted_resume_content,
                candidate,
            )
            missing_field_details = get_missing_required_field_details(
                resume_content
            )
            missing_field_details.extend(
                get_identity_mismatch_details(
                    extracted_resume_content,
                    expected_name=self._build_candidate_full_name(candidate),
                    expected_phone=(candidate.contact or "").strip(),
                    expected_email=(candidate.email or "").strip(),
                )
            )

            update_payload = {
                "formatted_resume_content": resume_content.model_dump(
                    mode="json"
                ),
                "formatted_resume_llm_info": self._build_llm_info(
                    extraction_result
                ).model_dump(mode="json"),
                "formatted_resume_missing_field_details": [
                    detail.model_dump(mode="json") for detail in missing_field_details
                ],
                "formatted_resume_error": None,
                "formatted_resume_processed_at": datetime.utcnow(),
            }

            if missing_field_details:
                update_payload.update(
                    {
                        "formatted_resume_status": FORMATTER_STATUS_NEEDS_INPUT,
                        "formatted_resume_path": None,
                    }
                )
            else:
                formatted_blob_name, _ = self._generate_and_store_formatted_resume(
                    blob_service_client=blob_service_client,
                    unique_id=unique_id,
                    source_file_name=file_name,
                    resume_content=resume_content,
                )
                update_payload.update(
                    {
                        "formatted_resume_status": FORMATTER_STATUS_COMPLETED,
                        "formatted_resume_path": formatted_blob_name,
                    }
                )

            dm.update_candidate(unique_id, update_payload)
            self._invalidate_candidate_caches(unique_id)
        except Exception as exc:
            logger.error(
                f"Formatted resume generation failed for candidate {unique_id}: {exc}"
            )
            try:
                blob_service_client = self._get_blob_service_client()
                self._delete_blobs_under_prefix(
                    blob_service_client,
                    f"{AZURE_FORMATTED_RESUME_PATH}{unique_id}/",
                )
            except Exception as cleanup_error:
                logger.warning(
                    f"Failed to clean formatted resume artifacts for candidate {unique_id}: {cleanup_error}"
                )

            dm.update_candidate(
                unique_id,
                {
                    "formatted_resume_status": FORMATTER_STATUS_FAILED,
                    "formatted_resume_path": None,
                    "formatted_resume_missing_field_details": [],
                    "formatted_resume_error": str(exc),
                    "formatted_resume_processed_at": datetime.utcnow(),
                },
            )
            self._invalidate_candidate_caches(unique_id)
        finally:
            dm.close()

    def complete_candidate_resume(
        self, unique_id: str, updates_payload: dict
    ) -> dict:
        dm = DBManager()
        try:
            candidate = (
                dm.session.query(Candidate)
                .filter(Candidate.unique_id == unique_id)
                .first()
            )
            if not candidate:
                raise LookupError(f"Candidate {unique_id} not found.")

            if not candidate.formatted_resume_content:
                raise ValueError(
                    "There is no extracted resume content available for completion."
                )

            existing_resume_content = ResumeContent.model_validate(
                candidate.formatted_resume_content
            )
            updates = ResumeContentUpdate.model_validate(updates_payload)
            merged_resume_content = self._merge_resume_content(
                existing_resume_content, updates
            )
            missing_field_details = get_missing_required_field_details(
                merged_resume_content
            )

            update_payload = {
                "formatted_resume_content": merged_resume_content.model_dump(
                    mode="json"
                ),
                "formatted_resume_missing_field_details": [
                    detail.model_dump(mode="json") for detail in missing_field_details
                ],
                "formatted_resume_error": None,
                "formatted_resume_processed_at": datetime.utcnow(),
            }

            blob_service_client = self._get_blob_service_client()
            self._delete_blobs_under_prefix(
                blob_service_client,
                f"{AZURE_FORMATTED_RESUME_PATH}{unique_id}/",
            )

            if missing_field_details:
                update_payload.update(
                    {
                        "formatted_resume_status": FORMATTER_STATUS_NEEDS_INPUT,
                        "formatted_resume_path": None,
                    }
                )
            else:
                source_file_name = os.path.basename(candidate.raw_resume_path or "resume.docx")
                formatted_blob_name, _ = self._generate_and_store_formatted_resume(
                    blob_service_client=blob_service_client,
                    unique_id=unique_id,
                    source_file_name=source_file_name,
                    resume_content=merged_resume_content,
                )
                update_payload.update(
                    {
                        "formatted_resume_status": FORMATTER_STATUS_COMPLETED,
                        "formatted_resume_path": formatted_blob_name,
                    }
                )

            dm.update_candidate(unique_id, update_payload)
            self._invalidate_candidate_caches(unique_id)
            return update_payload
        finally:
            dm.close()

    def _extract_resume_content(
        self,
        *,
        file_bytes: bytes,
        file_name: str,
    ) -> LLMExtractionResult:
        _, raw_text = parse_resume_file(file_bytes, file_name)
        if not raw_text.strip():
            raise ValueError("No extractable text was found in the uploaded file.")

        normalized_text = normalize_resume_text(raw_text)
        user_prompt = build_resume_prompt(
            resume_text=normalized_text,
        )
        return self._extract_with_fallback(
            user_prompt=user_prompt,
        )

    def _extract_with_fallback(
        self,
        *,
        user_prompt: str,
    ) -> LLMExtractionResult:
        attempts: list[LLMAttemptInfo] = []
        primary_error: Exception | None = None

        try:
            result = self._run_llm_attempt(
                attempt_name="primary",
                provider=self.primary_provider,
                user_prompt=user_prompt,
            )
            attempts.append(result.attempt_info)
            return LLMExtractionResult(
                selected_attempt=result.attempt_info.attempt,
                attempts=attempts,
                resume_content=result.resume_content,
            )
        except Exception as exc:
            self._append_attempt_from_exception(attempts, exc)
            primary_error = exc

        fallback_provider = self._get_fallback_provider()
        if fallback_provider is None:
            raise primary_error or RuntimeError("Resume extraction failed.")

        try:
            result = self._run_llm_attempt(
                attempt_name="fallback",
                provider=fallback_provider,
                user_prompt=user_prompt,
            )
            attempts.append(result.attempt_info)
            return LLMExtractionResult(
                selected_attempt=result.attempt_info.attempt,
                attempts=attempts,
                resume_content=result.resume_content,
            )
        except Exception as fallback_error:
            self._append_attempt_from_exception(attempts, fallback_error)
            raise RuntimeError(
                "LLM extraction failed for both primary and fallback attempts. "
                f"Primary error: {primary_error}. Fallback error: {fallback_error}."
            ) from fallback_error

    def _run_llm_attempt(
        self,
        *,
        attempt_name: str,
        provider: BaseLLMProvider,
        user_prompt: str,
    ) -> LLMAttemptResult:
        attempt_info = LLMAttemptInfo(
            attempt=attempt_name,
            provider=provider.provider_name,
            model=provider.model,
            status="failed",
        )

        try:
            llm_completion = provider.complete(SYSTEM_PROMPT, user_prompt)
        except Exception as exc:
            attempt_info.error_type = "request_error"
            attempt_info.error_message = str(exc)
            raise RuntimeError(
                f"{attempt_name} LLM request failed for {provider.provider_name}/{provider.model}: {exc}"
            ) from LLMExtractionAttemptError(attempt_info, exc)

        llm_raw_response = llm_completion.content
        llm_usage = llm_completion.usage
        self._apply_usage_to_attempt(attempt_info, llm_usage)

        if not llm_raw_response.strip():
            attempt_info.error_type = "empty_response"
            attempt_info.error_message = "LLM response was empty."
            raise RuntimeError(
                f"{attempt_name} LLM response was empty for {provider.provider_name}/{provider.model}."
            ) from LLMExtractionAttemptError(attempt_info)

        try:
            _, resume_content = parse_resume_response(llm_raw_response)
        except Exception as exc:
            attempt_info.error_type = "parse_error"
            attempt_info.error_message = str(exc)
            raise RuntimeError(
                f"{attempt_name} LLM parsing failed for {provider.provider_name}/{provider.model}: {exc}"
            ) from LLMExtractionAttemptError(attempt_info, exc)

        attempt_info.status = "succeeded"
        attempt_info.error_type = ""
        attempt_info.error_message = ""

        return LLMAttemptResult(
            attempt_info=attempt_info,
            resume_content=resume_content,
        )

    def _build_llm_info(self, extraction_result: LLMExtractionResult) -> LLMInfo:
        return LLMInfo(
            selected_attempt=extraction_result.selected_attempt,
            total_input_tokens=sum(
                attempt.input_tokens for attempt in extraction_result.attempts
            ),
            total_output_tokens=sum(
                attempt.output_tokens for attempt in extraction_result.attempts
            ),
            total_tokens=sum(
                attempt.total_tokens for attempt in extraction_result.attempts
            ),
            attempts=extraction_result.attempts,
        )

    def _append_attempt_from_exception(
        self,
        attempts: list[LLMAttemptInfo],
        error: Exception,
    ) -> None:
        attempt_error = self._get_attempt_error(error)
        if attempt_error is None:
            return
        attempts.append(attempt_error.attempt_info)

    def _get_attempt_error(
        self, error: Exception
    ) -> LLMExtractionAttemptError | None:
        current_error: BaseException | None = error
        while current_error is not None:
            if isinstance(current_error, LLMExtractionAttemptError):
                return current_error
            current_error = current_error.__cause__
        return None

    def _apply_usage_to_attempt(
        self,
        attempt_info: LLMAttemptInfo,
        usage: LLMTokenUsage,
    ) -> None:
        attempt_info.input_tokens = usage.input_tokens
        attempt_info.output_tokens = usage.output_tokens
        attempt_info.total_tokens = usage.total_tokens

    def _get_fallback_provider(self) -> BaseLLMProvider | None:
        fallback_provider = get_fallback_llm_provider(self.settings)
        if fallback_provider is None:
            return None

        if (
            fallback_provider.provider_name == self.primary_provider.provider_name
            and fallback_provider.model == self.primary_provider.model
        ):
            return None

        return fallback_provider

    def _merge_resume_content(
        self,
        existing_resume_content: ResumeContent,
        updates: ResumeContentUpdate,
    ) -> ResumeContent:
        merged_content = existing_resume_content.model_dump(mode="python")
        update_payload = updates.model_dump(exclude_none=True, mode="python")
        merged_content.update(update_payload)
        return ResumeContent.model_validate(merged_content)

    def _populate_candidate_identity_fields(
        self,
        resume_content: ResumeContent,
        candidate: Candidate,
    ) -> ResumeContent:
        return resume_content.model_copy(
            update={
                "Name": self._build_candidate_full_name(candidate),
                "Phone": (candidate.contact or "").strip(),
                "Email": (candidate.email or "").strip(),
            }
        )

    def _build_candidate_full_name(self, candidate: Candidate) -> str:
        return " ".join(
            part.strip()
            for part in (candidate.first_name, candidate.last_name)
            if isinstance(part, str) and part.strip()
        ).strip()

    def _generate_and_store_formatted_resume(
        self,
        *,
        blob_service_client,
        unique_id: str,
        source_file_name: str,
        resume_content: ResumeContent,
    ) -> tuple[str, str]:
        artifact = self.docx_generator.generate(
            record_id=unique_id,
            source_file_name=source_file_name,
            resume_content=resume_content,
        )
        with open(artifact.file_path, "rb") as generated_file:
            generated_bytes = generated_file.read()

        formatted_blob_name = (
            f"{AZURE_FORMATTED_RESUME_PATH}{unique_id}/{artifact.file_name}"
        )
        self._upload_blob_bytes(
            blob_service_client=blob_service_client,
            blob_name=formatted_blob_name,
            file_bytes=generated_bytes,
        )
        self._keep_only_latest_blob_in_prefix(
            blob_service_client,
            f"{AZURE_FORMATTED_RESUME_PATH}{unique_id}/",
            formatted_blob_name,
        )

        try:
            os.remove(artifact.file_path)
        except OSError:
            pass

        return formatted_blob_name, artifact.file_name

    def _get_blob_service_client(self):
        if AZURE_CLIENT_ID and AZURE_CLIENT_SECRET and AZURE_TENANT_ID:
            from azure.identity import ClientSecretCredential
            from azure.storage.blob import BlobServiceClient

            credential = ClientSecretCredential(
                tenant_id=AZURE_TENANT_ID,
                client_id=AZURE_CLIENT_ID,
                client_secret=AZURE_CLIENT_SECRET,
            )
            account_url = (
                f"https://{AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
            )
            return BlobServiceClient(account_url, credential=credential)

        if AZURE_STORAGE_CONNECTION_STRING:
            from azure.storage.blob import BlobServiceClient

            return BlobServiceClient.from_connection_string(
                AZURE_STORAGE_CONNECTION_STRING
            )

        raise RuntimeError(
            "Azure Storage is not configured for formatted resume generation."
        )

    def _download_blob_bytes(self, blob_service_client, blob_name: str) -> bytes:
        blob_client = blob_service_client.get_blob_client(
            container=AZURE_CONTAINER_NAME,
            blob=blob_name,
        )
        return blob_client.download_blob().readall()

    def _upload_blob_bytes(
        self, *, blob_service_client, blob_name: str, file_bytes: bytes
    ) -> None:
        blob_client = blob_service_client.get_blob_client(
            container=AZURE_CONTAINER_NAME,
            blob=blob_name,
        )
        blob_client.upload_blob(file_bytes, overwrite=True)

    def _delete_blobs_under_prefix(self, blob_service_client, prefix: str) -> None:
        container_client = blob_service_client.get_container_client(
            AZURE_CONTAINER_NAME
        )
        for blob in container_client.list_blobs(name_starts_with=prefix):
            try:
                container_client.delete_blob(blob.name, delete_snapshots="include")
            except TypeError:
                container_client.delete_blob(blob.name)

    def _keep_only_latest_blob_in_prefix(
        self,
        blob_service_client,
        prefix: str,
        latest_blob_name: str,
    ) -> None:
        container_client = blob_service_client.get_container_client(
            AZURE_CONTAINER_NAME
        )
        for blob in container_client.list_blobs(name_starts_with=prefix):
            if blob.name == latest_blob_name:
                continue
            try:
                container_client.delete_blob(blob.name, delete_snapshots="include")
            except TypeError:
                container_client.delete_blob(blob.name)
