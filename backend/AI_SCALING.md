# AI Scaling

Brainwave now supports a production AI job path that separates fast API traffic from slow AI generation.

## Runtime Shape

- API containers accept requests and create `ai_jobs` rows.
- Redis stores queued job IDs in `AI_JOB_QUEUE_NAME`.
- AI worker containers run `python worker.py` and process jobs from Redis.
- Postgres stores durable job status, results, errors, and cache status.
- The frontend polls `GET /api/ai/jobs/{job_id}` until the job is complete.

## Endpoints

Create a job:

```http
POST /api/ai/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "job_type": "chat_completion",
  "prompt": "Explain photosynthesis for an exam",
  "chat_session_id": 123,
  "user_message": "Explain photosynthesis for an exam",
  "use_semantic_cache": true,
  "cache_scope": "user"
}
```

Poll status:

```http
GET /api/ai/jobs/{job_id}
Authorization: Bearer <token>
```

Check queue health:

```http
GET /api/ai/health
Authorization: Bearer <token>
```

Admin queue metrics:

```http
GET /api/ai/admin/metrics
Authorization: Bearer <admin token>
```

Admin access is controlled by `AI_JOB_ADMIN_EMAILS`, falling back to `API_USAGE_ADMIN_EMAILS` or `ADMIN_EMAILS`.

Queue an existing AI-heavy route through the worker pool:

```http
POST /api/ai/route-jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "POST",
  "path": "/api/agents/searchhub",
  "body_type": "json",
  "json_body": {
    "user_id": "student@example.com",
    "query": "make flashcards from biology",
    "use_hs_context": true
  }
}
```

`route-jobs` is whitelist-only. Configure `AI_JOB_ALLOWED_LEGACY_PATHS` to add more existing AI endpoints after reviewing that they are safe to execute in workers.

## Reliability Controls

- Failed retryable jobs move to `retrying` and are scheduled in `AI_JOB_RETRY_QUEUE_NAME`.
- Jobs that exhaust `AI_JOB_MAX_ATTEMPTS` are marked `failed` and pushed to `AI_JOB_DEAD_LETTER_QUEUE_NAME`.
- Rate-limit and quota errors use `AI_JOB_RATE_LIMIT_RETRY_DELAY_SECONDS` before retrying.
- Other retryable transient errors use exponential backoff from `AI_JOB_RETRY_BASE_DELAY_SECONDS` up to `AI_JOB_RETRY_MAX_DELAY_SECONDS`.
- Job responses include `attempts`, `progress_percent`, `progress_message`, `timeout_seconds`, and `retry_after`.
- Per-job timeout defaults:
  - `AI_JOB_CHAT_TIMEOUT_SECONDS=180`
  - `AI_JOB_ROUTE_TIMEOUT_SECONDS=240`
  - `AI_JOB_FILE_TIMEOUT_SECONDS=420`
  - `AI_JOB_MEDIA_TIMEOUT_SECONDS=600`

## Production Baseline

Start with:

- `api`: 3 replicas, 4 Gunicorn workers each.
- `ai-worker`: 5-10 replicas.
- `postgres`: managed Postgres.
- `redis`: managed Redis.

Scale rules:

- Increase API replicas when normal API latency rises.
- Increase AI workers when queue depth or job wait time rises.
- Increase provider API quota/key pool when workers are idle but jobs are rate-limited.
- Keep DB pool sizes conservative when using Supabase; many worker replicas can exhaust database connections quickly.

Current frontend queue coverage:

- Main AI Chat, floating chat dock, file/image chat uploads, and context Q&A.
- SearchHub central agent requests plus create-note, create-flashcards, create-questions, topic descriptions, and knowledge maps.
- Flashcard AI suggestions, topic/chat/document flashcard generation, and embedded Ask AI.
- Question bank PDF/source/adaptive/practice/similar-question generation through the service wrapper and dashboard entry points.
- Knowledge Map creation from chat/context/topic, node expansion, node exploration, and node chat.
- Notes AI agent actions, smart grouping, chat-to-note conversion, and context-document note generation.
- Media processing, generated media titles, audio transcription, and legacy media-note generation.
- Learning path generation, battle/challenge question generation, study-insight/weakness AI endpoints.

Some non-AI CRUD/list endpoints intentionally remain direct API calls.

## Redis Semantic Cache

Set:

```bash
AI_SEMANTIC_CACHE_ENABLED=true
AI_SEMANTIC_CACHE_SCOPE=user
AI_SEMANTIC_CACHE_TTL_SECONDS=86400
AI_SEMANTIC_CACHE_DISTANCE_THRESHOLD=0.12
```

Use Redis Stack, Redis 8, or Redis Cloud with vector search support. The worker uses RedisVL `SemanticCache` when available and silently falls back to normal AI generation when semantic cache setup is missing.

Default cache scope is `user` to avoid leaking personalized responses across accounts. Use `global` only for safe, generic educational prompts that do not include private context.

The worker only serves direct semantic-cache hits for standalone prompts. Chat-session, tutor-mode, and selected-document requests still go through the full chat pipeline because prior conversation and private context can change the correct answer.

## Supabase/Postgres Pooling

Use Supabase's pooler connection string when running multiple API and worker replicas. Either point `DATABASE_URL` at port `6543` directly or set `SUPABASE_POOLER=true` to rewrite a `:5432` URL to `:6543`.

Recommended starting values:

```bash
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE_SECONDS=1800
DB_APPLICATION_NAME=brainwave_api
```

For worker services, use `DB_APPLICATION_NAME=brainwave_ai_worker` so Supabase/Postgres monitoring can separate API traffic from worker traffic.

## Local Compose

Run the production compose services, then scale workers:

```bash
docker compose -f aws-deployment/docker-compose.prod.yml up --build
docker compose -f aws-deployment/docker-compose.prod.yml up --scale ai-worker=4 -d
```

Managed hosts usually expose the same concept as independent process types or services:

- API service command: default backend Dockerfile command.
- Worker service command: `python worker.py`.
