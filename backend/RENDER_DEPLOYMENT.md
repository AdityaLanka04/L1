# Render.com Deployment Instructions

## Quick Deployment Steps

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Add comprehensive gamification system with point tracking"
git push origin main
```

### 2. Render Will Auto-Deploy
Render will automatically detect the changes and start deploying.

### 3. Run Deployment Script (ONE TIME)
After the deployment completes, run this command in the Render Shell:

```bash
python backend/deploy_gamification.py
```

**How to access Render Shell:**
1. Go to your Render dashboard
2. Click on your backend service
3. Click "Shell" tab
4. Run the command above

### 4. Verify Deployment
Test these endpoints in your browser or Postman:

```
https://ceryl.onrender.com/api/get_leaderboard?limit=10
https://ceryl.onrender.com/api/get_gamification_stats?user_id=YOUR_USERNAME
```

## What the Deployment Script Does

1. ✅ Creates gamification tables (if they don't exist)
2. ✅ Recalculates all user stats from historical data
3. ✅ Awards points for:
   - All past chat messages (+1 each)
   - All past notes (+10 each)
   - All past questions (+2 each)
   - All past flashcard sets (+10 each)
4. ✅ Calculates levels based on XP
5. ✅ Shows top 5 users by points

## Expected Output

```
============================================================
GAMIFICATION SYSTEM DEPLOYMENT
============================================================
Database: postgresql://...
Timestamp: 2025-11-09T...
============================================================

✅ Gamification tables already exist

[STEP 2] Recalculating user statistics...
Found X users to process

Processing user1... ✅ 150 pts, Level 2
Processing user2... ✅ 320 pts, Level 3
Processing user3... ✅ 89 pts, Level 1
...

✅ Successfully updated X users
📊 Total points awarded: X,XXX

[STEP 3] Verifying deployment...
✅ All gamification tables exist
✅ Users: X, Stats records: X

🏆 Top 5 Users:
   1. user1: 320 pts (Level 3)
   2. user2: 150 pts (Level 2)
   3. user3: 89 pts (Level 1)
   ...

============================================================
✅ GAMIFICATION DEPLOYMENT COMPLETED SUCCESSFULLY
============================================================
```

## Troubleshooting

### Script fails with "table already exists"
This is fine - it means tables were created in a previous run. The script will skip table creation and proceed to recalculation.

### Users have 0 points after deployment
Run the recalculation script:
```bash
python backend/recalculate_gamification_from_activities.py
```

### Can't access Render Shell
Alternative: Add a temporary endpoint to trigger deployment:

```python
# Add to main.py temporarily
@app.get("/api/admin/deploy_gamification")
async def admin_deploy_gamification():
    """ONE-TIME deployment endpoint - REMOVE AFTER USE"""
    import subprocess
    result = subprocess.run(
        ["python", "backend/deploy_gamification.py"],
        capture_output=True,
        text=True
    )
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode
    }
```

Then visit: `https://ceryl.onrender.com/api/admin/deploy_gamification`

**IMPORTANT**: Remove this endpoint after deployment for security!

## Verification Checklist

After deployment, verify:

- [ ] `/api/get_leaderboard` returns users sorted by total_points
- [ ] `/api/get_gamification_stats` returns user stats
- [ ] `/api/get_weekly_bingo_stats` returns bingo progress
- [ ] Frontend `/games` page displays correctly
- [ ] New activities award points in real-time
- [ ] Leaderboard updates when users earn points

## Database Backup (Recommended)

Before deployment, backup your database:

1. Go to Render dashboard
2. Click on your PostgreSQL database
3. Click "Backups" tab
4. Create a manual backup

This allows rollback if needed.

## Rollback Plan

If something goes wrong:

1. Restore database from backup
2. Revert code to previous commit:
   ```bash
   git revert HEAD
   git push origin main
   ```
3. Render will auto-deploy the previous version

## Post-Deployment

### Monitor These Metrics
- User engagement (check if points are being awarded)
- Leaderboard activity (check if rankings update)
- Error logs (check for any API errors)
- Frontend console (check for JavaScript errors)

### Expected Behavior
- Existing users immediately see their historical points
- New activities award points in real-time
- Leaderboard updates automatically
- Weekly stats reset every Monday at 00:00 UTC

## Support

If you encounter issues:

1. Check Render logs: Dashboard → Service → Logs
2. Check database: Dashboard → PostgreSQL → Metrics
3. Test API endpoints manually
4. Check frontend console for errors

## Success Criteria

✅ Deployment script runs without errors
✅ All users have gamification stats
✅ Points match historical activities
✅ Leaderboard sorted by total_points (PRIMARY METRIC)
✅ Frontend displays all stats correctly
✅ New activities award points in real-time

---

**Ready to deploy!** 🚀
