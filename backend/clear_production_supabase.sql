-- ============================================================================
-- PRODUCTION CACHE AND STATS CLEANUP SCRIPT FOR SUPABASE
-- ============================================================================
-- WARNING: This will permanently delete data!
-- Run this in Supabase SQL Editor
-- ============================================================================

-- OPTION 1: Clear for specific user
-- Replace USER_ID with actual user ID
-- ============================================================================

-- Set the user ID to clear (CHANGE THIS!)
-- \set user_id 1

-- Clear user stats for specific user
DELETE FROM user_stats WHERE user_id = :user_id;
DELETE FROM enhanced_user_stats WHERE user_id = :user_id;
DELETE FROM daily_learning_metrics WHERE user_id = :user_id;
DELETE FROM user_weak_areas WHERE user_id = :user_id;
DELETE FROM topic_mastery WHERE user_id = :user_id;
DELETE FROM activities WHERE user_id = :user_id;

-- Clear chat history for specific user
DELETE FROM chat_messages 
WHERE chat_session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = :user_id
);
DELETE FROM chat_sessions WHERE user_id = :user_id;

-- ============================================================================
-- OPTION 2: Clear ALL users (DANGEROUS!)
-- ============================================================================
-- Uncomment the lines below to clear ALL data for ALL users

-- Clear all user stats
-- DELETE FROM user_stats;
-- DELETE FROM enhanced_user_stats;
-- DELETE FROM daily_learning_metrics;
-- DELETE FROM user_weak_areas;
-- DELETE FROM topic_mastery;
-- DELETE FROM activities;

-- Clear all chat history
-- DELETE FROM chat_messages;
-- DELETE FROM chat_sessions;

-- ============================================================================
-- OPTION 3: Reset stats but keep history
-- ============================================================================
-- This resets stats to zero but keeps the records

-- Reset user stats for specific user
-- UPDATE user_stats 
-- SET total_lessons = 0,
--     total_hours = 0,
--     day_streak = 0,
--     accuracy_percentage = 0,
--     updated_at = NOW()
-- WHERE user_id = :user_id;

-- UPDATE enhanced_user_stats
-- SET learning_velocity = 0,
--     comprehension_rate = 0,
--     retention_score = 0,
--     consistency_rating = 0,
--     total_questions = 0,
--     total_flashcards = 0,
--     total_notes = 0,
--     updated_at = NOW()
-- WHERE user_id = :user_id;

-- ============================================================================
-- OPTION 4: Clear only recent data (last 7 days)
-- ============================================================================

-- Clear recent activities for specific user
-- DELETE FROM activities 
-- WHERE user_id = :user_id 
-- AND timestamp > NOW() - INTERVAL '7 days';

-- Clear recent daily metrics for specific user
-- DELETE FROM daily_learning_metrics
-- WHERE user_id = :user_id
-- AND date > NOW() - INTERVAL '7 days';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the cleanup

-- Check user stats count
SELECT 'user_stats' as table_name, COUNT(*) as count FROM user_stats WHERE user_id = :user_id
UNION ALL
SELECT 'enhanced_user_stats', COUNT(*) FROM enhanced_user_stats WHERE user_id = :user_id
UNION ALL
SELECT 'daily_learning_metrics', COUNT(*) FROM daily_learning_metrics WHERE user_id = :user_id
UNION ALL
SELECT 'user_weak_areas', COUNT(*) FROM user_weak_areas WHERE user_id = :user_id
UNION ALL
SELECT 'topic_mastery', COUNT(*) FROM topic_mastery WHERE user_id = :user_id
UNION ALL
SELECT 'activities', COUNT(*) FROM activities WHERE user_id = :user_id
UNION ALL
SELECT 'chat_sessions', COUNT(*) FROM chat_sessions WHERE user_id = :user_id
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages 
WHERE chat_session_id IN (SELECT id FROM chat_sessions WHERE user_id = :user_id);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. RAG collections (ChromaDB) are stored in the application server, not Supabase
--    Use the Python script to clear those
-- 
-- 2. Redis cache is also on the application server
--    Use the Python script to clear that
--
-- 3. Knowledge graph (Neo4j) is separate from Supabase
--    Use the Python script to clear that
--
-- 4. This script only clears PostgreSQL data in Supabase
--
-- 5. Always backup before running destructive operations!
--    Run: pg_dump -h your-supabase-host -U postgres -d postgres > backup.sql
-- ============================================================================
