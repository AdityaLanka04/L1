"""
Comprehensive migration to sync database schema with models
Checks all tables and adds missing columns
"""
import sqlite3
import os
from sqlalchemy import inspect
from models import engine, Base, User, ChatSession, ChatMessage, \
    Flashcard, Note, LearningReview, ReviewQuestion, UserStats, \
    ComprehensiveUserProfile, Friendship, FriendRequest, SharedContent, \
    Notification, Achievement, UserAchievement, Leaderboard, Challenge, \
    ChallengeParticipant, ConceptNode, ConceptConnection, KnowledgeRoadmap, RoadmapNode

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
    db_path = os.path.join(os.path.dirname(__file__), '..', 'brainwave_tutor.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return
    
    print(f"🔍 Syncing database schema: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List of all models to check
    models = [
        User, ChatSession, ChatMessage, QuizSession, QuizQuestion,
        Flashcard, Note, LearningReview, ReviewQuestion, UserStats,
        ActivityLog, ComprehensiveUserProfile, Friendship, FriendRequest,
        SharedContent, Notification, Achievement, UserAchievement,
        Leaderboard, Challenge, ChallengeParticipant, ConceptNode,
        ConceptEdge, KnowledgeRoadmap, RoadmapNode
    ]
    
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
