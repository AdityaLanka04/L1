# Manual Deployment Guide - Critical Bug Fixes

## What Was Fixed

1. ✅ **Semantic Cache Disabled** - Set `ENABLE_RESPONSE_CACHING=false` to stop wrong content being returned
2. ✅ **Cache Similarity Threshold Increased** - 95% → 98% to reduce false matches
3. ✅ **Learning Path Confidence Lowered** - 30% → 20% so progress actually updates
4. ✅ **PostgreSQL Datetime Syntax Fixed** - Fixed 4 queries that were using SQLite syntax

---

## Step 1: SSH into EC2

```bash
cd ~
ssh -i "lanka.pem" ubuntu@ec2-16-170-49-253.eu-north-1.compute.amazonaws.com
```

---

## Step 2: Backup Current Files

```bash
cd /home/ubuntu/brainwave-backend
cp backend/.env.production backend/.env.production.backup
cp backend/caching/semantic_cache.py backend/caching/semantic_cache.py.backup
cp backend/agents/learning_progress_tracker.py backend/agents/learning_progress_tracker.py.backup
cp backend/agents/rag/user_rag_manager.py backend/agents/rag/user_rag_manager.py.backup
```

---

## Step 3: Update .env.production

```bash
nano backend/.env.production
```

Find this line:
```
ENABLE_RESPONSE_CACHING=true
```

Change it to:
```
ENABLE_RESPONSE_CACHING=false
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 4: Update semantic_cache.py

```bash
nano backend/caching/semantic_cache.py
```

**Change 1:** Line ~20 - Update `__init__` method:
```python
def __init__(self, similarity_threshold: float = 0.98, max_size: int = 1000):
    """
    Args:
        similarity_threshold: Minimum cosine similarity to consider a cache hit (0.98 = 98% similar, increased from 0.95 to reduce false matches)
        max_size: Maximum number of cached items
    """
```

**Change 2:** Line ~175 - Update `get_semantic_cache` function:
```python
def get_semantic_cache() -> SemanticCache:
    """Get global semantic cache instance"""
    global _semantic_cache
    if _semantic_cache is None:
        _semantic_cache = SemanticCache(
            similarity_threshold=0.98,  # 98% similar = cache hit (increased from 0.95 to reduce false matches)
            max_size=1000
        )
    return _semantic_cache
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 5: Update learning_progress_tracker.py

```bash
nano backend/agents/learning_progress_tracker.py
```

**Change 1:** Line ~360 - Lower confidence threshold:
```python
# Only update if confidence is high enough (lowered threshold for better tracking)
if match["confidence"] >= 20:  # Lowered from 30 to 20 to capture more matches
```

**Change 2:** Line ~395 - Update skip message:
```python
else:
    print(f"\n   ⏭️ Skipping node {match['node_title']} (confidence {match['confidence']}% < 20%)")
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 6: Update user_rag_manager.py (Fix PostgreSQL Syntax)

```bash
nano backend/agents/rag/user_rag_manager.py
```

Find and replace ALL 4 occurrences of `datetime('now', '-7 days')` with `NOW() - INTERVAL '7 days'`

**Line ~303:**
```python
AND created_at > NOW() - INTERVAL '7 days'
```

**Line ~327:**
```python
AND f.created_at > NOW() - INTERVAL '7 days'
```

**Line ~350:**
```python
AND cm.timestamp > NOW() - INTERVAL '7 days'
```

**Line ~376:**
```python
AND qs.created_at > NOW() - INTERVAL '7 days'
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 7: Clear Semantic Cache & Restart Backend

```bash
# Stop the backend
docker-compose -f docker-compose.production.yml stop backend

# Clear any cached data (semantic cache is in-memory, but let's be thorough)
docker-compose -f docker-compose.production.yml rm -f backend

# Rebuild and start (no --no-cache needed, just restart)
docker-compose -f docker-compose.production.yml up -d backend

# Wait for startup
sleep 10

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs --tail=50 backend
```

---

## Step 8: Verify Fixes

### Test 1: Semantic Cache Disabled
```bash
# Check logs for cache status
docker-compose -f docker-compose.production.yml logs backend | grep -i "cache"
```

You should see cache is disabled or not being used.

### Test 2: Generate Flashcards on Different Topics
- Go to https://cerbyl.com
- Generate flashcards on "chemistry"
- Generate flashcards on "biology"
- They should be DIFFERENT (not cached)

### Test 3: Learning Path Progress
- Check logs for learning path updates
- Should see "Updated nodes: 1" or more (not 0)

---

## Step 9: Monitor Logs

```bash
# Follow logs in real-time
docker-compose -f docker-compose.production.yml logs -f backend

# Press Ctrl+C to stop following
```

---

## Rollback (If Needed)

```bash
cd /home/ubuntu/brainwave-backend
cp backend/.env.production.backup backend/.env.production
cp backend/caching/semantic_cache.py.backup backend/caching/semantic_cache.py
cp backend/agents/learning_progress_tracker.py.backup backend/agents/learning_progress_tracker.py
cp backend/agents/rag/user_rag_manager.py.backup backend/agents/rag/user_rag_manager.py
docker-compose -f docker-compose.production.yml restart backend
```

---

## Quick Commands Reference

```bash
# SSH into EC2
ssh -i "lanka.pem" ubuntu@ec2-16-170-49-253.eu-north-1.compute.amazonaws.com

# Navigate to project
cd /home/ubuntu/brainwave-backend

# View logs
docker-compose -f docker-compose.production.yml logs --tail=100 backend

# Restart backend
docker-compose -f docker-compose.production.yml restart backend

# Check status
docker-compose -f docker-compose.production.yml ps

# Exit SSH
exit
```

---

## Expected Results After Deployment

✅ Flashcards generate fresh content for each topic (no more "integration" for "chemistry")
✅ Chat responses are fresh and relevant
✅ Learning path progress updates (matched_nodes > 0, updated_nodes > 0)
✅ No PostgreSQL datetime syntax errors in logs
✅ Cache is disabled (ENABLE_RESPONSE_CACHING=false)

---

## Troubleshooting

**If backend won't start:**
```bash
docker-compose -f docker-compose.production.yml logs backend
```

**If you see syntax errors:**
- Double-check the file edits
- Make sure you saved the files (Ctrl+O, Enter, Ctrl+X in nano)

**If cache is still being used:**
- Verify `.env.production` has `ENABLE_RESPONSE_CACHING=false`
- Restart: `docker-compose -f docker-compose.production.yml restart backend`
