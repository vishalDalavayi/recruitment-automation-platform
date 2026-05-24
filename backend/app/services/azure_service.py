"""
Azure Blob Storage Service
============================
Consolidated Azure operations with lazy initialization.
User delegation keys are cached to avoid per-URL Azure REST API calls.
"""

import re
import os
import time
import threading
from datetime import datetime, UTC, timedelta
from typing import Optional
from urllib.parse import urlparse, unquote
import mimetypes
from fastapi import HTTPException, UploadFile
from app.config import get_settings, logger

_blob_service_client = None

# Cached user delegation key — avoids Azure REST call per URL
_delegation_key_cache = {
    "key": None,
    "expiry": 0,
    "lock": threading.Lock(),
}
_DELEGATION_KEY_TTL = 6 * 3600  # Cache for 6 hours


def get_blob_service_client():
    """Lazy-initialize Azure Blob Service Client."""
    global _blob_service_client
    if _blob_service_client:
        return _blob_service_client

    settings = get_settings()
    if settings.azure_client_id and settings.azure_client_secret and settings.azure_tenant_id:
        from azure.identity import ClientSecretCredential
        from azure.storage.blob import BlobServiceClient

        cred = ClientSecretCredential(
            tenant_id=settings.azure_tenant_id,
            client_id=settings.azure_client_id,
            client_secret=settings.azure_client_secret,
        )
        account_url = f"https://{settings.azure_storage_account_name}.blob.core.windows.net"
        _blob_service_client = BlobServiceClient(account_url, credential=cred)
        return _blob_service_client

    if settings.azure_storage_connection_string:
        from azure.storage.blob import BlobServiceClient
        _blob_service_client = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
        return _blob_service_client

    raise HTTPException(
        status_code=500,
        detail="Azure Storage is not configured. Please add Service Principal credentials or AZURE_STORAGE_CONNECTION_STRING.",
    )


def get_blob_service_client_safe():
    """Returns client or None (no exception)."""
    try:
        return get_blob_service_client()
    except HTTPException:
        return None


def _get_cached_delegation_key(blob_service_client):
    """
    Get a cached user delegation key. Only calls Azure once per 6 hours.
    This is the KEY performance fix — without caching, every SAS URL
    generation triggers a blocking Azure REST API call (~1-2 seconds).
    For 20 candidates × 2 URLs each = 40 calls × 1.5s = 60 seconds.
    With caching: 1 call for the first request, then instant for 6 hours.
    """
    now = time.time()
    if _delegation_key_cache["key"] and now < _delegation_key_cache["expiry"]:
        return _delegation_key_cache["key"], _delegation_key_cache["key_expiry_time"]

    with _delegation_key_cache["lock"]:
        # Double-check after acquiring lock
        if _delegation_key_cache["key"] and now < _delegation_key_cache["expiry"]:
            return _delegation_key_cache["key"], _delegation_key_cache["key_expiry_time"]

        start_time = datetime.now(UTC)
        expiry_time = start_time + timedelta(days=6, hours=23)
        key = blob_service_client.get_user_delegation_key(
            key_start_time=start_time, key_expiry_time=expiry_time,
        )
        _delegation_key_cache["key"] = key
        _delegation_key_cache["key_expiry_time"] = expiry_time
        _delegation_key_cache["expiry"] = now + _DELEGATION_KEY_TTL
        logger.info("Azure user delegation key cached (valid for 6h)")
        return key, expiry_time


def build_blob_access_url(blob_service_client, blob_name: str) -> str:
    """Generate a SAS-signed URL for a blob. Uses cached delegation key."""
    settings = get_settings()
    # Robustness Fix: If a full URL is passed (common if storing SAS URLs in DB), extract just the blob name
    if blob_name and blob_name.startswith("http"):
        from urllib.parse import unquote, urlparse
        parsed = urlparse(blob_name)
        # Strip container prefix if present
        path = parsed.path.lstrip("/")
        container_prefix = f"{settings.azure_container_name}/"
        if path.startswith(container_prefix):
            blob_name = unquote(path[len(container_prefix):])
        else:
            blob_name = unquote(path)

    blob_client = blob_service_client.get_blob_client(
        container=settings.azure_container_name, blob=blob_name
    )
    # Ensure blob exists before generating SAS
    try:
        if not blob_client.exists():
            logger.error(f"Blob does not exist: {blob_name}")
            raise HTTPException(status_code=404, detail=f"Document '{os.path.basename(blob_name)}' not found in storage.")
    except Exception as e:
        if isinstance(e, HTTPException): raise
        logger.error(f"Error checking blob existence for {blob_name}: {e}")
        raise HTTPException(status_code=500, detail="Storage connection error")

    sas_token = None
    try:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas

        # FIX 3: Ensure correct MIME type for rendering
        content_type = guess_media_type(blob_name)
        filename = os.path.basename(blob_name)
        content_disposition = f'inline; filename="{filename}"'

        if settings.azure_client_id and settings.azure_client_secret and settings.azure_tenant_id:
            delegation_key, expiry_time = _get_cached_delegation_key(blob_service_client)
            sas_token = generate_blob_sas(
                account_name=settings.azure_storage_account_name,
                container_name=settings.azure_container_name,
                blob_name=blob_name,
                user_delegation_key=delegation_key,
                permission=BlobSasPermissions(read=True),
                expiry=expiry_time,
                content_type=content_type,
                content_disposition=content_disposition,
            )

        elif settings.azure_storage_connection_string:
            match = re.search(r"AccountKey=([^;]+)", settings.azure_storage_connection_string)
            if match:
                account_key = match.group(1)
                sas_token = generate_blob_sas(
                    account_name=settings.azure_storage_account_name,
                    container_name=settings.azure_container_name,
                    blob_name=blob_name,
                    account_key=account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.now(UTC) + timedelta(days=365),
                    content_type=content_type,
                    content_disposition=content_disposition,
                )
        
        # FIX 1 & 2: Fail loudly if SAS fails
        if not sas_token:
            logger.error(f"SAS generation failed for blob: {blob_name}")
            raise HTTPException(status_code=500, detail="Failed to generate secure access token.")

        ext = filename.split('.')[-1].lower() if '.' in filename else 'bin'
        return f"{blob_client.url}?{sas_token}&file_ext={ext}"
    except Exception as e:
        if isinstance(e, HTTPException): raise
        logger.error(f"SAS generation error for {blob_name}: {e}")
        raise HTTPException(status_code=500, detail="Azure storage authentication failed.")


