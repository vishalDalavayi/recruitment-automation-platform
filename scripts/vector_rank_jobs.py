from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from typing import Dict, List

import psycopg
from pgvector import Vector
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def parse_bool(value: object, default: bool = False) -> bool:
    source = str(value or "").strip().lower()
    if not source:
        return default
    return source in {"1", "true", "yes", "on"}


SKILL_LEXICON = [
    "python",
    "sql",
    "java",
    "javascript",
    "react",
    "fastapi",
    "django",
    "postgresql",
    "mongodb",
    "aws",
    "azure",
    "docker",
    "kubernetes",
    "machine learning",
    "deep learning",
    "nlp",
    "data analysis",
    "pandas",
    "numpy",
    "scikit-learn",
    "tensorflow",
    "pytorch",
    "tableau",
    "power bi",
    "excel",
    "communication",
    "leadership",
    "project management",
    "agile",
    "scrum",
    "rest api",
    "git",
    "linux",
    "statistics",
    "data visualization",
    "c++",
    "c#",
    "node",
    "typescript",
    "html",
    "css",
    "spark",
    "hadoop",
    "airflow",
    "selenium",
    "testing",
    "debugging",
    "ci/cd",
    "devops",
    "oracle",
    "sql server",
    "dba",
]


def normalize(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9#./\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def stable_text_hash(value: str) -> str:
    return hashlib.sha256(normalize(value).encode("utf-8")).hexdigest()


def extract_keywords(text: str) -> set:
    normalized = normalize(text)
    found = set()
    for skill in SKILL_LEXICON:
        pattern = rf"(?<!\w){re.escape(skill)}(?!\w)"
        if re.search(pattern, normalized):
            found.add(skill)
    return found


def tfidf_similarity(resume_text: str, jd_text: str) -> float:
    docs = [normalize(resume_text), normalize(jd_text)]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    try:
        matrix = vectorizer.fit_transform(docs)
        score = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
        return float(score)
    except Exception:
        return 0.0


def compute_partner_score(resume_text: str, job_description: str) -> Dict[str, object]:
    resume_keywords = extract_keywords(resume_text)
    jd_keywords = extract_keywords(job_description)

    matched = sorted(resume_keywords & jd_keywords)
    missing = sorted(jd_keywords - resume_keywords)

    keyword_score = (len(matched) / len(jd_keywords) * 100) if jd_keywords else 0.0
    tfidf_score = tfidf_similarity(resume_text, job_description) * 100
    final_score = (0.60 * keyword_score) + (0.40 * tfidf_score)

    return {
        "final_score": round(final_score, 2),
        "keyword_score": round(keyword_score, 2),
        "tfidf_score": round(tfidf_score, 2),
        "matched_keywords": matched,
        "missing_keywords": missing,
    }


def vector_dimension(model_name: str) -> int:
    if model_name == "all-MiniLM-L6-v2":
        return 384
    return 384


def assert_sql_identifier(value: str, label: str) -> str:
    source = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?", source):
        raise RuntimeError(f"{label} must be a simple SQL identifier like table_name or schema.table_name.")
    return source


def quote_sql_identifier(value: str, label: str = "SQL identifier") -> str:
    return ".".join(f'"{part}"' for part in assert_sql_identifier(value, label).split("."))


def split_identifier(value: str, label: str) -> tuple[str | None, str]:
    parts = assert_sql_identifier(value, label).split(".")
    if len(parts) == 2:
        return parts[0], parts[1]
    return None, parts[0]


def connect_pgvector(database_url: str):
    return psycopg.connect(database_url)


def load_embedding_model(model_name: str, allow_model_download: bool) -> SentenceTransformer:
    try:
        return SentenceTransformer(model_name, local_files_only=True)
    except Exception as local_exc:
        if not allow_model_download:
            raise RuntimeError(
                "Embedding model is not available in the local cache. Warm the model cache in HF_HOME "
                "or set MATCHER_ALLOW_MODEL_DOWNLOAD=true to allow a first-run download."
            ) from local_exc

        try:
            return SentenceTransformer(model_name, local_files_only=False)
        except Exception as remote_exc:
            raise RuntimeError(
                "Embedding model download failed. Verify outbound network access or pre-warm the model cache."
            ) from remote_exc


def ensure_pgvector_schema(conn, table_name: str, embedding_dim: int) -> None:
    schema_name, bare_table_name = split_identifier(table_name, "PGVECTOR_TABLE")
    quoted_table_name = quote_sql_identifier(table_name, "PGVECTOR_TABLE")
    index_prefix = f"{schema_name}_{bare_table_name}" if schema_name else bare_table_name
    try:
        with conn.cursor() as cur:
            if schema_name:
                cur.execute(f"create schema if not exists {quote_sql_identifier(schema_name, 'schema name')}")
            cur.execute("create extension if not exists vector")
            cur.execute(
                f"""
                create table if not exists {quoted_table_name} (
                  job_key text primary key,
                  title text,
                  company_name text,
                  location text,
                  url text,
                  source text,
                  job_type text,
                  salary text,
                  publication_date text,
                  job_description text not null,
                  job_text_hash text not null,
                  embedding_model text not null,
                  embedding vector({embedding_dim}) not null,
                  updated_at timestamptz not null default now()
                )
                """
            )
            cur.execute(
                f"create index if not exists {index_prefix}_model_idx on {quoted_table_name} (embedding_model)"
            )
            cur.execute(
                f"create index if not exists {index_prefix}_embedding_hnsw_idx on {quoted_table_name} using hnsw (embedding vector_cosine_ops)"
            )
        conn.commit()
        register_vector(conn)
    except Exception as exc:
        conn.rollback()
        raise RuntimeError(
            "pgvector setup failed. Make sure the Postgres server has the 'vector' extension installed."
        ) from exc


def hydrate_candidate_embeddings_pgvector(
    conn,
    table_name: str,
    model: SentenceTransformer,
    model_name: str,
    jobs: List[Dict[str, object]],
) -> None:
    quoted_table_name = quote_sql_identifier(table_name, "PGVECTOR_TABLE")
    lookup = {str(job["id"]): job for job in jobs}
    keys = list(lookup.keys())
    existing_by_key: Dict[str, str] = {}

    with conn.cursor() as cur:
        cur.execute(
            f"""
            select job_key, job_text_hash
            from {quoted_table_name}
            where embedding_model = %s and job_key = any(%s)
            """,
            [model_name, keys],
        )
        for job_key, job_text_hash in cur.fetchall():
            existing_by_key[str(job_key)] = str(job_text_hash)

    jobs_to_upsert = []
    for job in jobs:
        description = str(job.get("job_description") or "")
        description_hash = stable_text_hash(description)
        if existing_by_key.get(str(job["id"])) != description_hash:
            jobs_to_upsert.append((job, description_hash))

    if not jobs_to_upsert:
        return

    vectors = model.encode(
        [str(job.get("job_description") or "") for job, _hash in jobs_to_upsert],
        normalize_embeddings=True,
    ).tolist()

    with conn.cursor() as cur:
        cur.executemany(
            f"""
            insert into {quoted_table_name} (
              job_key,
              title,
              company_name,
              location,
              url,
              source,
              job_type,
              salary,
              publication_date,
              job_description,
              job_text_hash,
              embedding_model,
              embedding,
              updated_at
            )
            values (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now()
            )
            on conflict (job_key) do update
              set title = excluded.title,
                  company_name = excluded.company_name,
                  location = excluded.location,
                  url = excluded.url,
                  source = excluded.source,
                  job_type = excluded.job_type,
                  salary = excluded.salary,
                  publication_date = excluded.publication_date,
                  job_description = excluded.job_description,
                  job_text_hash = excluded.job_text_hash,
                  embedding_model = excluded.embedding_model,
                  embedding = excluded.embedding,
                  updated_at = now()
            """,
            [
                (
                    str(job["id"]),
                    str(job.get("title") or ""),
                    str(job.get("company_name") or ""),
                    str(job.get("location") or ""),
                    str(job.get("url") or ""),
                    str(job.get("source") or ""),
                    str(job.get("jobType") or ""),
                    str(job.get("salary") or ""),
                    str(job.get("publicationDate") or ""),
                    str(job.get("job_description") or ""),
                    description_hash,
                    model_name,
                    Vector(vector),
                )
                for (job, description_hash), vector in zip(jobs_to_upsert, vectors)
            ],
        )
    conn.commit()


def retrieve_with_pgvector(
    conn,
    table_name: str,
    model_name: str,
    resume_embedding: List[float],
    jobs: List[Dict[str, object]],
    vector_top_n: int,
) -> List[tuple[float, Dict[str, object]]]:
    quoted_table_name = quote_sql_identifier(table_name, "PGVECTOR_TABLE")
    lookup = {str(job["id"]): job for job in jobs}
    keys = list(lookup.keys())

    with conn.cursor() as cur:
        cur.execute(
            f"""
            select
              job_key,
              1 - (embedding <=> %s) as retrieval_similarity
            from {quoted_table_name}
            where embedding_model = %s and job_key = any(%s)
            order by embedding <=> %s
            limit %s
            """,
            [
                Vector(resume_embedding),
                model_name,
                keys,
                Vector(resume_embedding),
                int(min(vector_top_n, len(keys))),
            ],
        )
        rows = cur.fetchall()

    return [
        (float(retrieval_similarity), lookup[str(job_key)])
        for job_key, retrieval_similarity in rows
        if str(job_key) in lookup
    ]


def retrieve_in_memory(
    model: SentenceTransformer,
    resume_text: str,
    jobs: List[Dict[str, object]],
    vector_top_n: int,
) -> List[tuple[float, Dict[str, object]]]:
    if not jobs:
        return []

    documents = [str(job.get("job_description") or "") for job in jobs]
    job_vectors = model.encode(documents, normalize_embeddings=True).tolist()
    resume_embedding = model.encode([resume_text], normalize_embeddings=True)[0].tolist()

    retrieved = []
    for job, vector in zip(jobs, job_vectors):
        retrieval_similarity = float(sum(a * b for a, b in zip(resume_embedding, vector)))
        retrieved.append((retrieval_similarity, job))

    retrieved.sort(key=lambda item: item[0], reverse=True)
    return retrieved[: min(vector_top_n, len(retrieved))]


def rank_jobs(payload: Dict[str, object]) -> Dict[str, object]:
    resume_text = str(payload.get("resume_text") or "")
    jobs = list(payload.get("jobs") or [])
    top_k = max(1, int(payload.get("top_k") or 10))
    vector_top_n = max(top_k, int(payload.get("vector_top_n") or 50))
    database_url = str(
        payload.get("database_url")
        or os.environ.get("VECTOR_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or ""
    ).strip()
    table_name = str(payload.get("pgvector_table") or os.environ.get("PGVECTOR_TABLE") or "job_vector_embeddings")
    auto_setup = str(payload.get("pgvector_auto_setup") or os.environ.get("PGVECTOR_AUTO_SETUP") or "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    allow_model_download = parse_bool(
        payload.get("allow_model_download")
        or os.environ.get("MATCHER_ALLOW_MODEL_DOWNLOAD"),
        default=False,
    )

    filtered_jobs = []
    seen = set()
    for index, job in enumerate(jobs):
        job_id = str(job.get("id") or f"job-{index+1}")
        if job_id in seen:
            continue
        seen.add(job_id)
        filtered_jobs.append(
            {
                "id": job_id,
                "title": str(job.get("title") or ""),
                "company_name": str(job.get("company_name") or ""),
                "location": str(job.get("location") or ""),
                "url": str(job.get("url") or ""),
                "source": str(job.get("source") or ""),
                "jobType": str(job.get("jobType") or ""),
                "salary": str(job.get("salary") or ""),
                "publicationDate": str(job.get("publicationDate") or ""),
                "job_description": str(job.get("job_description") or ""),
            }
        )

    model_name = str(payload.get("embedding_model") or os.environ.get("EMBEDDING_MODEL") or "all-MiniLM-L6-v2")
    model = load_embedding_model(model_name, allow_model_download)
    retrieval_backend = "memory"
    shortlisted: List[tuple[float, Dict[str, object]]] = []

    if database_url:
        conn = connect_pgvector(database_url)
        try:
            if auto_setup:
                ensure_pgvector_schema(conn, table_name, vector_dimension(model_name))
            else:
                register_vector(conn)
            resume_embedding = model.encode([resume_text], normalize_embeddings=True)[0].tolist()
            hydrate_candidate_embeddings_pgvector(conn, table_name, model, model_name, filtered_jobs)
            shortlisted = retrieve_with_pgvector(
                conn,
                table_name,
                model_name,
                resume_embedding,
                filtered_jobs,
                vector_top_n,
            )
            retrieval_backend = "pgvector"
        finally:
            conn.close()
    else:
        shortlisted = retrieve_in_memory(model, resume_text, filtered_jobs, vector_top_n)

    ranked_jobs = []
    for retrieval_similarity, job in shortlisted:
        score = compute_partner_score(resume_text, str(job.get("job_description") or ""))
        ranked_jobs.append(
            {
                "id": job["id"],
                "title": job["title"],
                "company_name": job["company_name"],
                "location": job["location"],
                "url": job["url"],
                "source": job["source"],
                "jobType": job["jobType"],
                "salary": job["salary"],
                "publicationDate": job["publicationDate"],
                "job_description": job["job_description"],
                "retrieval_similarity": round(float(retrieval_similarity), 4),
                "retrieval_backend": retrieval_backend,
                "scoring_method": (
                    "partner-keyword-tfidf+pgvector-v1"
                    if retrieval_backend == "pgvector"
                    else "partner-keyword-tfidf+memory-vector-v1"
                ),
                **score,
            }
        )

    ranked_jobs.sort(
        key=lambda job: (
            float(job.get("final_score") or 0),
            float(job.get("retrieval_similarity") or 0),
            str(job.get("title") or ""),
        ),
        reverse=True,
    )

    return {
        "method": "partner-keyword-tfidf+pgvector-v1"
        if retrieval_backend == "pgvector"
        else "partner-keyword-tfidf+memory-vector-v1",
        "top_k": top_k,
        "vector_top_n": vector_top_n,
        "jobs_considered": len(filtered_jobs),
        "jobs_retrieved": len(shortlisted),
        "embedding_model": model_name,
        "vector_backend": retrieval_backend,
        "jobs": ranked_jobs[:top_k],
    }


def main() -> None:
    payload = json.load(sys.stdin)
    result = rank_jobs(payload)
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
