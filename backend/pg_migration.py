"""
Comprehensive PostgreSQL/SQLite migration that dynamically syncs ALL tables and columns
from SQLAlchemy models to the database. No hardcoding - introspects models automatically.
"""
import os
import sys
import re
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

# Fix for Render's postgres:// vs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_POSTGRES = "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL


def get_pg_type(sa_type):
    """Convert SQLAlchemy type to PostgreSQL type string"""
    type_str = str(sa_type).upper()
    
    if 'INTEGER' in type_str or 'BIGINT' in type_str or 'SMALLINT' in type_str:
        return 'INTEGER'
    elif 'BOOLEAN' in type_str:
        return 'BOOLEAN'
    elif 'FLOAT' in type_str or 'REAL' in type_str or 'DOUBLE' in type_str:
        return 'DOUBLE PRECISION'
    elif 'NUMERIC' in type_str or 'DECIMAL' in type_str:
        return 'NUMERIC'
    elif 'DATETIME' in type_str or 'TIMESTAMP' in type_str:
        return 'TIMESTAMP'
    elif 'DATE' in type_str:
        return 'DATE'
    elif 'TIME' in type_str:
        return 'TIME'
    elif 'TEXT' in type_str:
        return 'TEXT'
    elif 'JSON' in type_str:
        return 'TEXT'  #
    elif 'VARCHAR' in type_str or 'STRING' in type_str:
        match = re.search(r'\((\d+)\)', type_str)
        length = match.group(1) if match else '255'
        return f'VARCHAR({length})'
    else:
        return 'TEXT'


def get_sqlite_type(sa_type):
    """Convert SQLAlchemy type to SQLite type string"""
    type_str = str(sa_type).upper()
    
    if 'INTEGER' in type_str or 'BIGINT' in type_str or 'SMALLINT' in type_str:
        return 'INTEGER'
    elif 'BOOLEAN' in type_str:
        return 'INTEGER'  # SQLite uses INTEGER for boolean
    elif 'FLOAT' in type_str or 'REAL' in type_str or 'DOUBLE' in type_str or 'NUMERIC' in type_str:
        return 'REAL'
    elif 'DATETIME' in type_str or 'TIMESTAMP' in type_str or 'DATE' in type_str or 'TIME' in type_str:
        return 'TEXT'  # SQLite stores dates as TEXT
    elif 'JSON' in type_str:
        return 'TEXT'
    else:
        return 'TEXT'


def get_default_sql(column, is_postgres=True):
    """Get SQL DEFAULT clause for a column"""
    if column.default is None:
        return ""
    
    if hasattr(column.default, 'arg'):
        arg = column.default.arg
        if callable(arg):
            return ""  # Skip callable defaults (like datetime.utcnow)
        elif isinstance(arg, bool):
            if is_postgres:
                return f" DEFAULT {'TRUE' if arg else 'FALSE'}"
            else:
                return f" DEFAULT {1 if arg else 0}"
        elif isinstance(arg, (int, float)):
            return f" DEFAULT {arg}"
        elif isinstance(arg, str):
            return f" DEFAULT '{arg}'"
    return ""


def get_all_models():
    """Import and return all SQLAlchemy model classes"""
    from models import Base
    
    # Get all classes that inherit from Base
    models = []
    for mapper in Base.registry.mappers:
        model_class = mapper.class_
        if hasattr(model_class, '__tablename__'):
            models.append(model_class)
    
    return models


def get_db_columns(conn, table_name, is_postgres):
    """Get existing columns in a database table"""
    if is_postgres:
        result = conn.execute(text(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = :table_name
        """), {"table_name": table_name})
        return {row[0]: {'type': row[1], 'nullable': row[2]} for row in result}
    else:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return {row[1]: {'type': row[2], 'nullable': not row[3]} for row in result}


def table_exists(conn, table_name, is_postgres):
    """Check if a table exists in the database"""
    if is_postgres:
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            )
        """), {"table_name": table_name})
        return result.scalar()
    else:
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"
        ), {"table_name": table_name})
        return result.fetchone() is not None


def sync_table_columns(conn, model, is_postgres):
    """Sync columns for a single table - add any missing columns"""
    table_name = model.__tablename__
    
    # Check if table exists
    if not table_exists(conn, table_name, is_postgres):
        print(f"  ⚠️  Table {table_name} doesn't exist - will be created by SQLAlchemy")
        return 0
    
    # Get existing columns
    db_columns = get_db_columns(conn, table_name, is_postgres)
    
    # Get model columns
    model_columns = {col.name: col for col in model.__table__.columns}
    
    # Find missing columns
    missing = set(model_columns.keys()) - set(db_columns.keys())
    
    if not missing:
        return 0
    
    added = 0
    for col_name in missing:
        column = model_columns[col_name]
        
        # Get appropriate type
        if is_postgres:
            col_type = get_pg_type(column.type)
        else:
            col_type = get_sqlite_type(column.type)
        
        # Get default value
        default_clause = get_default_sql(column, is_postgres)
        
        # Build ALTER statement
        sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}{default_clause}"
        
        try:
            conn.execute(text(sql))
            print(f"  ✅ Added: {col_name} ({col_type})")
            added += 1
        except Exception as e:
            error_str = str(e).lower()
            if 'duplicate' in error_str or 'already exists' in error_str:
                print(f"  ✓ {col_name} already exists")
            else:
                print(f"  ❌ Error adding {col_name}: {e}")
    
    return added


def run_migration():
    """Run comprehensive migration - check ALL models and ALL columns"""
    print("=" * 60)
    print("🚀 COMPREHENSIVE DATABASE MIGRATION")
    print(f"📡 Database: {'PostgreSQL' if IS_POSTGRES else 'SQLite'}")
    print("=" * 60)
    
    engine = create_engine(DATABASE_URL)
    
    # First, let SQLAlchemy create any missing tables
    print("\n📋 Creating missing tables...")
    try:
        from models import Base
        Base.metadata.create_all(bind=engine)
        print("  ✅ All tables created/verified")
    except Exception as e:
        print(f"  ⚠️ Table creation warning: {e}")
    
    # Now sync columns for each model
    print("\n📋 Syncing columns for all tables...")
    
    models = get_all_models()
    total_added = 0
    
    with engine.connect() as conn:
        for model in sorted(models, key=lambda m: m.__tablename__):
            table_name = model.__tablename__
            print(f"\n🔍 {table_name}")
            
            try:
                added = sync_table_columns(conn, model, IS_POSTGRES)
                total_added += added
                
                if added == 0:
                    print(f"  ✓ All columns present")
                    
            except Exception as e:
                print(f"  ❌ Error: {e}")
        
        # Commit all changes
        conn.commit()
    
    print("\n" + "=" * 60)
    print(f"✅ MIGRATION COMPLETE - Added {total_added} columns")
    print("=" * 60)
    
    return total_added


if __name__ == '__main__':
    run_migration()
