"""
Reset ALL gamification stats to clean slate
"""
import sqlite3
from datetime import datetime

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

print("🔥 RESETTING ALL GAMIFICATION STATS TO CLEAN SLATE 🔥\n")

# Reset UserGamificationStats
cursor.execute("""
    UPDATE user_gamification_stats SET
        total_points = 0,
        level = 1,
        experience = 0,
        weekly_points = 0,
        weekly_ai_chats = 0,
        weekly_notes_created = 0,
        weekly_questions_answered = 0,
        weekly_quizzes_completed = 0,
        weekly_flashcards_created = 0,
        weekly_study_minutes = 0,
        weekly_battles_won = 0,
        total_ai_chats = 0,
        total_notes_created = 0,
        total_questions_answered = 0,
        total_quizzes_completed = 0,
        total_flashcards_created = 0,
        total_study_minutes = 0,
        total_battles_won = 0,
        total_solo_quizzes = 0,
        total_flashcards_reviewed = 0,
        total_flashcards_mastered = 0,
        weekly_solo_quizzes = 0,
        weekly_flashcards_reviewed = 0,
        weekly_flashcards_mastered = 0,
        current_streak = 0,
        longest_streak = 0,
        last_activity_date = NULL,
        updated_at = ?
""", (datetime.utcnow(),))
print(f"✅ Reset {cursor.rowcount} user gamification stats")

# Delete all point transactions
cursor.execute("DELETE FROM point_transactions")
print(f"✅ Deleted {cursor.rowcount} point transactions")

# Delete all chat messages (to start fresh)
cursor.execute("DELETE FROM chat_messages")
print(f"✅ Deleted {cursor.rowcount} chat messages")

# Delete all chat sessions (to start fresh)
cursor.execute("DELETE FROM chat_sessions")
print(f"✅ Deleted {cursor.rowcount} chat sessions")

conn.commit()
conn.close()

print("\n🎉 ALL STATS RESET TO CLEAN SLATE! 🎉")
print("Ready to test fresh tracking!")
