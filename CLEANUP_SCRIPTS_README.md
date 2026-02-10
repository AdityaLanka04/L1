# Cache and Stats Cleanup Scripts

Complete guide for clearing cache and statistics in both development and production environments.

---

## 📁 Available Scripts

### 1. `backend/clear_cache_and_stats.py` - Local Development
Clears cache and stats on your local machine.

### 2. `backend/clear_production.py` - Production (Supabase)
Clears stats in production Supabase database.

### 3. `backend/clear_production_supabase.sql` - SQL Script
Direct SQL commands for Supabase SQL Editor.

---

## 🔧 Local Development Cleanup

### Clear Everything (Recommended)
```bash
cd backend
.venv\Scripts\activate
python clear_cache_and_stats.py --all --confirm
```

### Clear Only Cache
```bash
python clear_cache_and_stats.py --cache-only --confirm
```

### Clear Only Stats
```bash
python clear_cache_and_stats.py --stats-only --confirm
```

### Clear Only Chat History
```bash
python clear_cache_and_stats.py --chat-only --confirm
```

### Clear Only RAG Collections
```bash
python clear_cache_and_stats.py --rag-only --confirm
```

### Clear Only Knowledge Graph
```bash
python clear_cache_and_stats.py --kg-only --confirm
```

### Clear for Specific User
```bash
python clear_cache_and_stats.py --all --user 123 --confirm
```

### Interactive Mode (with confirmation)
```bash
python clear_cache_and_stats.py --all
# Will prompt for confirmation
```

---

## 🚀 Production Cleanup (Supabase)

### Method 1: Python Script (Recommended)

#### Step 1: Set Database URL
```bash
# Option A: Environment variable
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Option B: Create .env.production file
echo 'DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres' > backend/.env.production
```

#### Step 2: Run Cleanup
```bash
cd backend
.venv\Scripts\activate

# Clear everything for all users
python clear_production.py --all --confirm

# Clear only stats (keep chat history)
python clear_production.py --stats-only --confirm

# Clear only chat history (keep stats)
python clear_production.py --chat-only --confirm

# Clear for specific user
python clear_production.py --all --user 123 --confirm

# Verify without deleting
python clear_production.py --verify-only
```

### Method 2: SQL Script in Supabase

#### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project
2. Click "SQL Editor" in sidebar
3. Click "New query"

#### Step 2: Copy SQL Script
Copy contents from `backend/clear_production_supabase.sql`

#### Step 3: Modify for Your Needs

**Option A: Clear Specific User**
```sql
-- Set user ID
\set user_id 123

-- Run the DELETE statements
DELETE FROM user_stats WHERE user_id = :user_id;
DELETE FROM enhanced_user_stats WHERE user_id = :user_id;
-- ... etc
```

**Option B: Clear All Users (DANGEROUS!)**
```sql
-- Uncomment these lines
DELETE FROM user_stats;
DELETE FROM enhanced_user_stats;
DELETE FROM daily_learning_metrics;
-- ... etc
```

#### Step 4: Run Query
Click "Run" button in Supabase SQL Editor

---

## 📊 What Gets Cleared

### Cache (Local Only)
- ✅ Redis cache (if configured)
- ✅ AI response cache
- ✅ Embedding cache

### Stats (Local & Production)
- ✅ User statistics (total_lessons, total_hours, etc.)
- ✅ Enhanced user stats (learning_velocity, comprehension_rate, etc.)
- ✅ Daily learning metrics
- ✅ User weak areas
- ✅ Topic mastery
- ✅ Activities

### Chat History (Local & Production)
- ✅ Chat messages
- ✅ Chat sessions

### RAG Collections (Local Only)
- ✅ ChromaDB vector collections
- ✅ User-specific embeddings

### Knowledge Graph (Local Only)
- ✅ Neo4j user nodes
- ✅ User relationships
- ⚠️ Keeps concept structure

---

## ⚠️ Important Notes

### What's NOT Cleared by These Scripts

1. **User Accounts** - Users themselves are NOT deleted
2. **Notes** - User notes are preserved
3. **Flashcards** - Flashcard sets and cards are preserved
4. **Question Banks** - Question sets are preserved
5. **User Profiles** - Profile information is preserved

### Production Safety

The production script has multiple safety checks:
1. ✅ Verifies PostgreSQL connection string
2. ✅ Warns if connecting to localhost
3. ✅ Requires typing "DELETE PRODUCTION DATA" to confirm
4. ✅ Shows what will be deleted before proceeding
5. ✅ Provides verification after cleanup

