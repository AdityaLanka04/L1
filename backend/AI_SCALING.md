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

## Local Compose

Run the production compose services, then scale workers:

```bash
docker compose -f docker-compose.prod.yml up --build
docker compose -f docker-compose.prod.yml up --scale ai-worker=10 -d
```

Managed hosts usually expose the same concept as independent process types or services:

- API service command: default backend Dockerfile command.
- Worker service command: `python worker.py`.
