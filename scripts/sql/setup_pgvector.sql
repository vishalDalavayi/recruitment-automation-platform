create extension if not exists vector;

create table if not exists job_vector_embeddings (
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
  embedding vector(384) not null,
  updated_at timestamptz not null default now()
);

create index if not exists job_vector_embeddings_model_idx
  on job_vector_embeddings (embedding_model);

create index if not exists job_vector_embeddings_embedding_hnsw_idx
  on job_vector_embeddings
  using hnsw (embedding vector_cosine_ops);
