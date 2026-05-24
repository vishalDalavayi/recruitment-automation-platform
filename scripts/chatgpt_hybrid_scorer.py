from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from typing import List, Set

from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


SKILL_LEXICON = sorted(
    {
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
    }
)


@dataclass
class ATSResult:
    final_score: float
    keyword_score: float
    tfidf_score: float
    embedding_score: float
    required_score: float
    matched_keywords: List[str]
    missing_keywords: List[str]


def normalize(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9+#./\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_keywords(text: str) -> Set[str]:
    normalized = normalize(text)
    found = set()
    for skill in SKILL_LEXICON:
        pattern = rf"(?<!\w){re.escape(skill)}(?!\w)"
        if re.search(pattern, normalized):
            found.add(skill)
    return found


def tfidf_similarity(resume_text: str, jd_text: str) -> float:
    docs = [resume_text, jd_text]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    matrix = vectorizer.fit_transform(docs)
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])


def embedding_similarities(model: SentenceTransformer, texts: List[str]) -> List[float]:
    embeddings = model.encode(texts, normalize_embeddings=True)
    resume_embedding = embeddings[0]
    job_embeddings = embeddings[1:]
    return [float((resume_embedding * job_embedding).sum()) for job_embedding in job_embeddings]


def score_job(
    resume_text: str,
    jd_text: str,
    required_skills: List[str] | None,
    embedding_score: float,
) -> ATSResult:
    normalized_resume = normalize(resume_text)
    normalized_jd = normalize(jd_text)

    resume_keywords = extract_keywords(normalized_resume)
    jd_keywords = extract_keywords(normalized_jd)

    matched = sorted(resume_keywords & jd_keywords)
    missing = sorted(jd_keywords - resume_keywords)

    keyword_score = (len(matched) / len(jd_keywords) * 100.0) if jd_keywords else 0.0
    tfidf_score = tfidf_similarity(normalized_resume, normalized_jd) * 100.0
    embedding_score_pct = embedding_score * 100.0

    required_skills = [normalize(skill) for skill in (required_skills or []) if normalize(skill)]
    required_hits = [skill for skill in required_skills if skill in resume_keywords]
    required_score = (len(required_hits) / len(required_skills) * 100.0) if required_skills else 100.0

    final_score = (
        0.35 * keyword_score
        + 0.25 * tfidf_score
        + 0.30 * embedding_score_pct
        + 0.10 * required_score
    )

    return ATSResult(
        final_score=round(final_score, 2),
        keyword_score=round(keyword_score, 2),
        tfidf_score=round(tfidf_score, 2),
        embedding_score=round(embedding_score_pct, 2),
        required_score=round(required_score, 2),
        matched_keywords=matched,
        missing_keywords=missing,
    )


def main() -> None:
    payload = json.load(sys.stdin)
    resume_text = payload.get("resume_text") or ""
    jobs = payload.get("jobs") or []
    model_name = payload.get("embedding_model") or "all-MiniLM-L6-v2"

    model = SentenceTransformer(model_name)
    embedding_scores = embedding_similarities(
        model,
        [resume_text] + [str(job.get("job_description") or "") for job in jobs],
    )

    results = []
    for index, job in enumerate(jobs):
        result = score_job(
            resume_text=resume_text,
            jd_text=str(job.get("job_description") or ""),
            required_skills=job.get("required_skills") or [],
            embedding_score=embedding_scores[index],
        )
        results.append(
            {
                "id": job.get("id"),
                "title": job.get("title"),
                "company_name": job.get("company_name"),
                "final_score": result.final_score,
                "keyword_score": result.keyword_score,
                "tfidf_score": result.tfidf_score,
                "embedding_score": result.embedding_score,
                "required_score": result.required_score,
                "matched_keywords": result.matched_keywords,
                "missing_keywords": result.missing_keywords,
            }
        )

    json.dump({"results": results}, sys.stdout)


if __name__ == "__main__":
    main()
