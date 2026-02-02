# Caching System Setup Guide

Complete guide to set up and configure the Brainwave caching system.

## Prerequisites

- Python 3.8+
- Existing Brainwave installation
- (Optional) Redis server for distributed caching

## Installation Steps

### Step 1: Install Dependencies

```bash
cd backend
pip install redis
```

### Step 2: Configure Environment

Add to your `.env` file:

```bash
# Redis Configuration (optional but recommended for production)
REDIS_URL=redis://localhost:6379/0
ENABLE_REDIS_CACHE=true

# Cache TTL Settings (optional - defaults shown)
CACHE_TTL_SECONDS=3600
RAG_CACHE_TTL=1800
DB_CACHE_TTL=300
EMBEDDING_CACHE_TTL=7200
API_CACHE_TTL=60

# Cache Size Limits (optional - defaults shown)
MAX_MEMORY_CACHE_SIZE=10000
AI_CACHE_SIZE=1000
RAG_CACHE_SIZE=500
DB_CACHE_SIZE=2000
EMBEDDING_CACHE_SIZE=5000
API_CACHE_SIZE=1000
```

### Step 3: Start Redis (Optional)

#### Option A: Docker (Recommended)

```bash
docker run -d \
  --name brainwave-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:alpine redis-server --appendonly yes
```

#### Option B: Local Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Windows:**
Download from: https://github.com/microsoftarchive/redis/releases

### Step 4: Verify Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### Step 5: Start Backend

```bash
cd backend
python main.py
```

Look for these log messages:
```
✅ Cache Manager initialized
   - Redis: Enabled
   - AI Response Cache: Enabled
   - RAG Query Cache: Enabled
   - Database Query Cache: Enabled
   - Embedding Cache: Enabled
   - API Response Cache: Enabled
```

### Step 6: Verify Caching is Working

```bash
# Check cache health
curl http://localhost:8000/api/cache/health

# Expected response:
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

## Configuration Options

### Basic Configuration (In-Memory Only)

Minimal setup without Redis:

```bash
# .env
ENABLE_REDIS_CACHE=false
```

The system will use in-memory caching only. Good for:
- Development
- Single-instance deployments
- Testing

### Production Configuration (With Redis)

Full setup with Redis for distributed caching:

```bash
# .env
REDIS_URL=redis://your-redis-server:6379/0
ENABLE_REDIS_CACHE=true
CACHE_TTL_SECONDS=7200
```

Good for:
- Production deployments
- Multiple backend instances
- High-traffic applications

### Custom TTL Configuration

Adjust cache lifetimes based on your needs:

```bash
# Longer cache for stable data
CACHE_TTL_SECONDS=7200          # 2 hours
EMBEDDING_CACHE_TTL=14400       # 4 hours

# Shorter cache for frequently changing data
DB_CACHE_TTL=180                # 3 minutes
API_CACHE_TTL=30                # 30 seconds
```

### Custom Cache Sizes

Adjust cache sizes based on available memory:

```bash
# Larger caches for more memory
MAX_MEMORY_CACHE_SIZE=20000
AI_CACHE_SIZE=2000
EMBEDDING_CACHE_SIZE=10000

# Smaller caches for limited memory
MAX_MEMORY_CACHE_SIZE=5000
AI_CACHE_SIZE=500
EMBEDDING_CACHE_SIZE=2000
```

## Testing the Setup

### Test 1: AI Response Caching

```python
import requests

# Make the same request twice
url = "http://localhost:8000/api/chat/send"
data = {"message": "What is AI?", "user_id": "test"}

# First request - should hit LLM
response1 = requests.post(url, json=data)
print(f"First request: {response1.elapsed.total_seconds()}s")

# Second request - should be cached
response2 = requests.post(url, json=data)
print(f"Second request: {response2.elapsed.total_seconds()}s")

# Second should be much faster
```

### Test 2: Check Cache Statistics

```bash
curl http://localhost:8000/api/cache/stats | jq
```

Look for:
- `hit_rate_percent` > 0 after some usage
- `cache_size` increasing as data is cached
- No errors in the response

### Test 3: Cache Invalidation

```python
import requests

# Update user profile
requests.post("http://localhost:8000/api/update_comprehensive_profile", json={
    "user_id": "test",
    "firstName": "Updated"
})

# Check that cache was invalidated
stats = requests.get("http://localhost:8000/api/cache/stats").json()
print(f"Cache stats: {stats}")
```

## Monitoring

### Real-Time Monitoring

```bash
# Watch cache statistics
watch -n 5 'curl -s http://localhost:8000/api/cache/stats | jq ".overall_metrics"'
```

### Log Monitoring

```bash
# Watch cache-related logs
tail -f logs/brainwave.log | grep -i cache
```

### Redis Monitoring (if using Redis)

```bash
# Monitor Redis
redis-cli monitor

# Check Redis memory usage
redis-cli info memory

