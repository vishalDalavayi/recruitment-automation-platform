import json
import os
from typing import Any, Optional

import httpx
from sqlalchemy.sql import text

from config import CANDIDATE_SCHEMA, DB_SCHEMA, logger
from database import Candidate, DBManager


MATCHER_SERVICE_URL = os.getenv("MATCHER_SERVICE_URL", "http://127.0.0.1:5051/match/jobs")
MATCH_JOB_LIMIT = int(os.getenv("MATCH_JOB_LIMIT", "20"))
MATCH_TOP_K = int(os.getenv("MATCH_TOP_K", "5"))
MATCH_VECTOR_TOP_N = int(os.getenv("MATCH_VECTOR_TOP_N", "100"))


def _assert_sql_identifier(value: str, label: str) -> str:
    source = str(value or "").strip()
    parts = source.split(".")
    if not parts or len(parts) > 2:
        raise ValueError(f"{label} must be a simple SQL identifier like table_name or schema.table_name.")
    for part in parts:
        if not part or not (part[0].isalpha() or part[0] == "_") or not all(
            ch.isalnum() or ch == "_" for ch in part
        ):
            raise ValueError(
                f"{label} must be a simple SQL identifier like table_name or schema.table_name."
            )
    return source


def _quote_identifier(value: str, label: str) -> str:
    return ".".join(f'"{part}"' for part in _assert_sql_identifier(value, label).split("."))


def _table_name(env_name: str, fallback: str) -> str:
    return _assert_sql_identifier(os.getenv(env_name, fallback), env_name)


MATCH_RESUMES_TABLE = _table_name("MATCH_RESUMES_TABLE", f"{CANDIDATE_SCHEMA}.candidate_match_resumes")
MATCH_JOBS_TABLE = _table_name("MATCH_JOBS_TABLE", f"{CANDIDATE_SCHEMA}.candidate_match_jobs")
MATCH_RUNS_TABLE = _table_name("MATCH_RUNS_TABLE", f"{CANDIDATE_SCHEMA}.candidate_match_runs")
MATCH_RESULTS_TABLE = _table_name("MATCH_RESULTS_TABLE", f"{CANDIDATE_SCHEMA}.candidate_match_results")


def _pick_first(values: list[Any]) -> str:
    for value in values:
        text_value = str(value or "").strip()
        if text_value:
            return text_value
    return ""


def _to_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item or "").strip() for item in value if str(item or "").strip()]
    text_value = str(value or "").strip()
    return [text_value] if text_value else []


def _pick_from_object(source: Any, keys: list[str]) -> str:
    if not isinstance(source, dict):
        return ""
    return _pick_first([source.get(key) for key in keys])


def _append_section(lines: list[str], title: str, values: list[Any]) -> None:
    items: list[str] = []
    for value in values:
        items.extend(_to_string_list(value))
    if not items:
        return
    if lines:
        lines.append("")
    lines.append(f"{title}:")
    lines.extend(items)


def _render_experience_entry(experience: Any) -> list[str]:
    if not isinstance(experience, dict):
        return []

    lines: list[str] = []
    header = " - ".join(
        part for part in [
            _pick_from_object(experience, ["title", "your_title"]),
            _pick_from_object(experience, ["Company", "company", "employer"]),
        ] if part
    )
    detail = " | ".join(
        part for part in [
            _pick_from_object(experience, ["location", "Location"]),
            _pick_from_object(experience, ["dates_of_employment", "dates", "date_range"]),
        ] if part
    )
    heading = " | ".join(part for part in [header, detail] if part)
    if heading:
        lines.append(heading)

    project_description = _pick_from_object(experience, ["project_description", "description", "summary"])
    if project_description:
        lines.append(project_description)

    responsibilities = _to_string_list(
        experience.get("Responsibilities")
        or experience.get("responsibilities")
        or experience.get("project_responsibilities")
    )
    if responsibilities:
        lines.append("Responsibilities:")
        lines.extend(f"- {item}" for item in responsibilities)

    environment = _to_string_list(
        experience.get("Environment")
        or experience.get("environment")
        or experience.get("Technologies_used")
        or experience.get("technologies_used")
    )
    if environment:
        lines.append(f"Environment: {', '.join(environment)}")

    return [line for line in lines if line]


def _render_academic_entry(academic: Any) -> list[str]:
    if not isinstance(academic, dict):
        return []
    line = " - ".join(
        part for part in [
            _pick_from_object(academic, ["Degree", "degree"]),
            _pick_from_object(academic, ["Major", "major"]),
            _pick_from_object(academic, ["University", "university", "school"]),
        ] if part
    )
    return [line] if line else []


def _render_technical_skills(skills: Any) -> list[str]:
    if not isinstance(skills, dict):
        return []
    lines: list[str] = []
    for category, raw_values in skills.items():
        values = _to_string_list(raw_values)
        category_text = str(category or "").strip()
        if category_text and values:
            lines.append(f"{category_text}: {', '.join(values)}")
    return lines


