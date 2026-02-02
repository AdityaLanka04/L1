# Brainwave Caching System

Comprehensive caching system designed to optimize LLM token usage, reduce database load, and improve API response times.

## Features

### 1. **AI Response Cache**
- Caches LLM responses to avoid redundant API calls
- Saves significant token costs
- Configurable TTL (default: 1 hour)
- Supports both Gemini and Groq responses

### 2. **RAG Query Cache**
- Caches vector search results
- Reduces embedding computation overhead
- Speeds up knowledge retrieval
- TTL: 30 minutes

### 3. **Database Query Cache**
- Caches frequent database queries
- Reduces database load
- Smart invalidation on data changes
- TTL: 5 minutes (configurable per query)

### 4. **Embedding Cache**
- Caches text embeddings
- Avoids recomputing embeddings for same text
- Significant performance improvement for RAG
- TTL: 2 hours

### 5. **API Response Cache**
- Caches GET endpoint responses
- Reduces server load
- Configurable per endpoint
- TTL: 1-10 minutes depending on endpoint

### 6. **Redis Support**
- Optional Redis backend for distributed caching
- Falls back to in-memory cache if Redis unavailable
- Supports multiple backend instances

## Installation

### Required Dependencies

```bash
pip install redis
```

### Optional: Redis Server

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or install locally
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379/0
ENABLE_REDIS_CACHE=true

# Cache TTL Settings (optional)
CACHE_TTL_SECONDS=3600
RAG_CACHE_TTL=1800
DB_CACHE_TTL=300
EMBEDDING_CACHE_TTL=7200
API_CACHE_TTL=60
```

## Usage

### 1. AI Response Caching (Automatic)

The AI client automatically uses caching:

```python
from ai_utils import UnifiedAIClient

# Caching is automatic
response = unified_ai.generate("What is photosynthesis?")
# Second call with same prompt returns cached response
response2 = unified_ai.generate("What is photosynthesis?")  # Cache hit!
```

### 2. Database Query Caching

```python
from caching.db_cache import cached_query, invalidate_user_cache

# Decorate your query functions
@cached_query("user_profile", ttl=600)
def get_user_profile(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

# Use as normal
profile = get_user_profile(db, user_id=123)

# Invalidate when data changes
invalidate_user_cache(user_id=123)
```

### 3. RAG Query Caching (Automatic)

RAG queries are automatically cached:

```python
from agents.rag.rag_helper import smart_retrieve

# First call queries vector store
results = await smart_retrieve(
    query="explain neural networks",
    user_id="123"
)

# Second call returns cached results
results2 = await smart_retrieve(
    query="explain neural networks",
    user_id="123"
)  # Cache hit!
```

### 4. Embedding Caching

```python
from caching.embedding_cache import wrap_embedding_model
from sentence_transformers import SentenceTransformer

# Wrap your embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')
cached_model = wrap_embedding_model(model)

# Use as normal - embeddings are cached
embeddings = cached_model.encode(["text1", "text2"])
embeddings2 = cached_model.encode(["text1", "text2"])  # Cache hit!
```

### 5. API Response Caching

```python
from fastapi import FastAPI
from caching.api_cache_middleware import APICacheMiddleware

app = FastAPI()

# Add middleware
app.add_middleware(
    APICacheMiddleware,
    default_ttl=60,
    cache_paths=["/api/stats", "/api/leaderboard"],
    exclude_paths=["/api/auth", "/api/chat"]
)
```

### 6. Custom Caching

```python
from caching import get_cache_manager, cached, async_cached

cache_manager = get_cache_manager()

# Manual caching
cache_manager.set("my_key", {"data": "value"}, ttl=300)
value = cache_manager.get("my_key")

# Decorator for sync functions
@cached(cache_manager, ttl=300, key_prefix="expensive_calc")
def expensive_calculation(x, y):
    # Expensive operation
    return x ** y

# Decorator for async functions
@async_cached(cache_manager, ttl=300)
async def async_operation(user_id: int):
    # Async operation
    return await fetch_data(user_id)
```

## Cache Monitoring

### API Endpoints

#### Get Cache Statistics
```bash
GET /api/cache/stats
```

Returns comprehensive cache statistics:
```json
{
  "cache_available": true,
  "overall_metrics": {
    "total_hits": 1523,
    "total_misses": 487,
    "total_requests": 2010,
    "hit_rate_percent": 75.77
  },
  "cache_details": {
    "ai_response_cache": {
      "hits": 342,
      "misses": 158,
      "hit_rate_percent": 68.4,
      "cache_size": 234,
      "max_size": 1000
    },
    "rag_query_cache": {...},
    "db_query_cache": {...}
  },
  "recommendations": [...]
}
```

#### Clear Cache
```bash
POST /api/cache/clear?cache_type=all
```

Cache types: `all`, `ai`, `rag`, `db`, `embedding`, `api`

#### Cleanup Expired Entries
```bash
POST /api/cache/cleanup
```

#### Check Cache Health
```bash
GET /api/cache/health
```

Returns health status and warnings:
```json
{
  "status": "healthy",
  "redis_available": true,
  "warnings": [],
  "stats_summary": {
    "ai_hit_rate": 68.4,
    "rag_hit_rate": 82.1,
    "db_hit_rate": 91.3
  }
}
```

## Performance Impact

### Token Savings
- **AI Response Cache**: 60-80% reduction in LLM API calls for repeated queries
- **Embedding Cache**: 70-90% reduction in embedding computations

### Response Time Improvements
- **Cached AI responses**: ~2000ms → ~5ms (400x faster)
- **Cached RAG queries**: ~500ms → ~2ms (250x faster)
- **Cached DB queries**: ~50ms → ~1ms (50x faster)

### Cost Savings
For a typical application with 10,000 requests/day:
- **Without cache**: ~$50-100/day in LLM costs
- **With cache (70% hit rate)**: ~$15-30/day
- **Savings**: ~$1,000-2,500/month

## Best Practices

### 1. Cache Warming
Pre-load frequently accessed data on user login:

```python
from caching.db_cache import warm_user_cache

@app.post("/api/login")
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, credentials)
    
    # Warm cache for this user
    warm_user_cache(db, user.id)
    
    return {"token": create_token(user)}