### Backup Recommendation

**ALWAYS backup before clearing production data!**

```bash
# Backup Supabase database
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql

# Or use Supabase dashboard:
# Project Settings > Database > Backups
```

---

## 🔍 Verification

### Verify Local Cleanup
```bash
cd backend
python clear_cache_and_stats.py --verify-only
```

### Verify Production Cleanup
```bash
cd backend
python clear_production.py --verify-only
```

### Manual Verification (SQL)
```sql
-- Check remaining rows for specific user
SELECT 
    'user_stats' as table_name, 
    COUNT(*) as count 
FROM user_stats 
WHERE user_id = 123

UNION ALL

SELECT 'enhanced_user_stats', COUNT(*) 
FROM enhanced_user_stats 
WHERE user_id = 123

UNION ALL

SELECT 'daily_learning_metrics', COUNT(*) 
FROM daily_learning_metrics 
WHERE user_id = 123

-- ... etc
```

---

## 🎯 Common Use Cases

### 1. Fresh Start for Testing
```bash
# Local
python clear_cache_and_stats.py --all --confirm

# Production
python clear_production.py --all --confirm
```

### 2. Clear Cache After Code Changes
```bash
python clear_cache_and_stats.py --cache-only --confirm
```

### 3. Reset User Stats (Keep Chat History)
```bash
# Local
python clear_cache_and_stats.py --stats-only --user 123 --confirm

# Production
python clear_production.py --stats-only --user 123 --confirm
```

### 4. Clear Chat History (Keep Stats)
```bash
# Local
python clear_cache_and_stats.py --chat-only --confirm

# Production
python clear_production.py --chat-only --confirm
```

### 5. Clear Everything for One User
```bash
# Local
python clear_cache_and_stats.py --all --user 123 --confirm

# Production
python clear_production.py --all --user 123 --confirm
```

---

## 🐛 Troubleshooting

### "DATABASE_URL not found"
```bash
# Set environment variable
export DATABASE_URL="postgresql://..."

# Or create .env.production
echo 'DATABASE_URL=postgresql://...' > backend/.env.production
```

### "Could not connect to database"
- Check DATABASE_URL is correct
- Verify Supabase project is running
- Check firewall/network settings
- Verify database password

### "Redis not installed"
```bash
pip install redis
```

### "ChromaDB not installed"
```bash
pip install chromadb
```

### "Neo4j not configured"
- Check NEO4J_URI in .env
- Verify Neo4j is running
- This is optional, script will skip if not available

---

## 📝 Script Options Reference

### clear_cache_and_stats.py
```
--all              Clear everything
--cache-only       Clear only cache (Redis, AI cache)
--stats-only       Clear only stats
--chat-only        Clear only chat history
--rag-only         Clear only RAG collections
--kg-only          Clear only knowledge graph
--user USER_ID     Clear for specific user
--confirm          Skip confirmation prompt
```

### clear_production.py
```
--all              Clear everything
--stats-only       Clear only stats
--chat-only        Clear only chat history
--user USER_ID     Clear for specific user
--confirm          Skip confirmation prompt
--verify-only      Only verify, don't delete
```

---

## 🔐 Security Best Practices

1. **Never commit .env.production** - Add to .gitignore
2. **Use read-only credentials for verification** - When using --verify-only
3. **Backup before clearing production** - Always!
4. **Test on staging first** - Before running on production
5. **Use --user flag when possible** - Avoid clearing all users
6. **Keep audit logs** - Save script output for records

---

## 📞 Support

If you encounter issues:
1. Check the error message carefully
2. Verify database connection
3. Check environment variables
4. Review the verification output
5. Check Supabase logs

---

## ✅ Quick Reference

| Task | Command |
|------|---------|
| Clear local cache | `python clear_cache_and_stats.py --cache-only --confirm` |
| Clear local stats | `python clear_cache_and_stats.py --stats-only --confirm` |
| Clear local everything | `python clear_cache_and_stats.py --all --confirm` |
| Clear production stats | `python clear_production.py --stats-only --confirm` |
| Clear production everything | `python clear_production.py --all --confirm` |
| Verify production | `python clear_production.py --verify-only` |
| Clear specific user | `python clear_production.py --user 123 --confirm` |

---

**Remember**: Always backup production data before clearing! 🔒
