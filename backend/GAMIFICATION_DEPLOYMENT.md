# Gamification System Deployment Guide

## Overview
This guide explains how to deploy the comprehensive gamification system to production.

## What's New
- **Complete Point Tracking**: AI chats (+1), Notes (+10), Questions (+2), Quizzes (+50), Flashcards (+10), Study time (+10/hr)
- **Real-time Stats**: Weekly and all-time statistics calculated from actual user activities
- **Bingo Challenges**: 16 weekly tasks with progress tracking
- **Level System**: XP-based progression with visual indicators
- **Leaderboard**: Sorted by gamification points as PRIMARY metric
- **Automatic Recalculation**: Existing users get points for all their historical activities

## Database Changes
New tables added:
- `user_gamification_stats` - Comprehensive user stats (points, level, weekly/total counts)
- `point_transactions` - Audit trail of all point-earning activities
- `weekly_bingo_progress` - Weekly challenge completion tracking

## Deployment Steps

### 1. Deploy Code
```bash
git pull origin main
```

### 2. Run Deployment Script (ONE TIME ONLY)
```bash
python backend/deploy_gamification.py
```

This script will:
- ✅ Create gamification tables if they don't exist
- ✅ Recalculate all existing user stats from historical data
- ✅ Verify data integrity
- ✅ Show top 5 users by points

### 3. Restart Application
```bash
# For Render/production
# Restart happens automatically after deployment

# For local development
python backend/main.py
```

### 4. Verify Deployment
Test these endpoints:
```bash
# Get user stats
GET /api/get_gamification_stats?user_id=USERNAME

# Get leaderboard (sorted by gamification points)
GET /api/get_leaderboard?limit=50

# Get weekly progress
GET /api/get_weekly_activity_progress?user_id=USERNAME

# Get bingo stats
GET /api/get_weekly_bingo_stats?user_id=USERNAME
```

## Point System

| Activity | Points | Tracking |
|----------|--------|----------|
| AI Chat Message | +1 | Per message |
| Create Note | +10 | Per note |
| Answer Question | +2 | Per question |
| Complete Quiz | +50 | Per quiz |
| Create Flashcard Set | +10 | Per set |
| Study Time | +10 | Per hour |
| Battle Win | +3 | Per win |
| Battle Draw | +2 | Per draw |
| Battle Loss | +1 | Per loss |

## Leaderboard Sorting

**PRIMARY METRIC: Gamification Points**

The leaderboard is sorted by:
1. **Total Points** (PRIMARY) - Sum of all point-earning activities
2. **Level** (SECONDARY) - Calculated from XP
3. **Experience** (TERTIARY) - Same as total points

This ensures the most active learners are ranked highest.

## Weekly Reset

Weekly stats reset every Monday at 00:00 UTC:
- Weekly points
- Weekly activity counts (chats, notes, questions, etc.)
- Bingo challenge progress

All-time stats are never reset.

## Frontend Integration

The Games page (`/games`) displays:
- Current level and XP progress
- Total points (all-time)
- Weekly points
- Activity breakdown with point values
- 16-task bingo board
- Recent point-earning activities

## Troubleshooting

### Users have 0 points
Run the recalculation script:
```bash
python backend/recalculate_gamification_from_activities.py
```

### Leaderboard not showing users
Check if gamification stats exist:
```sql
SELECT COUNT(*) FROM user_gamification_stats;
```

If 0, run deployment script again.

### Weekly stats not resetting
The reset happens automatically when users access their stats after Monday 00:00 UTC.

## Monitoring

Check these metrics:
- Total users with gamification stats
- Average points per user
- Top 10 users by points
- Weekly activity trends

## Rollback (if needed)

If you need to rollback:
```sql
-- Backup first!
DROP TABLE IF EXISTS user_gamification_stats;
DROP TABLE IF EXISTS point_transactions;
DROP TABLE IF EXISTS weekly_bingo_progress;
```

Then redeploy the previous version.

## Support

For issues or questions:
1. Check application logs
2. Verify database tables exist
3. Test API endpoints manually
4. Check frontend console for errors

## Success Criteria

✅ All users have gamification stats
✅ Points match historical activities
✅ Leaderboard sorted by total_points
✅ Weekly stats reset on Mondays
✅ Frontend displays all stats correctly
✅ Point tracking works for new activities
