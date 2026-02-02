# Caching System Migration Guide

This guide helps you integrate the caching system into your existing Brainwave application.

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd backend
pip install redis
```

### 2. Update Environment Variables

Add to your `.env` file:

```bash
# Optional: Redis for distributed caching
REDIS_URL=redis://localhost:6379/0
ENABLE_REDIS_CACHE=true

# Cache TTL settings (optional - defaults shown)
CACHE_TTL_SECONDS=3600
RAG_CACHE_TTL=1800
DB_CACHE_TTL=300
```

### 3. Start Redis (Optional)

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 --name brainwave-redis redis:alpine

# Or install locally
brew install redis  # macOS
brew services start redis
```

### 4. Restart Backend

```bash
python main.py
```

That's it! The caching system is now active.

## Verification

### Check Cache Status

```bash
curl http://localhost:8000/api/cache/health
```

Expected response:
```json
{
  "status": "healthy",
  "redis_available": true,
  "warnings": [],
  "stats_summary": {
    "ai_hit_rate": 0,
    "rag_hit_rate": 0,
    "db_hit_rate": 0
  }
}
```

### Monitor Cache Performance

```bash
curl http://localhost:8000/api/cache/stats
```

## Integration Steps

### Step 1: AI Response Caching (Already Done!)

The AI client (`ai_utils.py`) has been updated to use caching automatically. No code changes needed.

**Before:**
```python
response = unified_ai.generate("What is AI?")
```

**After:**
```python
response = unified_ai.generate("What is AI?")  # Automatically cached!
```

### Step 2: Database Query Caching

Update your database query functions to use caching:

**Before:**
```python
def get_user_profile(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()
```

**After:**
```python
from caching.db_cache import cached_query

@cached_query("user_profile", ttl=600)
def get_user_profile(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()
```

### Step 3: Cache Invalidation

Add cache invalidation when data changes:

**Before:**
```python
@app.put("/api/user/profile")
async def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    user.name = data.name
    db.commit()
    return {"success": True}
```

**After:**
```python
from caching.db_cache import invalidate_user_cache

@app.put("/api/user/profile")
async def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    user.name = data.name
    db.commit()
    
    # Invalidate cache
    invalidate_user_cache(data.user_id)
    
    return {"success": True}
```

### Step 4: RAG Query Caching (Already Done!)

RAG queries are automatically cached. No changes needed.

### Step 5: Embedding Caching

Wrap your embedding model:

**Before:**
```python
from sentence_transformers import SentenceTransformer

embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = embedding_model.encode(texts)
```

**After:**
```python
from sentence_transformers import SentenceTransformer
from caching.embedding_cache import wrap_embedding_model

base_model = SentenceTransformer('all-MiniLM-L6-v2')
embedding_model = wrap_embedding_model(base_model)
embeddings = embedding_model.encode(texts)  # Automatically cached!
```

### Step 6: API Response Caching (Optional)

Add middleware for API response caching:

```python
from caching.api_cache_middleware import APICacheMiddleware

app.add_middleware(
    APICacheMiddleware,
    default_ttl=60,
    cache_paths=["/api/stats", "/api/leaderboard"],
    exclude_paths=["/api/auth", "/api/chat"]
)
```

## Common Patterns

### Pattern 1: Cache Warming on Login

```python
from caching.db_cache import warm_user_cache

@app.post("/api/login")
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, credentials)
    
    # Warm cache for this user
    warm_user_cache(db, user.id)
    
    return {"token": create_token(user)}
```

### Pattern 2: Batch Caching

```python
from caching.db_cache import cache_batch_results

# Cache multiple users at once
users = db.query(User).all()
user_dict = {user.id: user for user in users}
cache_batch_results("user_profile", user_dict, ttl=600)
```

### Pattern 3: Smart Invalidation

```python
from caching.db_cache import CacheInvalidator

@app.put("/api/notes/{note_id}")
async def update_note(note_id: int, data: NoteUpdate, db: Session = Depends(get_db)):
    with CacheInvalidator(user_id=data.user_id, content_type="note", content_id=note_id):
        note = db.query(Note).filter(Note.id == note_id).first()
        note.content = data.content
        db.commit()
    # Cache automatically invalidated
    
    return {"success": True}
```

## Monitoring

### Dashboard (Coming Soon)

A cache monitoring dashboard will be available at:
```
http://localhost:3000/admin/cache
```

### API Endpoints

- `GET /api/cache/stats` - Detailed statistics
- `GET /api/cache/health` - Health check
- `POST /api/cache/clear` - Clear cache
- `POST /api/cache/cleanup` - Remove expired entries

### Logging

Cache operations are logged at DEBUG level:
```python
import logging
logging.getLogger('caching').setLevel(logging.DEBUG)
```

## Performance Tuning

### Adjust Cache Sizes

In `cache_manager.py`:
```python
cache_manager = CacheManager(
    max_memory_size=20000,  # Increase for more caching
    default_ttl=7200        # Increase for longer cache lifetime
)
```

### Adjust TTLs per Cache Type

```python
# AI responses - cache longer (queries are often repeated)
ai_response_cache = LRUCache(max_size=2000, default_ttl=7200)

# RAG queries - moderate TTL
rag_query_cache = LRUCache(max_size=1000, default_ttl=3600)

# DB queries - shorter TTL (data changes more frequently)
db_query_cache = LRUCache(max_size=5000, default_ttl=600)
```

### Enable Redis for Production

For production with multiple backend instances:

```bash
# .env
REDIS_URL=redis://your-redis-server:6379/0
ENABLE_REDIS_CACHE=true
```

## Troubleshooting

### Issue: Low Cache Hit Rates

**Symptoms:** Hit rate < 30% after significant usage

**Solutions:**
1. Increase cache size
2. Increase TTL
3. Check if queries are too diverse
4. Review cache statistics for patterns

### Issue: High Memory Usage

**Symptoms:** Backend using too much memory

**Solutions:**
1. Reduce cache sizes
2. Reduce TTLs
3. Enable Redis (moves cache to separate process)
4. Run cleanup more frequently

### Issue: Redis Connection Failed

**Symptoms:** "Redis initialization failed" in logs

**Solutions:**
1. Check if Redis is running: `redis-cli ping`
2. Verify REDIS_URL in .env
3. System will automatically fall back to in-memory cache
4. Check firewall/network settings

### Issue: Stale Data

**Symptoms:** Users seeing outdated information

**Solutions:**
1. Add cache invalidation on data updates
2. Reduce TTLs for frequently changing data
3. Use `CacheInvalidator` context manager
4. Clear cache manually if needed

## Rollback

If you need to disable caching:

### Option 1: Disable Redis Only

```bash
# .env
ENABLE_REDIS_CACHE=false
```

### Option 2: Disable All Caching

Comment out cache initialization in `main.py`:

```python
# @app.on_event("startup")
# async def fix_database_sequences():
#     # ... cache initialization code ...
```

### Option 3: Remove Caching Code

1. Remove `@cached_query` decorators
2. Remove `invalidate_*` calls
3. Remove cache middleware
4. Restart backend

## Next Steps

1. **Monitor Performance**: Check `/api/cache/stats` regularly
2. **Tune Settings**: Adjust TTLs and sizes based on usage
3. **Add More Caching**: Identify slow queries and add caching
4. **Enable Redis**: For production deployments
5. **Set Up Monitoring**: Integrate with your monitoring system

## Support

For issues or questions:
1. Check cache health: `GET /api/cache/health`
2. Review logs for cache warnings
3. Check Redis connection if using distributed cache
4. Review this guide and examples in `examples.py`
