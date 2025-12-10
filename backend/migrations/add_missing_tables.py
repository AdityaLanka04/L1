"""
Migration script to add all missing tables to the database.
Run this on your deployed database to sync with local schema.

Usage:
    python migrations/add_missing_tables.py
"""

import sqlite3
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

# Extract database path from URL
if DATABASE_URL.startswith("sqlite:///"):
    DB_PATH = DATABASE_URL.replace("sqlite:///", "")
    if DB_PATH.startswith("./"):
        DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), DB_PATH[2:])
else:
    DB_PATH = "brainwave_tutor.db"

print(f"Database path: {DB_PATH}")

# All table creation statements
TABLES = {
    "learning_playlists": """
        CREATE TABLE IF NOT EXISTS learning_playlists (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            estimated_hours FLOAT DEFAULT 0,
            is_public BOOLEAN DEFAULT 0,
            is_featured BOOLEAN DEFAULT 0,
            cover_image VARCHAR(500),
            tags TEXT,
            view_count INTEGER DEFAULT 0,
            fork_count INTEGER DEFAULT 0,
            follower_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "playlist_items": """
        CREATE TABLE IF NOT EXISTS playlist_items (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL,
            item_type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            content_url VARCHAR(500),
            content_id INTEGER,
            duration_minutes INTEGER DEFAULT 0,
            order_index INTEGER DEFAULT 0,
            is_completed BOOLEAN DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES learning_playlists(id)
        )
    """,
    
    "playlist_followers": """
        CREATE TABLE IF NOT EXISTS playlist_followers (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            progress_percentage FLOAT DEFAULT 0,
            last_item_id INTEGER,
            followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed DATETIME,
            FOREIGN KEY (playlist_id) REFERENCES learning_playlists(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "playlist_forks": """
        CREATE TABLE IF NOT EXISTS playlist_forks (
            id INTEGER PRIMARY KEY,
            original_playlist_id INTEGER NOT NULL,
            forked_playlist_id INTEGER NOT NULL,
            forked_by_id INTEGER NOT NULL,
            forked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_playlist_id) REFERENCES learning_playlists(id),
            FOREIGN KEY (forked_playlist_id) REFERENCES learning_playlists(id),
            FOREIGN KEY (forked_by_id) REFERENCES users(id)
        )
    """,
    
    "playlist_collaborators": """
        CREATE TABLE IF NOT EXISTS playlist_collaborators (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            permission VARCHAR(20) DEFAULT 'edit',
            added_by_id INTEGER NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES learning_playlists(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (added_by_id) REFERENCES users(id)
        )
    """,
    
    "playlist_comments": """
        CREATE TABLE IF NOT EXISTS playlist_comments (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            parent_comment_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES learning_playlists(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "notifications": """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            notification_type VARCHAR(50),
            is_read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "reminders": """
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            reminder_date DATETIME NOT NULL,
            reminder_type VARCHAR(50) DEFAULT 'event',
            priority VARCHAR(20) DEFAULT 'medium',
            color VARCHAR(20) DEFAULT '#3b82f6',
            is_completed BOOLEAN DEFAULT 0,
            is_notified BOOLEAN DEFAULT 0,
            notify_before_minutes INTEGER DEFAULT 15,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "concept_nodes": """
        CREATE TABLE IF NOT EXISTS concept_nodes (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            concept_name VARCHAR(200) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            importance_score FLOAT DEFAULT 0.5,
            mastery_level FLOAT DEFAULT 0.0,
            position_x FLOAT,
            position_y FLOAT,
            notes_count INTEGER DEFAULT 0,
            quizzes_count INTEGER DEFAULT 0,
            flashcards_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "concept_connections": """
        CREATE TABLE IF NOT EXISTS concept_connections (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            source_concept_id INTEGER,
            target_concept_id INTEGER,
            connection_type VARCHAR(50),
            strength FLOAT DEFAULT 0.5,
            ai_generated BOOLEAN DEFAULT 0,
            user_confirmed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (source_concept_id) REFERENCES concept_nodes(id),
            FOREIGN KEY (target_concept_id) REFERENCES concept_nodes(id)
        )
    """,
    
    "user_gamification_stats": """
        CREATE TABLE IF NOT EXISTS user_gamification_stats (
            id INTEGER PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL,
            total_points INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            experience INTEGER DEFAULT 0,
            weekly_points INTEGER DEFAULT 0,
            weekly_ai_chats INTEGER DEFAULT 0,
            weekly_notes_created INTEGER DEFAULT 0,
            weekly_questions_answered INTEGER DEFAULT 0,
            weekly_quizzes_completed INTEGER DEFAULT 0,
            weekly_flashcards_created INTEGER DEFAULT 0,
            weekly_study_minutes INTEGER DEFAULT 0,
            weekly_battles_won INTEGER DEFAULT 0,
            total_ai_chats INTEGER DEFAULT 0,
            total_notes_created INTEGER DEFAULT 0,
            total_questions_answered INTEGER DEFAULT 0,
            total_quizzes_completed INTEGER DEFAULT 0,
            total_flashcards_created INTEGER DEFAULT 0,
            total_study_minutes INTEGER DEFAULT 0,
            total_battles_won INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_activity_date DATETIME,
            week_start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "point_transactions": """
        CREATE TABLE IF NOT EXISTS point_transactions (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            activity_type VARCHAR(50) NOT NULL,
            points_earned INTEGER NOT NULL,
            description VARCHAR(255),
            activity_metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "weekly_bingo_progress": """
        CREATE TABLE IF NOT EXISTS weekly_bingo_progress (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            week_start_date DATETIME NOT NULL,
            task_1_completed BOOLEAN DEFAULT 0,
            task_2_completed BOOLEAN DEFAULT 0,
            task_3_completed BOOLEAN DEFAULT 0,
            task_4_completed BOOLEAN DEFAULT 0,
            task_5_completed BOOLEAN DEFAULT 0,
            task_6_completed BOOLEAN DEFAULT 0,
            task_7_completed BOOLEAN DEFAULT 0,
            task_8_completed BOOLEAN DEFAULT 0,
            task_9_completed BOOLEAN DEFAULT 0,
            task_10_completed BOOLEAN DEFAULT 0,
            task_11_completed BOOLEAN DEFAULT 0,
            task_12_completed BOOLEAN DEFAULT 0,
            task_13_completed BOOLEAN DEFAULT 0,
            task_14_completed BOOLEAN DEFAULT 0,
            task_15_completed BOOLEAN DEFAULT 0,
            task_16_completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "solo_quizzes": """
        CREATE TABLE IF NOT EXISTS solo_quizzes (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            subject VARCHAR(100) NOT NULL,
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            status VARCHAR(20) DEFAULT 'active',
            question_count INTEGER DEFAULT 10,
            time_limit_seconds INTEGER DEFAULT 300,
            score INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT 0,
            answers TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "solo_quiz_questions": """
        CREATE TABLE IF NOT EXISTS solo_quiz_questions (
            id INTEGER PRIMARY KEY,
            quiz_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            explanation TEXT,
            FOREIGN KEY (quiz_id) REFERENCES solo_quizzes(id)
        )
    """,
    
    "quiz_battles": """
        CREATE TABLE IF NOT EXISTS quiz_battles (
            id INTEGER PRIMARY KEY,
            challenger_id INTEGER NOT NULL,
            opponent_id INTEGER,
            subject VARCHAR(100) NOT NULL,
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            status VARCHAR(20) DEFAULT 'pending',
            challenger_score INTEGER DEFAULT 0,
            opponent_score INTEGER DEFAULT 0,
            winner_id INTEGER,
            question_count INTEGER DEFAULT 10,
            time_limit_seconds INTEGER DEFAULT 30,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            started_at DATETIME,
            completed_at DATETIME,
            FOREIGN KEY (challenger_id) REFERENCES users(id),
            FOREIGN KEY (opponent_id) REFERENCES users(id),
            FOREIGN KEY (winner_id) REFERENCES users(id)
        )
    """,
    
    "battle_questions": """
        CREATE TABLE IF NOT EXISTS battle_questions (
            id INTEGER PRIMARY KEY,
            battle_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            explanation TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (battle_id) REFERENCES quiz_battles(id)
        )
    """,
    
    "battle_answers": """
        CREATE TABLE IF NOT EXISTS battle_answers (
            id INTEGER PRIMARY KEY,
            battle_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            selected_answer INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            time_taken INTEGER,
            answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (battle_id) REFERENCES quiz_battles(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (question_id) REFERENCES battle_questions(id)
        )
    """,
    
    "shared_content": """
        CREATE TABLE IF NOT EXISTS shared_content (
            id INTEGER PRIMARY KEY,
            content_type VARCHAR(20) NOT NULL,
            content_id INTEGER NOT NULL,
            owner_id INTEGER NOT NULL,
            shared_with_id INTEGER NOT NULL,
            permission VARCHAR(10) DEFAULT 'view',
            message TEXT,
            shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed DATETIME,
            FOREIGN KEY (owner_id) REFERENCES users(id),
            FOREIGN KEY (shared_with_id) REFERENCES users(id)
        )
    """,
    
    "shared_content_access": """
        CREATE TABLE IF NOT EXISTS shared_content_access (
            id INTEGER PRIMARY KEY,
            shared_content_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            action VARCHAR(20) NOT NULL,
            FOREIGN KEY (shared_content_id) REFERENCES shared_content(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "friendships": """
        CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (friend_id) REFERENCES users(id)
        )
    """,
    
    "friend_requests": """
        CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )
    """,
    
    "friend_activities": """
        CREATE TABLE IF NOT EXISTS friend_activities (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            activity_type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "kudos": """
        CREATE TABLE IF NOT EXISTS kudos (
            id INTEGER PRIMARY KEY,
            activity_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji VARCHAR(10) DEFAULT '👏',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (activity_id) REFERENCES friend_activities(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "challenges": """
        CREATE TABLE IF NOT EXISTS challenges (
            id INTEGER PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            challenge_type VARCHAR(50) NOT NULL,
            subject VARCHAR(100),
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            start_date DATETIME NOT NULL,
            end_date DATETIME NOT NULL,
            max_participants INTEGER,
            entry_fee_points INTEGER DEFAULT 0,
            prize_pool_points INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'upcoming',
            created_by_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_id) REFERENCES users(id)
        )
    """,
    
    "challenge_participations": """
        CREATE TABLE IF NOT EXISTS challenge_participations (
            id INTEGER PRIMARY KEY,
            challenge_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            score INTEGER DEFAULT 0,
            rank INTEGER,
            completed BOOLEAN DEFAULT 0,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (challenge_id) REFERENCES challenges(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """,
    
    "challenge_questions": """
        CREATE TABLE IF NOT EXISTS challenge_questions (
            id INTEGER PRIMARY KEY,
            challenge_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            explanation TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (challenge_id) REFERENCES challenges(id)
        )
    """,
    
    "challenge_answers": """
        CREATE TABLE IF NOT EXISTS challenge_answers (
            id INTEGER PRIMARY KEY,
            challenge_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            selected_answer INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (challenge_id) REFERENCES challenges(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (question_id) REFERENCES challenge_questions(id)
        )
    """,
    
    "leaderboards": """
        CREATE TABLE IF NOT EXISTS leaderboards (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            category VARCHAR(50) NOT NULL,
            score INTEGER DEFAULT 0,
            rank INTEGER,
            period VARCHAR(20) DEFAULT 'weekly',
            period_start DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """
}

def get_existing_tables(conn):
    """Get list of existing tables in database"""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]

def run_migration():
    """Run the migration to add missing tables"""
    print(f"\n{'='*60}")
    print("DATABASE MIGRATION - Adding Missing Tables")
    print(f"{'='*60}\n")
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        print("Creating new database...")
    
    conn = sqlite3.connect(DB_PATH)
    
    try:
        existing_tables = get_existing_tables(conn)
        print(f"📊 Found {len(existing_tables)} existing tables:")
        for table in sorted(existing_tables):
            print(f"   ✓ {table}")
        
        print(f"\n{'='*60}")
        print("Creating missing tables...")
        print(f"{'='*60}\n")
        
        created = []
        skipped = []
        
        for table_name, create_sql in TABLES.items():
            if table_name in existing_tables:
                skipped.append(table_name)
                print(f"   ⏭️  {table_name} (already exists)")
            else:
                try:
                    conn.execute(create_sql)
                    conn.commit()
                    created.append(table_name)
                    print(f"   ✅ {table_name} (created)")
                except Exception as e:
                    print(f"   ❌ {table_name} (error: {e})")
        
        print(f"\n{'='*60}")
        print("MIGRATION SUMMARY")
        print(f"{'='*60}")
        print(f"   Tables created: {len(created)}")
        print(f"   Tables skipped: {len(skipped)}")
        
        if created:
            print(f"\n   New tables:")
            for t in created:
                print(f"      + {t}")
        
        print(f"\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