async def upload_blob_file(blob_service_client, blob_name: str, upload_file: UploadFile) -> str:
    settings = get_settings()
    blob_client = blob_service_client.get_blob_client(
        container=settings.azure_container_name, blob=blob_name
    )
    contents = await upload_file.read()
    
    # Guess content type for Azure metadata
    content_type = guess_media_type(blob_name, upload_file.content_type)
    from azure.storage.blob import ContentSettings
    
    blob_client.upload_blob(
        contents, 
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type)
    )
    return blob_name


def keep_only_latest_blob(blob_service_client, prefix: str, latest_blob_name: str):
    settings = get_settings()
    container_client = blob_service_client.get_container_client(settings.azure_container_name)
    for blob in container_client.list_blobs(name_starts_with=prefix):
        if blob.name == latest_blob_name:
            continue
        try:
            container_client.delete_blob(blob.name, delete_snapshots="include")
        except TypeError:
            container_client.delete_blob(blob.name)


def delete_candidate_blobs(blob_service_client, unique_id: str):
    """Delete all Azure blobs for a candidate."""
    settings = get_settings()
    container_client = blob_service_client.get_container_client(settings.azure_container_name)
    prefixes = [
        f"{settings.azure_raw_resume_path}{unique_id}/",
        f"{settings.azure_confidential_documents_path}{unique_id}/",
        f"{settings.azure_formatted_resume_path}{unique_id}/",
    ]
    for prefix in prefixes:
        for blob in container_client.list_blobs(name_starts_with=prefix):
            try:
                container_client.delete_blob(blob.name, delete_snapshots="include")
            except TypeError:
                container_client.delete_blob(blob.name)
            except Exception as e:
                logger.warning(f"Failed to delete blob {blob.name}: {e}")


def get_blob_name_from_url(document_url: Optional[str]) -> Optional[str]:
    if not document_url:
        return None
    
    # If it's already a relative path (not starting with http), return as is
    if not document_url.startswith("http"):
        return document_url

    settings = get_settings()
    parsed = urlparse(document_url)
    
    # For local proxy URLs, we don't want to use this logic
    if "localhost" in parsed.netloc or "127.0.0.1" in parsed.netloc:
        return None

    blob_path = parsed.path.lstrip("/")
    container_prefix = f"{settings.azure_container_name}/"
    if blob_path.startswith(container_prefix):
        blob_path = blob_path[len(container_prefix):]
    return unquote(blob_path)


def guess_media_type(blob_name: str, existing_content_type: Optional[str] = None) -> str:
    """Guess media type from extension, with explicit overrides for Office docs."""
    lower_name = blob_name.lower()
    if lower_name.endswith(".pdf"):
        return "application/pdf"
    
    if existing_content_type and existing_content_type != "application/octet-stream":
        return existing_content_type

    overrides = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
    }
    for ext, mime in overrides.items():
        if lower_name.endswith(ext):
            return mime

    import mimetypes
    guessed, _ = mimetypes.guess_type(blob_name)
    return guessed or "application/octet-stream"


def get_document_blob_name(candidate, document_type: str) -> str:
    document_map = {
        "resume": candidate.raw_resume_path,
        "formatted_resume": candidate.formatted_resume_path,
        "passport": get_blob_name_from_url(candidate.passport_url),
        "work_authorization": get_blob_name_from_url(candidate.work_authorization_url),
        "id_proof": get_blob_name_from_url(candidate.id_proof_url),
    }
    if document_type not in document_map:
        raise HTTPException(status_code=400, detail="Unsupported document type.")
    blob_name = document_map[document_type]
    if not blob_name:
        raise HTTPException(status_code=404, detail=f"No {document_type.replace('_', ' ')} document found.")
    return blob_name


def download_blob(blob_service_client, blob_name: str) -> bytes:
    """Download a blob as bytes."""
    settings = get_settings()
    try:
        blob_client = blob_service_client.get_blob_client(
            container=settings.azure_container_name, blob=blob_name
        )
        return blob_client.download_blob().readall()
    except Exception as e:
        logger.error(f"Failed to download blob {blob_name}: {e}")
        raise HTTPException(status_code=404, detail="Could not retrieve the document from storage.")
