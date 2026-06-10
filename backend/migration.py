import sqlite3
import os
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from models import engine, Base, User, ChatSession, ChatMessage, ChatTutorState, \
    Flashcard, FlashcardSet, Note, LearningReview, UserStats, \
    ComprehensiveUserProfile, PasswordResetOTP, RegistrationOTP, AccountDeletionOTP, Friendship, FriendRequest, \
    Notification, Achievement, UserAchievement, Leaderboard, Challenge, \
    ChallengeParticipation, ConceptNode, ConceptConnection, KnowledgeRoadmap, AIJob, \
    Reminder, ReminderList, UserGamificationStats, PointTransaction
from database import DATABASE_URL

def get_model_columns(model):
    columns = {}
    for column in model.__table__.columns:
        col_type = str(column.type)
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
            sqlite_type = 'TEXT'
        
        default = ''
        if column.default is not None:
            if hasattr(column.default, 'arg'):
                if callable(column.default.arg):
                    default = ''
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
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return {row[1]: row for row in cursor.fetchall()}
    except sqlite3.OperationalError:
        return {}

def sync_table(cursor, model):
    table_name = model.__tablename__
    print(f"\n📋 Checking table: {table_name}")
    
    model_columns = get_model_columns(model)
    db_columns = get_db_columns(cursor, table_name)
    
    if not db_columns:
        print(f"    Table {table_name} doesn't exist - will be created by SQLAlchemy")
        return
    
    missing_columns = set(model_columns.keys()) - set(db_columns.keys())
    
    if not missing_columns:
        print(f"   All columns present")
        return
    
    print(f"   Adding {len(missing_columns)} missing columns:")
    for column_name in missing_columns:
        column_def = model_columns[column_name]
        print(f"     - {column_name} ({column_def})")
        try:
            cursor.execute(f"""
                ALTER TABLE {table_name} 
                ADD COLUMN {column_name} {column_def}
            """)
        except sqlite3.OperationalError as e:
            print(f"      Error adding {column_name}: {e}")