def render_formatted_resume_content(content: Any) -> str:
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            return content.strip()
    if not isinstance(content, dict):
        return ""

    lines: list[str] = []
    candidate_name = _pick_from_object(content, ["Name", "name"])
    if candidate_name:
        lines.append(candidate_name)

    contact_line = " | ".join(
        part for part in [
            _pick_from_object(content, ["Phone", "phone"]),
            _pick_from_object(content, ["Email", "email"]),
        ] if part
    )
    if contact_line:
        lines.append(contact_line)

    _append_section(lines, "SUMMARY", [_pick_from_object(content, ["Summary", "summary"])])
    _append_section(
        lines,
        "ACADEMICS",
        [_render_academic_entry(item) for item in content.get("Academics", []) or content.get("academics", [])],
    )
    _append_section(
        lines,
        "TECHNICAL SKILLS",
        _render_technical_skills(content.get("Technical_Skills") or content.get("technical_skills")),
    )
    _append_section(
        lines,
        "PROFESSIONAL EXPERIENCE",
        [_render_experience_entry(item) for item in content.get("Professional_Experience", []) or content.get("professional_experience", [])],
    )
    _append_section(
        lines,
        "ACADEMIC PROJECTS",
        [_render_experience_entry(item) for item in content.get("Academic_projects", []) or content.get("academic_projects", [])],
    )
    _append_section(lines, "CERTIFICATIONS", _to_string_list(content.get("certifications") or content.get("Certifications")))

    return "\n".join(line for line in lines if line).strip()


def _clamp_positive_int(value: Any, fallback: int, minimum: int = 1, maximum: int = 500) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        numeric = fallback
    return max(minimum, min(maximum, numeric))


def _normalize_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _fetch_candidate_snapshot(unique_id: str) -> dict[str, Any]:
    dm = DBManager()
    try:
        candidate = (
            dm.session.query(Candidate)
            .filter(Candidate.unique_id == unique_id)
            .first()
        )
        if not candidate:
            raise LookupError("Candidate not found.")

        return {
            "unique_id": candidate.unique_id,
            "candidate_name": " ".join(part for part in [candidate.first_name, candidate.last_name] if part).strip(),
            "formatted_resume_status": candidate.formatted_resume_status,
            "formatted_resume_content": candidate.formatted_resume_content,
        }
    finally:
        dm.close()


