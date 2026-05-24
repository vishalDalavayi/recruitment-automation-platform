# Matching Agent Architecture

![Matching Agent Architecture](./matching-agent-architecture.svg)

This document is the simplest visual explanation of Vishal's matching-agent workflow in this repo.

It covers:
- where inputs come from
- how the matcher retrieves and ranks jobs
- where pgvector fits
- what gets persisted
- where tailoring plugs in

## 1. Whole Flow

```mermaid
flowchart LR
    A[Formatted Resume<br/>Text or Uploaded File] --> B[HTTP Matcher Service<br/>src/server.js]
    A2[Candidate + Job Payload<br/>from upstream caller] --> B

    B --> C[Resume Text Extraction<br/>src/io/extractText.js]
    C --> D[Matching Orchestrator<br/>src/agents/matchingAgent.js]
    B --> D

    E[Scraped Jobs<br/>JSON payload or DB caller output] --> D

    D --> F[Job Normalization<br/>jobPosting.js]
    D --> G[JD Requirement Parsing<br/>requirements.js / atsCore.js]
    D --> H[Resume Profile Parsing<br/>profile.js / atsCore.js]

    D --> I[Python Vector Worker<br/>scripts/vector_rank_jobs.py]
    I --> J[(Postgres + pgvector<br/>candidate_details.job_vector_embeddings)]

    J --> I
    I --> K[Top-N Retrieved Jobs]
    K --> L[Hybrid Scoring<br/>60% keyword + 40% TF-IDF]
    L --> M[Ranked Matches]

    M --> N[Persistence Layer<br/>src/db/postgres.js]
    N --> O[(Postgres Match Tables<br/>candidate_match_resumes<br/>candidate_match_jobs<br/>candidate_match_runs<br/>candidate_match_results)]

    M --> P[Tailoring Handoff<br/>src/integrations/tailoringClient.js]
    P --> Q[External Tailoring Agent]

    M --> R[API Response<br/>/match/jobs or /match/jobs/upload]
```

## 2. Runtime Architecture

```mermaid
flowchart TB
    subgraph Upstream[Upstream Platform]
        U1[Formatting Agent]
        U2[Scraper / Job Store]
        U3[DB Caller Batch Scripts]
    end

    subgraph Matcher[Matching Agent Service]
        M1[src/server.js]
        M2[src/agents/matchingAgent.js]
        M3[src/db/postgres.js]
        M4[src/io/extractText.js]
        M5[src/openapi.js]
    end

    subgraph PythonWorker[Scoring + Retrieval Worker]
        P1[scripts/vector_rank_jobs.py]
    end

    subgraph Data[Shared Data Stores]
        D1[(Formatted Resume Tables)]
        D2[(Scraped Job Tables)]
        D3[(pgvector Table<br/>candidate_details.job_vector_embeddings)]
        D4[(Match Result Tables)]
    end

    subgraph Downstream[Downstream Agent]
        T1[Tailoring Agent]
    end

    U1 --> D1
    U2 --> D2
    U3 --> M1
    M1 --> M2
    M2 --> P1
    P1 --> D3
    M2 --> M3
    M3 --> D4
    M2 --> T1
```

## 3. Sequence: One Match Request

```mermaid
sequenceDiagram
    participant U as Upstream Caller
    participant S as src/server.js
    participant M as matchingAgent.js
    participant P as vector_rank_jobs.py
    participant V as Postgres pgvector table
    participant DB as Match persistence tables
    participant T as Tailoring Agent

    U->>S: POST /match/jobs or /match/jobs/upload
    S->>S: Validate request + extract resume text if needed
    S->>M: matchJobsForResumeAsync(...)
    M->>M: Normalize jobs + parse requirements + parse resume profile
    M->>P: Spawn Python worker with resume + jobs + vector config
    P->>V: Upsert missing job embeddings if needed
    P->>V: Retrieve top-N nearest jobs
    V-->>P: Shortlist by vector similarity
    P->>P: Score shortlist with keyword + TF-IDF hybrid formula
    P-->>M: Ranked matches + vector backend used
    M-->>S: Ranked response payload
    S->>DB: Persist resume/job/run/result rows when enabled
    S-->>U: JSON response
    U->>T: Optional tailoring call for top matches
```

## 4. What Each Layer Is Responsible For

- `src/server.js`
  Handles HTTP requests, file uploads, multipart parsing, JSON parsing, request validation, and final response/persistence wiring.

- `src/agents/matchingAgent.js`
  Main orchestrator. It normalizes incoming jobs, builds job requirements and resume profile signals, calls the Python worker, and shapes the ranked output.

- `scripts/vector_rank_jobs.py`
  Retrieval + scoring worker. This is where pgvector is used and where the shortlist scoring happens.

- `src/db/postgres.js`
  Persistence layer for:
  - `candidate_match_resumes`
  - `candidate_match_jobs`
  - `candidate_match_runs`
  - `candidate_match_results`

- `src/integrations/tailoringClient.js`
  Downstream connector for the tailoring stage after matching.

## 5. Where pgvector Fits

pgvector is not the final scorer. It is the retrieval engine.

The worker flow is:
1. embed the resume
2. embed or refresh candidate job vectors
3. store vectors in `candidate_details.job_vector_embeddings`
4. retrieve the closest jobs with pgvector similarity
5. run final ranking on the shortlist

That final ranking is:
- `60%` keyword overlap
- `40%` TF-IDF cosine similarity

So the architecture is:

`pgvector retrieval -> shortlist -> deterministic hybrid scoring -> ranked matches`

## 6. Current Tables Involved

### Retrieval table
- `candidate_details.job_vector_embeddings`

### Persistence tables
- `candidate_details.candidate_match_resumes`
- `candidate_details.candidate_match_jobs`
- `candidate_details.candidate_match_runs`
- `candidate_details.candidate_match_results`

## 7. Inputs and Outputs

### Inputs
- formatted resume text
- uploaded PDF/DOCX resume converted to text
- scraped job postings
- optional upstream IDs like `resumeId`, `matchRunId`, `candidateName`

### Outputs
- ranked jobs
- scores and scoring breakdown
- persistence metadata
- optional tailoring handoff inputs

## 8. Mental Model

If someone asks "what does Vishal's matching agent do?", the shortest accurate answer is:

> It takes one formatted resume plus a candidate set of jobs, uses pgvector to retrieve the most relevant jobs, scores that shortlist with a deterministic hybrid matcher, persists the results to Postgres, and optionally hands the top matches to the tailoring agent.