def run_migration():
    if "postgres" in DATABASE_URL.lower():
        _run_postgres_migration()
        return

    db_path = None
    try:
        sqlite_path = make_url(DATABASE_URL).database
        if sqlite_path and sqlite_path != ":memory:":
            db_path = sqlite_path if os.path.isabs(sqlite_path) else os.path.abspath(sqlite_path)
    except Exception:
        db_path = None

    possible_paths = []
    if db_path:
        possible_paths.append(db_path)
    possible_paths.extend([
        os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db'),
        os.path.join(os.path.dirname(__file__), 'brainwave.db'),
        os.path.join(os.path.dirname(__file__), '..', 'brainwave_tutor.db'),
    ])

    db_path = next((path for path in possible_paths if os.path.exists(path)), db_path)

    if not db_path:
        db_path = possible_paths[0]
        print(f"📁 Creating new database: {db_path}")
        open(db_path, 'a').close()
    
    print(f" Syncing database schema: {db_path}")
    
    print("\n🏗️  Creating all tables using SQLAlchemy...")
    try:
        Base.metadata.create_all(bind=engine)
        print(" All tables created/verified by SQLAlchemy")
    except Exception as e:
        print(f" SQLAlchemy table creation warning: {e}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    models = [
        User, ChatSession, ChatMessage, ChatTutorState, AIJob,
        Flashcard, FlashcardSet, Note, LearningReview, UserStats,
        ComprehensiveUserProfile, PasswordResetOTP, RegistrationOTP, AccountDeletionOTP, Friendship, FriendRequest,
        Notification, Achievement, UserAchievement,
        Leaderboard, Challenge, ChallengeParticipation, ConceptNode,
        ConceptConnection, KnowledgeRoadmap, Reminder, ReminderList,
        UserGamificationStats, PointTransaction
    ]
    
    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN share_code TEXT")
        print(" Added share_code column to flashcard_sets")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            pass
        else:
            print(f" share_code column: {e}")
    
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcard_sets_share_code ON flashcard_sets(share_code)")
        print(" Created index for share_code")
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f" share_code index: {e}")
    
    try:
        cursor.execute("ALTER TABLE comprehensive_user_profiles ADD COLUMN show_study_insights BOOLEAN DEFAULT 1")
        print(" Added show_study_insights column to comprehensive_user_profiles")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            pass
        else:
            print(f" show_study_insights column: {e}")
    
    try:
        import random
        import string
        
        cursor.execute("SELECT id FROM flashcard_sets WHERE share_code IS NULL OR share_code = ''")
        sets_without_code = cursor.fetchall()
        
        if sets_without_code:
            print(f" Generating share codes for {len(sets_without_code)} flashcard sets...")
            for (set_id,) in sets_without_code:
                while True:
                    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                    cursor.execute("SELECT id FROM flashcard_sets WHERE share_code = ?", (code,))
                    if not cursor.fetchone():
                        break
                cursor.execute("UPDATE flashcard_sets SET share_code = ? WHERE id = ?", (code, set_id))
            print(f" Generated share codes for {len(sets_without_code)} flashcard sets")
    except Exception as e:
        print(f" share code generation: {e}")
    
    try:
        for model in models:
            sync_table(cursor, model)
        
        conn.commit()
        print("\n Schema sync completed successfully!")
        
    except Exception as e:
        print(f"\n Migration failed: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

def _run_postgres_migration():
    print(" Syncing PostgreSQL schema")
    try:
        Base.metadata.create_all(bind=engine)
        print(" All tables created/verified by SQLAlchemy")
    except Exception as e:
        print(f" SQLAlchemy table creation warning: {e}")

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    def add_missing_columns(table_name, columns):
        if table_name not in tables:
            return
        existing = {c["name"] for c in inspector.get_columns(table_name)}
        with engine.connect() as conn:
            for column_name, column_def in columns.items():
                if column_name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"))
                print(f" Added column {table_name}.{column_name}")
            conn.commit()

    def widen_column_to_text(table_name, column_name):
        if table_name not in tables:
            return
        columns = {c["name"]: c for c in inspector.get_columns(table_name)}
        column = columns.get(column_name)
        if not column:
            return
        if column["type"].__class__.__name__.upper() == "TEXT":
            return
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} TYPE TEXT"))
            conn.commit()
            print(f" Widened {table_name}.{column_name} to TEXT")

    widen_column_to_text("users", "picture_url")

    add_missing_columns(
        "flashcards",
        {
            "ease_factor": "DOUBLE PRECISION DEFAULT 2.5",
            "interval": "DOUBLE PRECISION DEFAULT 0",
            "repetitions": "INTEGER DEFAULT 0",
            "next_review_date": "TIMESTAMP",
            "lapses": "INTEGER DEFAULT 0",
            "sr_state": "VARCHAR(20) DEFAULT 'new'",
            "learning_step": "INTEGER DEFAULT 0",
            "fsrs_stability": "DOUBLE PRECISION DEFAULT 0.0",
        },
    )

    add_missing_columns(
        "flashcard_sets",
        {
            "share_code": "VARCHAR(6)",
        },
    )

    add_missing_columns(
        "comprehensive_user_profiles",
        {
            "show_study_insights": "BOOLEAN DEFAULT TRUE",
            "notifications_enabled": "BOOLEAN DEFAULT TRUE",
            "subscription_tier": "VARCHAR(30) DEFAULT 'starter'",
            "billing_cycle": "VARCHAR(20) DEFAULT 'monthly'",
            "subscription_status": "VARCHAR(20) DEFAULT 'active'",
            "subscription_started_at": "TIMESTAMP",
            "stripe_customer_id": "VARCHAR(120)",
            "stripe_subscription_id": "VARCHAR(120)",
            "stripe_price_id": "VARCHAR(120)",
            "stripe_checkout_session_id": "VARCHAR(120)",
            "billing_currency": "VARCHAR(12)",
            "current_period_end": "TIMESTAMP",
            "cancel_at_period_end": "BOOLEAN DEFAULT FALSE",
        },
    )

    add_missing_columns(
        "notes",
        {
            "is_public": "BOOLEAN DEFAULT FALSE",
            "is_deleted": "BOOLEAN DEFAULT FALSE",
            "deleted_at": "TIMESTAMP",
            "is_favorite": "BOOLEAN DEFAULT FALSE",
            "custom_font": "VARCHAR(50) DEFAULT 'Inter'",
            "transcript": "TEXT",
            "analysis": "TEXT",
            "flashcards": "TEXT",
            "quiz_questions": "TEXT",
            "key_moments": "TEXT",
            "media_file_id": "INTEGER",
        },
    )

    add_missing_columns(
        "chat_messages",
        {
            "image_metadata": "TEXT",
        },
    )

    add_missing_columns(
        "chat_tutor_states",
        {
            "current_step": "INTEGER DEFAULT 1",
            "total_steps": "INTEGER DEFAULT 0",
            "expected_step_answer": "TEXT",
            "final_answer": "TEXT",
            "skills_used": "JSONB",
            "misconceptions": "JSONB",
            "mastery_score": "DOUBLE PRECISION DEFAULT 0.0",
            "correct_streak": "INTEGER DEFAULT 0",
            "wrong_streak": "INTEGER DEFAULT 0",
            "lesson_plan": "JSONB",
        },
    )

    add_missing_columns(
        "context_documents",
        {
            "source_name": "VARCHAR(200)",
            "license": "VARCHAR(80)",
            "curriculum": "VARCHAR(20)",
            "source_type": "VARCHAR(40)",
            "folder_id": "INTEGER",
            "ai_summary": "TEXT",
            "key_concepts": "TEXT",
            "topic_tags": "TEXT",
        },
    )

    add_missing_columns(
        "podcast_sessions",
        {
            "voice_persona": "VARCHAR(50) DEFAULT 'mentor'",
            "difficulty": "VARCHAR(20) DEFAULT 'intermediate'",
            "answer_language": "VARCHAR(20) DEFAULT 'en'",
            "session_options": "TEXT DEFAULT '{}'",
        },
    )

    add_missing_columns(
        "student_style_models",
        {
            "student_classifier_state": "TEXT",
        },
    )

    add_missing_columns(
        "user_gamification_stats",
        {
            "weekly_chat_goal": "INTEGER DEFAULT 10",
            "weekly_note_goal": "INTEGER DEFAULT 5",
            "weekly_flashcard_goal": "INTEGER DEFAULT 20",
            "weekly_quiz_goal": "INTEGER DEFAULT 5",
            "freeze_charges": "INTEGER DEFAULT 0",
            "revive_charges": "INTEGER DEFAULT 0",
            "xp_boost_until": "DATETIME",
            "xp_boost_multiplier": "FLOAT DEFAULT 1.0",
            "xp_boost_uses": "INTEGER DEFAULT 0",
            "vault_rewards_claimed": "INTEGER DEFAULT 0",
            "powerups_initialized": "BOOLEAN DEFAULT FALSE",
        },
    )

    for otp_table in ("password_reset_otps", "registration_otps", "account_deletion_otps"):
        if otp_table not in tables:
            continue
        with engine.connect() as conn:
            for idx_name, column_name in (
                (f"ix_{otp_table}_email", "email"),
                (f"ix_{otp_table}_username", "username"),
            ):
                if column_name == "username" and otp_table in ("password_reset_otps", "account_deletion_otps"):
                    continue
                try:
                    conn.execute(text(
                        f"CREATE INDEX IF NOT EXISTS {idx_name} ON {otp_table}({column_name})"
                    ))
                except Exception:
                    pass
            if otp_table in ("password_reset_otps", "account_deletion_otps"):
                try:
                    conn.execute(text(
                        f"CREATE INDEX IF NOT EXISTS ix_{otp_table}_user_id ON {otp_table}(user_id)"
                    ))
                except Exception:
                    pass
            try:
                conn.commit()
                print(f" {otp_table} indexes created/verified")
            except Exception as e:
                print(f" {otp_table} index commit error: {e}")

    if "flashcard_sets" in tables:
        with engine.connect() as conn:
            try:
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcard_sets_share_code "
                        "ON flashcard_sets(share_code)"
                    )
                )
                conn.commit()
                print(" Created index for flashcard_sets.share_code")
            except Exception as e:
                print(f" share_code index: {e}")

    _user_id_indexes = [
        ("ix_activities_user_id",              "activities",             "user_id"),
        ("ix_chat_sessions_user_id",           "chat_sessions",          "user_id"),
        ("ix_chat_messages_user_id",           "chat_messages",          "user_id"),
        ("ix_chat_tutor_states_user_id",       "chat_tutor_states",      "user_id"),
        ("ix_notes_user_id",                   "notes",                  "user_id"),
        ("ix_flashcard_sets_user_id",          "flashcard_sets",         "user_id"),
        ("ix_flashcards_user_id",              "flashcards",             "user_id"),
        ("ix_question_sets_user_id",           "question_sets",          "user_id"),
        ("ix_uploaded_slides_user_id",         "uploaded_slides",        "user_id"),
        ("ix_solo_quizzes_user_id",            "solo_quizzes",           "user_id"),
        ("ix_daily_learning_metrics_user_id",  "daily_learning_metrics", "user_id"),
        ("ix_folders_user_id",                 "folders",                "user_id"),
        ("ix_playlists_user_id",               "playlists",              "user_id"),
        ("ix_reminders_user_id",               "reminders",              "user_id"),
        ("ix_learning_reviews_user_id",        "learning_reviews",       "user_id"),
        ("ix_roadmaps_user_id",                "roadmaps",               "user_id"),
        ("ix_learning_paths_user_id",          "learning_paths",         "user_id"),
        ("ix_notifications_user_id",           "notifications",          "user_id"),
        ("ix_friendships_user_id",             "friendships",            "user_id"),
        ("ix_friendships_friend_id",           "friendships",            "friend_id"),
        ("ix_friend_requests_sender_id",       "friend_requests",        "sender_id"),
        ("ix_friend_requests_receiver_id",     "friend_requests",        "receiver_id"),
        ("ix_student_knowledge_states_uid",    "student_knowledge_states", "user_id"),
    ]
    with engine.connect() as conn:
        for idx_name, tbl, col in _user_id_indexes:
            if tbl not in tables:
                continue
            try:
                conn.execute(text(
                    f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl}({col})"
                ))
            except Exception:
                pass
        try:
            conn.commit()
            print(" user_id performance indexes created/verified")
        except Exception as e:
            print(f" user_id index commit error: {e}")

if __name__ == '__main__':
    run_migration()
