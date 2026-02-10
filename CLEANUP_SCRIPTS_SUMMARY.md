# Cleanup Scripts - Summary

## ✅ Created Scripts

### 1. **backend/clear_cache_and_stats.py** - Local Development
Full-featured Python script for clearing cache and stats on local machine.

**Features**:
- ✅ Clear Redis cache
- ✅ Clear AI response cache
- ✅ Clear user statistics
- ✅ Clear chat history
- ✅ Clear RAG collections (ChromaDB)
- ✅ Clear knowledge graph (Neo4j)
- ✅ Support for specific user or all users
- ✅ Interactive confirmation
- ✅ Verification after cleanup

**Usage**:
```bash
python clear_cache_and_stats.py --all --confirm
```

---

### 2. **backend/clear_production.py** - Production (Supabase)
Production-safe script for clearing stats in Supabase PostgreSQL database.

**Features**:
- ✅ Connects to Supabase PostgreSQL
- ✅ Clear user statistics
- ✅ Clear chat history
- ✅ Support for specific user or all users
- ✅ Multiple safety checks
- ✅ Requires explicit confirmation
- ✅ Verification after cleanup
- ✅ Database connection validation

**Usage**:
```bash
export DATABASE_URL="postgresql://..."
python clear_production.py --all --confirm
```

---

### 3. **backend/clear_production_supabase.sql** - SQL Script
Direct SQL commands for Supabase SQL Editor.

**Features**:
- ✅ Ready-to-use SQL statements
- ✅ Multiple options (specific user, all users, reset only)
- ✅ Verification queries included
- ✅ Well-commented and documented

**Usage**:
1. Open Supabase SQL Editor
2. Copy SQL from file
3. Modify user_id if needed
4. Run query

---

### 4. **CLEANUP_SCRIPTS_README.md** - Full Documentation
Comprehensive guide with all details, examples, and troubleshooting.

---

### 5. **QUICK_CLEANUP_GUIDE.md** - Quick Start
Fast reference for common cleanup tasks.

---

## 🎯 Quick Commands

### Clear Everything Locally
```bash
cd backend
.venv\Scripts\activate
python clear_cache_and_stats.py --all --confirm
```

### Clear Everything in Production
```bash
cd backend
.venv\Scripts\activate
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
python clear_production.py --all --confirm
```

### Clear Only Cache (Local)
```bash
python clear_cache_and_stats.py --cache-only --confirm
```

### Clear Only Stats (Production)
```bash
python clear_production.py --stats-only --confirm
```

### Clear Specific User (Production)
```bash
python clear_production.py --all --user 123 --confirm
```

---

## 📊 What Gets Cleared

| Component | Local Script | Production Script | SQL Script |
|-----------|--------------|-------------------|------------|
| Redis Cache | ✅ | ❌ | ❌ |
| AI Cache | ✅ | ❌ | ❌ |
| User Stats | ✅ | ✅ | ✅ |
| Learning Metrics | ✅ | ✅ | ✅ |
| Weak Areas | ✅ | ✅ | ✅ |
| Topic Mastery | ✅ | ✅ | ✅ |
| Activities | ✅ | ✅ | ✅ |
| Chat History | ✅ | ✅ | ✅ |
| RAG Collections | ✅ | ❌ | ❌ |
| Knowledge Graph | ✅ | ❌ | ❌ |

**Note**: Production scripts only clear PostgreSQL data in Supabase. Cache, RAG, and Knowledge Graph are on the application server.

---

## 🔒 Safety Features

### Local Script
- ✅ Interactive confirmation prompt
- ✅ Shows what will be deleted
- ✅ Verification after cleanup
- ✅ Graceful error handling

### Production Script
- ✅ Database URL validation
- ✅ Localhost warning
- ✅ Requires typing "DELETE PRODUCTION DATA"
- ✅ Shows database name and user
- ✅ Verification before and after
- ✅ Transaction rollback on error

---

## 📁 File Locations

```
backend/
├── clear_cache_and_stats.py          # Local cleanup script
├── clear_production.py                # Production cleanup script
├── clear_production_supabase.sql      # SQL script for Supabase
└── .env.production                    # Production config (create this)

Root/
├── CLEANUP_SCRIPTS_README.md          # Full documentation
├── QUICK_CLEANUP_GUIDE.md             # Quick reference
└── CLEANUP_SCRIPTS_SUMMARY.md         # This file
```

---

## 🚀 Getting Started

### Step 1: Choose Your Environment

**Local Development**:
```bash
python clear_cache_and_stats.py --all --confirm
```

**Production (Supabase)**:
```bash
export DATABASE_URL="postgresql://..."
python clear_production.py --all --confirm
```

### Step 2: Verify
```bash
# Local
python clear_cache_and_stats.py --verify-only

# Production
python clear_production.py --verify-only
```

---

## ⚠️ Important Notes

### What's NOT Cleared
- ❌ User accounts (users table)
- ❌ Notes (notes table)
- ❌ Flashcards (flashcard_sets, flashcards tables)
- ❌ Question banks (question_sets, questions tables)
- ❌ User profiles (comprehensive_user_profiles table)

### Backup Recommendation
**ALWAYS backup production before clearing!**

```bash
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

### Production Safety
The production script has multiple safety checks:
1. Validates PostgreSQL connection string
2. Warns if connecting to localhost
3. Requires explicit confirmation phrase
4. Shows what will be deleted
5. Provides verification after cleanup

---

## 📞 Support

### Documentation
- **Full Guide**: `CLEANUP_SCRIPTS_README.md`
- **Quick Start**: `QUICK_CLEANUP_GUIDE.md`
- **This Summary**: `CLEANUP_SCRIPTS_SUMMARY.md`

### Common Issues
- **DATABASE_URL not found**: Set environment variable or create .env.production
- **Connection failed**: Check Supabase password and connection string
- **Redis not installed**: `pip install redis`
- **ChromaDB not installed**: `pip install chromadb`

---

## ✅ Verification

### After Cleanup, Verify:
```bash
# Local
python clear_cache_and_stats.py --verify-only

# Production
python clear_production.py --verify-only
```

### Expected Output:
```
VERIFICATION
================================================================================

Remaining rows:
  ✅ user_stats: 0 rows
  ✅ enhanced_user_stats: 0 rows
  ✅ daily_learning_metrics: 0 rows
  ✅ user_weak_areas: 0 rows
  ✅ topic_mastery: 0 rows
  ✅ activities: 0 rows
  ✅ chat_sessions: 0 rows
```

---

## 🎉 Summary

You now have **3 powerful cleanup scripts**:

1. **Local Development** - Full cleanup including cache, RAG, KG
2. **Production (Python)** - Safe Supabase database cleanup
3. **Production (SQL)** - Direct SQL for Supabase editor

All scripts include:
- ✅ Safety checks
- ✅ Confirmation prompts
- ✅ Verification
- ✅ Error handling
- ✅ Clear documentation

**Ready to use!** 🚀