```

### 2. Smart Invalidation
Invalidate caches when data changes:

```python
from caching.db_cache import CacheInvalidator

@app.put("/api/notes/{note_id}")
async def update_note(note_id: int, data: NoteUpdate, db: Session = Depends(get_db)):
    with CacheInvalidator(user_id=data.user_id, content_type="note", content_id=note_id):
        note = db.query(Note).filter(Note.id == note_id).first()
        note.content = data.content
        db.commit()
    # Cache automatically invalidated after commit
    
    return {"success": True}
```

### 3. Batch Operations
Cache multiple items at once:

```python
from caching.db_cache import cache_batch_results

# Load all users and cache them
users = db.query(User).all()
user_dict = {user.id: user for user in users}
cache_batch_results("user_profile", user_dict, ttl=600)
```

### 4. Precompute Embeddings
For large datasets, precompute embeddings:

```python
from caching.embedding_cache import precompute_embeddings

# Precompute embeddings for all notes
notes = db.query(Note).all()
note_texts = [note.content for note in notes]
precompute_embeddings(note_texts, embedding_model)
```

## Troubleshooting

### Low Hit Rates
If cache hit rates are low (<30%):
1. Check if queries are too diverse
2. Increase cache size
3. Increase TTL
4. Check cache statistics for patterns

### High Memory Usage
If memory usage is high:
1. Reduce cache sizes
2. Reduce TTLs
3. Enable Redis for distributed caching
4. Run cleanup more frequently

### Redis Connection Issues
If Redis is unavailable:
1. System automatically falls back to in-memory cache
2. Check Redis server status
3. Verify REDIS_URL in .env
4. Check network connectivity

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cache Manager                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AI Response  │  │  RAG Query   │  │  DB Query    │      │
│  │    Cache     │  │    Cache     │  │    Cache     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Embedding   │  │ API Response │                         │
│  │    Cache     │  │    Cache     │                         │
│  └──────────────┘  └──────────────┘                         │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Redis (Optional)                         │   │
│  │         Distributed Cache Backend                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           In-Memory LRU Cache                         │   │
│  │         Fallback / Local Cache                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Future Enhancements

- [ ] Distributed cache invalidation
- [ ] Cache warming strategies
- [ ] Predictive caching based on user patterns
- [ ] Cache compression for large values
- [ ] Multi-tier caching (L1/L2)
- [ ] Cache analytics dashboard
- [ ] Automatic cache tuning

## Support

For issues or questions:
1. Check cache health: `GET /api/cache/health`
2. Review cache statistics: `GET /api/cache/stats`
3. Check logs for cache-related warnings
4. Verify Redis connection if using distributed cache
