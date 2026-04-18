-- Run this in Supabase SQL Editor before first deploy.
-- Project: tgmmfookfpyrgvozgvuc

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Main embeddings table (replaces all ChromaDB collections)
CREATE TABLE IF NOT EXISTS embeddings (
    id          TEXT        NOT NULL,
    collection  TEXT        NOT NULL,
    user_id     TEXT,
    content     TEXT        NOT NULL,
    embedding   vector(384),
    metadata    JSONB       DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (collection, id)
);

-- 3. Index for collection + user_id scoping (used by all queries)
CREATE INDEX IF NOT EXISTS idx_emb_col_user
    ON embeddings (collection, user_id);

-- 4. GIN index for JSONB metadata filtering
CREATE INDEX IF NOT EXISTS idx_emb_metadata
    ON embeddings USING GIN (metadata);

-- 5. HNSW index for fast approximate nearest-neighbour search
--    m=16, ef_construction=64: good balance of speed vs recall for 384-dim vectors
CREATE INDEX IF NOT EXISTS idx_emb_hnsw
    ON embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m=16, ef_construction=64);

-- 6. (Optional) Row-Level Security — enable if you want Supabase RLS
-- ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "users see own rows" ON embeddings
--     FOR SELECT USING (user_id = auth.uid()::text OR user_id IS NULL);