def _fetch_jobs_for_matching(limit: int) -> list[dict[str, Any]]:
    dm = DBManager()
    try:
        rows = dm.session.execute(
            text(
                f"""
                select *
                from (
                    select
                        'active_scraped_data'::text as source_table,
                        serial_no,
                        url,
                        title,
                        company,
                        location,
                        salary,
                        posted_date,
                        job_type,
                        workplace_type,
                        description,
                        skills,
                        experience_required,
                        keyword,
                        scraped_at
                    from {DB_SCHEMA}.active_scraped_data
                    union all
                    select
                        'inactive_scraped_data'::text as source_table,
                        serial_no,
                        url,
                        title,
                        company,
                        location,
                        salary,
                        posted_date,
                        job_type,
                        workplace_type,
                        description,
                        skills,
                        experience_required,
                        keyword,
                        scraped_at
                    from {DB_SCHEMA}.inactive_scraped_data
                ) jobs
                order by scraped_at desc nulls last, serial_no desc
                limit :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()
        return [dict(row) for row in rows]
    finally:
        dm.close()


def _map_jobs_for_matcher(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped = []
    for row in rows:
        source_table = str(row.get("source_table") or "scraped_jobs")
        serial_no = row.get("serial_no")
        mapped.append(
            {
                "id": f"{source_table}:{serial_no}" if serial_no is not None else _pick_first([row.get("url"), row.get("title")]),
                "source_job_ref": str(serial_no) if serial_no is not None else "",
                "source_table": source_table,
                "source": source_table,
                "title": _pick_first([row.get("title")]),
                "company_name": _pick_first([row.get("company")]),
                "location": _pick_first([row.get("location")]),
                "url": _pick_first([row.get("url")]),
                "job_type": _pick_first([row.get("job_type"), row.get("workplace_type")]),
                "salary": _pick_first([row.get("salary")]),
                "publication_date": _pick_first([row.get("posted_date")]),
                "description_text": _pick_first([row.get("description")]),
            }
        )
    return mapped


async def run_candidate_matching(
    unique_id: str,
    *,
    job_limit: Optional[int] = None,
    top_k: Optional[int] = None,
    vector_top_n: Optional[int] = None,
    persist: bool = True,
) -> dict[str, Any]:
    candidate = _fetch_candidate_snapshot(unique_id)
    if candidate["formatted_resume_status"] != "completed":
        raise ValueError("Formatted resume is not ready yet for matching.")

    resume_text = render_formatted_resume_content(candidate["formatted_resume_content"])
    if not resume_text:
        raise ValueError("Formatted resume content is empty.")

    safe_job_limit = _clamp_positive_int(job_limit, MATCH_JOB_LIMIT, maximum=500)
    safe_top_k = _clamp_positive_int(top_k, MATCH_TOP_K, maximum=50)
    safe_vector_top_n = _clamp_positive_int(vector_top_n, max(MATCH_VECTOR_TOP_N, safe_top_k), minimum=safe_top_k, maximum=500)
    jobs = _map_jobs_for_matcher(_fetch_jobs_for_matching(safe_job_limit))

    payload = {
        "resumeId": unique_id,
        "candidateName": candidate["candidate_name"],
        "resumeVersion": "formatted_resume_content",
        "resumeText": resume_text,
        "jobs": jobs,
        "topK": safe_top_k,
        "vectorTopN": safe_vector_top_n,
        "persist": bool(persist),
    }

    logger.info(
        "Running matcher for candidate %s with %s jobs via %s",
        unique_id,
        len(jobs),
        MATCHER_SERVICE_URL,
    )

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(MATCHER_SERVICE_URL, json=payload)
        response.raise_for_status()
        matcher_response = response.json()

    return {
        "matcher_response": matcher_response,
        "stored_results": get_candidate_matches(unique_id, limit=safe_top_k),
    }


def get_candidate_matches(unique_id: str, *, limit: int = 5) -> dict[str, Any]:
    safe_limit = _clamp_positive_int(limit, MATCH_TOP_K, maximum=50)
    dm = DBManager()
    try:
        latest_run = dm.session.execute(
            text(
                f"""
                select
                    match_run_id::text as match_run_id,
                    resume_id::text as resume_id,
                    source_resume_ref,
                    matcher_version,
                    top_k,
                    created_at
                from {_quote_identifier(MATCH_RUNS_TABLE, 'MATCH_RUNS_TABLE')}
                where source_resume_ref = :unique_id
                order by created_at desc, match_run_id desc
                limit 1
                """
            ),
            {"unique_id": unique_id},
        ).mappings().first()

        if not latest_run:
            return {"match_run": None, "jobs": []}

        rows = dm.session.execute(
            text(
                f"""
                select
                    results.rank,
                    results.match_score,
                    results.ats_score,
                    results.eligible,
                    results.summary,
                    results.strengths_json,
                    results.gaps_json,
                    results.tailoring_hints_json,
                    results.breakdown_json,
                    jobs.job_id::text as job_id,
                    jobs.source_job_ref,
                    jobs.source_table,
                    jobs.source,
                    jobs.title,
                    jobs.company_name,
                    jobs.location,
                    jobs.url,
                    jobs.description_text,
                    jobs.normalized_jd_text
                from {_quote_identifier(MATCH_RESULTS_TABLE, 'MATCH_RESULTS_TABLE')} results
                join {_quote_identifier(MATCH_JOBS_TABLE, 'MATCH_JOBS_TABLE')} jobs
                  on jobs.job_id = results.job_id
                where results.match_run_id = cast(:match_run_id as uuid)
                order by results.rank asc
                limit :limit
                """
            ),
            {"match_run_id": latest_run["match_run_id"], "limit": safe_limit},
        ).mappings().all()

        jobs = []
        for row in rows:
            jobs.append(
                {
                    "rank": row["rank"],
                    "match_score": float(row["match_score"] or 0),
                    "ats_score": float(row["ats_score"] or 0),
                    "eligible": bool(row["eligible"]),
                    "summary": row["summary"] or "",
                    "strengths": _normalize_json(row["strengths_json"]) or [],
                    "gaps": _normalize_json(row["gaps_json"]) or [],
                    "tailoring_hints": _normalize_json(row["tailoring_hints_json"]) or [],
                    "breakdown": _normalize_json(row["breakdown_json"]) or {},
                    "job": {
                        "job_id": row["job_id"],
                        "source_job_ref": row["source_job_ref"],
                        "source_table": row["source_table"],
                        "source": row["source"],
                        "title": row["title"],
                        "company_name": row["company_name"],
                        "location": row["location"],
                        "url": row["url"],
                        "description_text": row["description_text"],
                        "normalized_jd_text": row["normalized_jd_text"],
                    },
                }
            )

        return {
            "match_run": {
                "match_run_id": latest_run["match_run_id"],
                "resume_id": latest_run["resume_id"],
                "source_resume_ref": latest_run["source_resume_ref"],
                "matcher_version": latest_run["matcher_version"],
                "top_k": latest_run["top_k"],
                "created_at": latest_run["created_at"].isoformat() if latest_run["created_at"] else None,
            },
            "jobs": jobs,
        }
    except Exception as exc:
        message = str(exc).lower()
        if "does not exist" in message or "undefinedtable" in message:
            return {"match_run": None, "jobs": []}
        raise
    finally:
        dm.close()
