"""
Comprehensive migration to sync database schema with models
Creates all tables if they don't exist and adds missing columns
"""
import sqlite3
import os
from sqlalchemy import inspect, text
from models import engine, Base, User, ChatSession, ChatMessage, \
    Flashcard, FlashcardSet, Note, LearningReview, UserStats, \
    ComprehensiveUserProfile, Friendship, FriendRequest, \
    Notification, Achievement, UserAchievement, Leaderboard, Challenge, \
    ChallengeParticipation, ConceptNode, ConceptConnection, KnowledgeRoadmap, \
    Reminder, ReminderList
from database import DATABASE_URL

def get_model_columns(model):
    """Get all columns defined in a SQLAlchemy model"""
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
    """Get existing columns in database table"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return {row[1]: row for row in cursor.fetchall()}
    except sqlite3.OperationalError:
        return {}

def sync_table(cursor, model):
    """Sync a single table with its model - add missing columns"""
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

    possible_paths = [
        os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db'),
        os.path.join(os.path.dirname(__file__), 'brainwave.db'),
        os.path.join(os.path.dirname(__file__), '..', 'brainwave_tutor.db'),
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
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
        User, ChatSession, ChatMessage,
        Flashcard, FlashcardSet, Note, LearningReview, UserStats,
        ComprehensiveUserProfile, Friendship, FriendRequest,
        Notification, Achievement, UserAchievement,
        Leaderboard, Challenge, ChallengeParticipation, ConceptNode,
        ConceptConnection, KnowledgeRoadmap, Reminder, ReminderList
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
        },
    )

    add_missing_columns(
        "context_documents",
        {
            "source_name": "VARCHAR(200)",
            "license": "VARCHAR(80)",
            "curriculum": "VARCHAR(20)",
            "source_type": "VARCHAR(40)",
        },
    )

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

if __name__ == '__main__':
    run_migration()
