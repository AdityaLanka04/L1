"""
Migration script to add all missing tables to PostgreSQL database.
Run this on your deployed database to sync with local schema.

Usage:
    DATABASE_URL="postgresql://..." python migrations/add_missing_tables_postgres.py
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Load from .env file if not in environment
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    DATABASE_URL = line.strip().split('=', 1)[1]
                    break

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment or .env file!")
    print("Usage: DATABASE_URL='postgresql://...' python migrations/add_missing_tables_postgres.py")
    sys.exit(1)

# Fix for Render's postgres:// vs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"Connecting to database...")

# All table creation statements for PostgreSQL
TABLES = {
    "learning_playlists": """
        CREATE TABLE IF NOT EXISTS learning_playlists (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            estimated_hours FLOAT DEFAULT 0,
            is_public BOOLEAN DEFAULT FALSE,
            is_featured BOOLEAN DEFAULT FALSE,
            cover_image VARCHAR(500),
            tags TEXT,
            view_count INTEGER DEFAULT 0,
            fork_count INTEGER DEFAULT 0,
            follower_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "playlist_items": """
        CREATE TABLE IF NOT EXISTS playlist_items (
            id SERIAL PRIMARY KEY,
            playlist_id INTEGER NOT NULL REFERENCES learning_playlists(id),
            item_type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            content_url VARCHAR(500),
            content_id INTEGER,
            duration_minutes INTEGER DEFAULT 0,
            order_index INTEGER DEFAULT 0,
            is_completed BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "playlist_followers": """
        CREATE TABLE IF NOT EXISTS playlist_followers (
            id SERIAL PRIMARY KEY,
            playlist_id INTEGER NOT NULL REFERENCES learning_playlists(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            progress_percentage FLOAT DEFAULT 0,
            last_item_id INTEGER,
            followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP
        )
    """,
    
    "playlist_forks": """
        CREATE TABLE IF NOT EXISTS playlist_forks (
            id SERIAL PRIMARY KEY,
            original_playlist_id INTEGER NOT NULL REFERENCES learning_playlists(id),
            forked_playlist_id INTEGER NOT NULL REFERENCES learning_playlists(id),
            forked_by_id INTEGER NOT NULL REFERENCES users(id),
            forked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "playlist_collaborators": """
        CREATE TABLE IF NOT EXISTS playlist_collaborators (
            id SERIAL PRIMARY KEY,
            playlist_id INTEGER NOT NULL REFERENCES learning_playlists(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            permission VARCHAR(20) DEFAULT 'edit',
            added_by_id INTEGER NOT NULL REFERENCES users(id),
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "playlist_comments": """
        CREATE TABLE IF NOT EXISTS playlist_comments (
            id SERIAL PRIMARY KEY,
            playlist_id INTEGER NOT NULL REFERENCES learning_playlists(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            content TEXT NOT NULL,
            parent_comment_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "notifications": """
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            notification_type VARCHAR(50),
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "reminders": """
        CREATE TABLE IF NOT EXISTS reminders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            reminder_date TIMESTAMP NOT NULL,
            reminder_type VARCHAR(50) DEFAULT 'event',
            priority VARCHAR(20) DEFAULT 'medium',
            color VARCHAR(20) DEFAULT '#3b82f6',
            is_completed BOOLEAN DEFAULT FALSE,
            is_notified BOOLEAN DEFAULT FALSE,
            notify_before_minutes INTEGER DEFAULT 15,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "concept_nodes": """
        CREATE TABLE IF NOT EXISTS concept_nodes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "concept_connections": """
        CREATE TABLE IF NOT EXISTS concept_connections (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            source_concept_id INTEGER REFERENCES concept_nodes(id),
            target_concept_id INTEGER REFERENCES concept_nodes(id),
            connection_type VARCHAR(50),
            strength FLOAT DEFAULT 0.5,
            ai_generated BOOLEAN DEFAULT FALSE,
            user_confirmed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "user_gamification_stats": """
        CREATE TABLE IF NOT EXISTS user_gamification_stats (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
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
            last_activity_date TIMESTAMP,
            week_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "point_transactions": """
        CREATE TABLE IF NOT EXISTS point_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            activity_type VARCHAR(50) NOT NULL,
            points_earned INTEGER NOT NULL,
            description VARCHAR(255),
            activity_metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "weekly_bingo_progress": """
        CREATE TABLE IF NOT EXISTS weekly_bingo_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            week_start_date TIMESTAMP NOT NULL,
            task_1_completed BOOLEAN DEFAULT FALSE,
            task_2_completed BOOLEAN DEFAULT FALSE,
            task_3_completed BOOLEAN DEFAULT FALSE,
            task_4_completed BOOLEAN DEFAULT FALSE,
            task_5_completed BOOLEAN DEFAULT FALSE,
            task_6_completed BOOLEAN DEFAULT FALSE,
            task_7_completed BOOLEAN DEFAULT FALSE,
            task_8_completed BOOLEAN DEFAULT FALSE,
            task_9_completed BOOLEAN DEFAULT FALSE,
            task_10_completed BOOLEAN DEFAULT FALSE,
            task_11_completed BOOLEAN DEFAULT FALSE,
            task_12_completed BOOLEAN DEFAULT FALSE,
            task_13_completed BOOLEAN DEFAULT FALSE,
            task_14_completed BOOLEAN DEFAULT FALSE,
            task_15_completed BOOLEAN DEFAULT FALSE,
            task_16_completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "solo_quizzes": """
        CREATE TABLE IF NOT EXISTS solo_quizzes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            subject VARCHAR(100) NOT NULL,
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            status VARCHAR(20) DEFAULT 'active',
            question_count INTEGER DEFAULT 10,
            time_limit_seconds INTEGER DEFAULT 300,
            score INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT FALSE,
            answers TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    """,
    
    "solo_quiz_questions": """
        CREATE TABLE IF NOT EXISTS solo_quiz_questions (
            id SERIAL PRIMARY KEY,
            quiz_id INTEGER NOT NULL REFERENCES solo_quizzes(id),
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            explanation TEXT
        )
    """,
    
    "quiz_battles": """
        CREATE TABLE IF NOT EXISTS quiz_battles (
            id SERIAL PRIMARY KEY,
            challenger_id INTEGER NOT NULL REFERENCES users(id),
            opponent_id INTEGER REFERENCES users(id),
            subject VARCHAR(100) NOT NULL,
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            status VARCHAR(20) DEFAULT 'pending',
            challenger_score INTEGER DEFAULT 0,
            opponent_score INTEGER DEFAULT 0,
            winner_id INTEGER REFERENCES users(id),
            question_count INTEGER DEFAULT 10,
            time_limit_seconds INTEGER DEFAULT 30,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP
        )
    """,
    
    "battle_questions": """
        CREATE TABLE IF NOT EXISTS battle_questions (
            id SERIAL PRIMARY KEY,
            battle_id INTEGER NOT NULL REFERENCES quiz_battles(id),
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            explanation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "battle_answers": """
        CREATE TABLE IF NOT EXISTS battle_answers (
            id SERIAL PRIMARY KEY,
            battle_id INTEGER NOT NULL REFERENCES quiz_battles(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            question_id INTEGER NOT NULL REFERENCES battle_questions(id),
            selected_answer INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            time_taken INTEGER,
            answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "shared_content": """
        CREATE TABLE IF NOT EXISTS shared_content (
            id SERIAL PRIMARY KEY,
            content_type VARCHAR(20) NOT NULL,
            content_id INTEGER NOT NULL,
            owner_id INTEGER NOT NULL REFERENCES users(id),
            shared_with_id INTEGER NOT NULL REFERENCES users(id),
            permission VARCHAR(10) DEFAULT 'view',
            message TEXT,
            shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP
        )
    """,
    
    "shared_content_access": """
        CREATE TABLE IF NOT EXISTS shared_content_access (
            id SERIAL PRIMARY KEY,
            shared_content_id INTEGER NOT NULL REFERENCES shared_content(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action VARCHAR(20) NOT NULL
        )
    """,
    
    "friendships": """
        CREATE TABLE IF NOT EXISTS friendships (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            friend_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "friend_requests": """
        CREATE TABLE IF NOT EXISTS friend_requests (
            id SERIAL PRIMARY KEY,
            from_user_id INTEGER NOT NULL REFERENCES users(id),
            to_user_id INTEGER NOT NULL REFERENCES users(id),
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "friend_activities": """
        CREATE TABLE IF NOT EXISTS friend_activities (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            activity_type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "kudos": """
        CREATE TABLE IF NOT EXISTS kudos (
            id SERIAL PRIMARY KEY,
            activity_id INTEGER NOT NULL REFERENCES friend_activities(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            emoji VARCHAR(10) DEFAULT '👏',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "challenges": """
        CREATE TABLE IF NOT EXISTS challenges (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            challenge_type VARCHAR(50) NOT NULL,
            subject VARCHAR(100),
            difficulty VARCHAR(20) DEFAULT 'intermediate',
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NOT NULL,
            max_participants INTEGER,
            entry_fee_points INTEGER DEFAULT 0,
            prize_pool_points INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'upcoming',
            created_by_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "challenge_participations": """
        CREATE TABLE IF NOT EXISTS challenge_participations (
            id SERIAL PRIMARY KEY,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            score INTEGER DEFAULT 0,
            rank INTEGER,
            completed BOOLEAN DEFAULT FALSE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    """,
    
    "challenge_questions": """
        CREATE TABLE IF NOT EXISTS challenge_questions (
            id SERIAL PRIMARY KEY,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id),
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            explanation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "challenge_answers": """
        CREATE TABLE IF NOT EXISTS challenge_answers (
            id SERIAL PRIMARY KEY,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            question_id INTEGER NOT NULL REFERENCES challenge_questions(id),
            selected_answer INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """,
    
    "leaderboards": """
        CREATE TABLE IF NOT EXISTS leaderboards (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            category VARCHAR(50) NOT NULL,
            score INTEGER DEFAULT 0,
            rank INTEGER,
            period VARCHAR(20) DEFAULT 'weekly',
            period_start TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
}

def run_migration():
    """Run the migration to add missing tables"""
    print(f"\n{'='*60}")
    print("DATABASE MIGRATION - Adding Missing Tables (PostgreSQL)")
    print(f"{'='*60}\n")
    
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    existing_tables = inspector.get_table_names()
    print(f"📊 Found {len(existing_tables)} existing tables")
    
    print(f"\n{'='*60}")
    print("Creating missing tables...")
    print(f"{'='*60}\n")
    
    created = []
    skipped = []
    errors = []
    
    with engine.connect() as conn:
        for table_name, create_sql in TABLES.items():
            if table_name in existing_tables:
                skipped.append(table_name)
                print(f"   ⏭️  {table_name} (already exists)")
            else:
                try:
                    conn.execute(text(create_sql))
                    conn.commit()
                    created.append(table_name)
                    print(f"   ✅ {table_name} (created)")
                except Exception as e:
                    errors.append((table_name, str(e)))
                    print(f"   ❌ {table_name} (error: {e})")
    
    print(f"\n{'='*60}")
    print("MIGRATION SUMMARY")
    print(f"{'='*60}")
    print(f"   Tables created: {len(created)}")
    print(f"   Tables skipped: {len(skipped)}")
    print(f"   Errors: {len(errors)}")
    
    if created:
        print(f"\n   New tables:")
        for t in created:
            print(f"      + {t}")
    
    if errors:
        print(f"\n   Failed tables:")
        for t, e in errors:
            print(f"      ❌ {t}: {e}")
    
    print(f"\n✅ Migration completed!")

if __name__ == "__main__":
    run_migration()