# Check Redis stats
redis-cli info stats
```

## Troubleshooting

### Issue: Cache Not Working

**Symptoms:**
- Hit rate stays at 0%
- No cache-related logs

**Solutions:**
1. Check if caching is enabled in logs
2. Verify `.env` configuration
3. Restart backend
4. Check for import errors

```bash
# Check logs for cache initialization
grep "Cache Manager" logs/brainwave.log
```

### Issue: Redis Connection Failed

**Symptoms:**
- "Redis initialization failed" in logs
- System falls back to in-memory cache

**Solutions:**
1. Check if Redis is running:
   ```bash
   redis-cli ping
   ```

2. Verify REDIS_URL in `.env`

3. Check Redis logs:
   ```bash
   # Docker
   docker logs brainwave-redis
   
   # System service
   sudo journalctl -u redis
   ```

4. Test connection:
   ```bash
   redis-cli -u redis://localhost:6379/0 ping
   ```

### Issue: High Memory Usage

**Symptoms:**
- Backend using too much RAM
- System becoming slow

**Solutions:**
1. Reduce cache sizes in `.env`:
   ```bash
   MAX_MEMORY_CACHE_SIZE=5000
   AI_CACHE_SIZE=500
   ```

2. Enable Redis to move cache to separate process

3. Reduce TTLs to expire entries faster

4. Run manual cleanup:
   ```bash
   curl -X POST http://localhost:8000/api/cache/cleanup
   ```

### Issue: Stale Data

**Symptoms:**
- Users seeing outdated information
- Changes not reflected immediately

**Solutions:**
1. Reduce TTLs for frequently changing data

2. Add cache invalidation to update endpoints

3. Clear cache manually:
   ```bash
   curl -X POST http://localhost:8000/api/cache/clear?cache_type=all
   ```

4. Check invalidation logic in code

### Issue: Low Hit Rates

**Symptoms:**
- Hit rate < 30% after significant usage

**Solutions:**
1. Increase cache sizes

2. Increase TTLs

3. Check if queries are too diverse:
   ```bash
   curl http://localhost:8000/api/cache/stats | jq ".recommendations"
   ```

4. Review cache statistics for patterns

## Performance Tuning

### For High-Traffic Applications

```bash
# .env
MAX_MEMORY_CACHE_SIZE=20000
AI_CACHE_SIZE=3000
RAG_CACHE_SIZE=1000
DB_CACHE_SIZE=5000
EMBEDDING_CACHE_SIZE=10000

CACHE_TTL_SECONDS=7200
RAG_CACHE_TTL=3600
```

### For Memory-Constrained Environments

```bash
# .env
MAX_MEMORY_CACHE_SIZE=3000
AI_CACHE_SIZE=300
RAG_CACHE_SIZE=200
DB_CACHE_SIZE=1000
EMBEDDING_CACHE_SIZE=1500

CACHE_TTL_SECONDS=1800
RAG_CACHE_TTL=900
```

### For Development

```bash
# .env
ENABLE_REDIS_CACHE=false
MAX_MEMORY_CACHE_SIZE=1000
CACHE_TTL_SECONDS=600
```

## Maintenance

### Regular Cleanup

Set up a cron job to clean expired entries:

```bash
# Add to crontab
0 */6 * * * curl -X POST http://localhost:8000/api/cache/cleanup
```

### Cache Warming

Warm cache during off-peak hours:

```python
# warm_cache.py
import requests

# Warm cache for common queries
common_queries = [
    "What is machine learning?",
    "Explain neural networks",
    "What is deep learning?"
]

for query in common_queries:
    requests.post("http://localhost:8000/api/chat/send", json={
        "message": query,
        "user_id": "cache_warmer"
    })
```

### Monitoring Alerts

Set up alerts for:
- Hit rate < 30%
- Cache size > 90% of max
- Redis connection failures
- High memory usage

## Backup and Recovery

### Redis Backup

```bash
# Manual backup
redis-cli BGSAVE

# Backup file location
ls -lh /var/lib/redis/dump.rdb
```

### Redis Recovery

```bash
# Stop Redis
sudo systemctl stop redis

# Replace dump.rdb
sudo cp backup/dump.rdb /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis
```

## Scaling

### Horizontal Scaling

For multiple backend instances:

1. Use Redis for distributed caching
2. Configure all instances with same REDIS_URL
3. Enable Redis persistence
4. Consider Redis Cluster for high availability

### Vertical Scaling

For single instance with more resources:

1. Increase cache sizes
2. Increase TTLs
3. Enable more aggressive caching
4. Monitor memory usage

## Security

### Redis Security

```bash
# Set Redis password
redis-cli CONFIG SET requirepass "your-strong-password"

# Update .env
REDIS_URL=redis://:your-strong-password@localhost:6379/0
```

### Network Security

```bash
# Bind Redis to localhost only
redis-cli CONFIG SET bind "127.0.0.1"

# Or in redis.conf
bind 127.0.0.1
```

## Next Steps

1. ✅ Complete setup
2. ✅ Verify caching is working
3. ✅ Monitor performance
4. ⏭️ Tune settings based on usage
5. ⏭️ Set up monitoring alerts
6. ⏭️ Configure backup strategy
7. ⏭️ Plan for scaling

## Support

For issues:
1. Check logs: `tail -f logs/brainwave.log | grep cache`
2. Check health: `curl http://localhost:8000/api/cache/health`
3. Review stats: `curl http://localhost:8000/api/cache/stats`
4. Consult documentation in `backend/caching/README.md`
