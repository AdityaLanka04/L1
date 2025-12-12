"""
Comprehensive migration to sync database schema with models
Checks all tables and adds missing columns
"""
import sqlite3
import os
from sqlalchemy import inspect
from models import engine, Base, User, ChatSession, ChatMessage, \
    Flashcard, Note, LearningReview, UserStats, \
    ComprehensiveUserProfile, Friendship, FriendRequest, \
    Notification, Achievement, UserAchievement, Leaderboard, Challenge, \
    ChallengeParticipation, ConceptNode, ConceptConnection, KnowledgeRoadmap, \
    Reminder, ReminderList

def get_model_columns(model):
    """Get all columns defined in a SQLAlchemy model"""
    columns = {}
    for column in model.__table__.columns:
        col_type = str(column.type)
        # Map SQLAlchemy types to SQLite types
        if 'INTEGER' in col_type or 'INT' in col_type:
            sqlite_type = 'INTEGER'
        elif 'BOOLEAN' in col_type or 'BOOL' in col_type:
            sqlite_type = 'BOOLEAN'
        elif 'FLOAT' in col_type or 'NUMERIC' in col_type or 'DECIMAL' in col_type:
            sqlite_type = 'REAL'
        elif 'DATETIME' in col_type or 'TIMESTAMP' in col_type:
            sqlite_type = 'DATETIME'
        elif 'TEXT' in col_type or 'CLOB' in col_type:
            sqlite_type = 'TEXT'
        else:
            sqlite_type = 'TEXT'  # Default to TEXT
        
        # Add default value if exists
        default = ''
        if column.default is not None:
            if hasattr(column.default, 'arg'):
                if callable(column.default.arg):
                    default = ''  # Skip callable defaults
                elif isinstance(column.default.arg, bool):
                    default = f' DEFAULT {1 if column.default.arg else 0}'
                elif isinstance(column.default.arg, (int, float)):
                    default = f' DEFAULT {column.default.arg}'
                elif isinstance(column.default.arg, str):
                    default = f' DEFAULT "{column.default.arg}"'
        
        nullable = '' if column.nullable else ' NOT NULL'
        columns[column.name] = f'{sqlite_type}{default}{nullable}'
    
    return columns

