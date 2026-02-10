# Quick Cleanup Guide

## 🚀 Clear Everything NOW

### Local Development
```bash
cd backend
.venv\Scripts\activate
python clear_cache_and_stats.py --all --confirm
```

### Production (Supabase)
```bash
cd backend
.venv\Scripts\activate

# Set your Supabase database URL
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"

# Clear everything
python clear_production.py --all --confirm
```

---

## 📋 What Gets Cleared

✅ **Cache** (Redis, AI responses)  
✅ **User Stats** (lessons, hours, streak)  
✅ **Learning Metrics** (daily progress)  
✅ **Weak Areas** (performance tracking)  
✅ **Topic Mastery** (concept progress)  
✅ **Activities** (user actions)  
✅ **Chat History** (messages, sessions)  
✅ **RAG Collections** (vector embeddings)  
✅ **Knowledge Graph** (user nodes)

❌ **NOT Cleared**: User accounts, notes, flashcards, question banks

---

## ⚠️ Before You Run

### 1. Backup Production (IMPORTANT!)
```bash
# Get your Supabase connection string from:
# Supabase Dashboard > Project Settings > Database > Connection String

pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

### 2. Verify What Will Be Deleted
```bash
# Local
python clear_cache_and_stats.py --all
# (Don't use --confirm, it will ask for confirmation)

# Production
python clear_production.py --verify-only
```

---

## 🎯 Common Scenarios

### Scenario 1: Fresh Start (Clear Everything)
```bash
# Local
python clear_cache_and_stats.py --all --confirm

# Production
export DATABASE_URL="postgresql://..."
python clear_production.py --all --confirm
```

### Scenario 2: Clear Only Cache (Keep Stats)
```bash
python clear_cache_and_stats.py --cache-only --confirm
```

### Scenario 3: Clear Only Stats (Keep Chat)
```bash
# Local
python clear_cache_and_stats.py --stats-only --confirm

# Production
python clear_production.py --stats-only --confirm
```

### Scenario 4: Clear One User Only
```bash
# Local
python clear_cache_and_stats.py --all --user 123 --confirm

# Production
python clear_production.py --all --user 123 --confirm
```

---

## 🔍 Verify Cleanup

### After Local Cleanup
```bash
python clear_cache_and_stats.py --verify-only
```

### After Production Cleanup
```bash
python clear_production.py --verify-only
```

---

## 🐛 Troubleshooting

### Error: "DATABASE_URL not found"
```bash
# Set it:
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Or create .env.production:
echo 'DATABASE_URL=postgresql://...' > backend/.env.production
```

### Error: "Could not connect to database"
- Check your Supabase password
- Verify project is running
- Check connection string format

### Error: "Redis not installed"
```bash
pip install redis
```

---

## 📞 Need Help?

Read the full documentation: `CLEANUP_SCRIPTS_README.md`

---

## ✅ Checklist

Before clearing production:
- [ ] Backup database
- [ ] Verify what will be deleted
- [ ] Test on local first
- [ ] Have DATABASE_URL ready
- [ ] Understand what gets cleared
- [ ] Know how to restore from backup

---

**Remember**: Production cleanup is PERMANENT! Always backup first! 🔒