def get_db_columns(cursor, table_name):
    """Get existing columns in database table"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return {row[1]: row for row in cursor.fetchall()}
    except sqlite3.OperationalError:
        return {}

def sync_table(cursor, model):
    """Sync a single table with its model"""
    table_name = model.__tablename__
    print(f"\n📋 Checking table: {table_name}")
    
    model_columns = get_model_columns(model)
    db_columns = get_db_columns(cursor, table_name)
    
    if not db_columns:
        print(f"  ⚠️  Table {table_name} doesn't exist - skipping")
        return
    
    missing_columns = set(model_columns.keys()) - set(db_columns.keys())
    
    if not missing_columns:
        print(f"  ✅ All columns present")
        return
    
    print(f"  🔧 Adding {len(missing_columns)} missing columns:")
    for column_name in missing_columns:
        column_def = model_columns[column_name]
        print(f"     - {column_name} ({column_def})")
        try:
            cursor.execute(f"""
                ALTER TABLE {table_name} 
                ADD COLUMN {column_name} {column_def}
            """)
        except sqlite3.OperationalError as e:
            print(f"     ❌ Error adding {column_name}: {e}")

def run_migration():
    # Check multiple possible database locations (prioritize brainwave_tutor.db)
    possible_paths = [
        os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db'),  # backend/brainwave_tutor.db (PRIMARY)
        os.path.join(os.path.dirname(__file__), 'brainwave.db'),  # backend/brainwave.db
        os.path.join(os.path.dirname(__file__), '..', 'brainwave_tutor.db'),  # root/brainwave_tutor.db
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print(f"❌ Database not found in any of: {possible_paths}")
        return
    
    print(f"🔍 Syncing database schema: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List of all models to check
    models = [
        User, ChatSession, ChatMessage,
        Flashcard, Note, LearningReview, UserStats,
        ComprehensiveUserProfile, Friendship, FriendRequest,
        Notification, Achievement, UserAchievement,
        Leaderboard, Challenge, ChallengeParticipation, ConceptNode,
        ConceptConnection, KnowledgeRoadmap, Reminder, ReminderList
    ]
    
    # Create new tables if they don't exist
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reminder_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#3b82f6',
                icon TEXT DEFAULT 'list',
                is_smart_list BOOLEAN DEFAULT 0,
                smart_list_type TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("✅ reminder_lists table ready")
    except Exception as e:
        print(f"⚠️ reminder_lists: {e}")
    
    # Check if reminders table exists and add missing columns
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reminders'")
    reminders_exists = cursor.fetchone() is not None
    
    if reminders_exists:
        print("📋 Updating existing reminders table with new columns...")
        new_reminder_columns = [
            ("list_id", "INTEGER"),
            ("parent_id", "INTEGER"),
            ("notes", "TEXT"),
            ("url", "TEXT"),
            ("due_date", "DATETIME"),
            ("completed_at", "DATETIME"),
            ("is_flagged", "BOOLEAN DEFAULT 0"),
            ("recurring", "TEXT DEFAULT 'none'"),
            ("recurring_interval", "INTEGER DEFAULT 1"),
            ("recurring_end_date", "DATETIME"),
            ("recurring_days", "TEXT"),
            ("location", "TEXT"),
            ("location_reminder", "BOOLEAN DEFAULT 0"),
            ("tags", "TEXT"),
            ("sort_order", "INTEGER DEFAULT 0"),
        ]
        
        for col_name, col_type in new_reminder_columns:
            try:
                cursor.execute(f"ALTER TABLE reminders ADD COLUMN {col_name} {col_type}")
                print(f"  ✅ Added column: {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    pass  # Column already exists
                else:
                    print(f"  ⚠️ {col_name}: {e}")
    else:
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    list_id INTEGER,
                    parent_id INTEGER,
                    title TEXT NOT NULL,
                    description TEXT,
                    notes TEXT,
                    url TEXT,
                    reminder_date DATETIME,
                    due_date DATETIME,
                    reminder_type TEXT DEFAULT 'reminder',
                    priority TEXT DEFAULT 'none',
                    color TEXT DEFAULT '#3b82f6',
                    is_completed BOOLEAN DEFAULT 0,
                    completed_at DATETIME,
                    is_flagged BOOLEAN DEFAULT 0,
                    is_notified BOOLEAN DEFAULT 0,
                    notify_before_minutes INTEGER DEFAULT 15,
                    recurring TEXT DEFAULT 'none',
                    recurring_interval INTEGER DEFAULT 1,
                    recurring_end_date DATETIME,
                    recurring_days TEXT,
                    location TEXT,
                    location_reminder BOOLEAN DEFAULT 0,
                    tags TEXT,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (list_id) REFERENCES reminder_lists(id),
                    FOREIGN KEY (parent_id) REFERENCES reminders(id)
                )
            """)
            print("✅ reminders table created")
        except Exception as e:
            print(f"⚠️ reminders: {e}")

    # Create friendships table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (friend_id) REFERENCES users(id)
            )
        """)
        print("✅ friendships table ready")
    except Exception as e:
        print(f"⚠️ friendships: {e}")

    # Create friend_requests table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (receiver_id) REFERENCES users(id)
            )
        """)
        print("✅ friend_requests table ready")
    except Exception as e:
        print(f"⚠️ friend_requests: {e}")

    # Create notifications table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                notification_type TEXT DEFAULT 'general',
                is_read BOOLEAN DEFAULT 0,
                action_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("✅ notifications table ready")
    except Exception as e:
        print(f"⚠️ notifications: {e}")

    # Create leaderboards table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leaderboards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category TEXT DEFAULT 'global',
                metric TEXT DEFAULT 'total_hours',
                score REAL DEFAULT 0,
                rank INTEGER,
                period TEXT DEFAULT 'all_time',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("✅ leaderboards table ready")
    except Exception as e:
        print(f"⚠️ leaderboards: {e}")

    # Create challenges table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                creator_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                challenge_type TEXT DEFAULT 'quiz',
                difficulty TEXT DEFAULT 'medium',
                subject TEXT,
                question_count INTEGER DEFAULT 10,
                time_limit_minutes INTEGER DEFAULT 30,
                start_date DATETIME,
                end_date DATETIME,
                is_public BOOLEAN DEFAULT 1,
                max_participants INTEGER,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(id)
            )
        """)
        print("✅ challenges table ready")
    except Exception as e:
        print(f"⚠️ challenges: {e}")

    # Create challenge_participations table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS challenge_participations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                challenge_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                score REAL DEFAULT 0,
                time_taken_seconds INTEGER,
                completed_at DATETIME,
                rank INTEGER,
                status TEXT DEFAULT 'joined',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (challenge_id) REFERENCES challenges(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("✅ challenge_participations table ready")
    except Exception as e:
        print(f"⚠️ challenge_participations: {e}")

    # Create concept_nodes table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS concept_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                concept_name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                importance_score REAL DEFAULT 0.5,
                mastery_level REAL DEFAULT 0,
                position_x REAL,
                position_y REAL,
                notes_count INTEGER DEFAULT 0,
                quizzes_count INTEGER DEFAULT 0,
                flashcards_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("✅ concept_nodes table ready")
    except Exception as e:
        print(f"⚠️ concept_nodes: {e}")

    # Create concept_connections table
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS concept_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                source_concept_id INTEGER NOT NULL,
                target_concept_id INTEGER NOT NULL,
                connection_type TEXT,
                strength REAL DEFAULT 0.5,
                ai_generated BOOLEAN DEFAULT 0,
                user_confirmed BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (source_concept_id) REFERENCES concept_nodes(id),
                FOREIGN KEY (target_concept_id) REFERENCES concept_nodes(id)
            )
        """)
        print("✅ concept_connections table ready")
    except Exception as e:
        print(f"⚠️ concept_connections: {e}")
    
    try:
        for model in models:
            sync_table(cursor, model)
        
        conn.commit()
        print("\n✅ Schema sync completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
