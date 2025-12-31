"""
Comprehensive PostgreSQL/SQLite migration that dynamically syncs ALL tables and columns
from SQLAlchemy models to the database. Properly introspects all models including
those with relationships and foreign keys.
"""
import os
import sys
import re
from sqlalchemy import create_engine, text, inspect, MetaData
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
    type_name = type(sa_type).__name__.upper()
    type_str = str(sa_type).upper()
    
    if type_name in ('INTEGER', 'BIGINTEGER', 'SMALLINTEGER') or 'INTEGER' in type_str:
        return 'INTEGER'
    elif type_name == 'BOOLEAN' or 'BOOLEAN' in type_str:
        return 'BOOLEAN'
    elif type_name in ('FLOAT', 'REAL', 'DOUBLE', 'NUMERIC') or any(x in type_str for x in ['FLOAT', 'REAL', 'DOUBLE']):
        return 'DOUBLE PRECISION'
    elif 'NUMERIC' in type_str or 'DECIMAL' in type_str:
        return 'NUMERIC'
    elif type_name == 'DATETIME' or 'DATETIME' in type_str or 'TIMESTAMP' in type_str:
        return 'TIMESTAMP'
    elif type_name == 'DATE' or type_str == 'DATE':
        return 'DATE'
    elif type_name == 'TIME' or type_str == 'TIME':
        return 'TIME'
    elif type_name == 'TEXT' or 'TEXT' in type_str:
        return 'TEXT'
    elif type_name == 'JSON' or 'JSON' in type_str:
        return 'TEXT'
    elif type_name in ('VARCHAR', 'STRING') or 'VARCHAR' in type_str or 'STRING' in type_str:
        match = re.search(r'\((\d+)\)', type_str)
        length = match.group(1) if match else '255'
        return f'VARCHAR({length})'
    else:
        return 'TEXT'


def get_sqlite_type(sa_type):
    """Convert SQLAlchemy type to SQLite type string"""
    type_name = type(sa_type).__name__.upper()
    type_str = str(sa_type).upper()
    
    if type_name in ('INTEGER', 'BIGINTEGER', 'SMALLINTEGER') or 'INTEGER' in type_str:
        return 'INTEGER'
    elif type_name == 'BOOLEAN' or 'BOOLEAN' in type_str:
        return 'INTEGER'
    elif type_name in ('FLOAT', 'REAL', 'DOUBLE', 'NUMERIC') or any(x in type_str for x in ['FLOAT', 'REAL', 'DOUBLE', 'NUMERIC']):
        return 'REAL'
    elif any(x in type_str for x in ['DATETIME', 'TIMESTAMP', 'DATE', 'TIME']):
        return 'TEXT'
    elif type_name == 'JSON' or 'JSON' in type_str:
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
            return ""
        elif isinstance(arg, bool):
            if is_postgres:
                return f" DEFAULT {'TRUE' if arg else 'FALSE'}"
            else:
                return f" DEFAULT {1 if arg else 0}"
        elif isinstance(arg, (int, float)):
            return f" DEFAULT {arg}"
        elif isinstance(arg, str):
            escaped = arg.replace("'", "''")
            return f" DEFAULT '{escaped}'"
    return ""


def get_all_models_from_base(Base):
    """Get all model classes from Base registry"""
    models = []
    
    # Method 1: From registry mappers
    if hasattr(Base, 'registry') and hasattr(Base.registry, 'mappers'):
        for mapper in Base.registry.mappers:
            model_class = mapper.class_
            if hasattr(model_class, '__tablename__') and hasattr(model_class, '__table__'):
                models.append(model_class)
    
    # Method 2: From metadata tables (backup)
    if hasattr(Base, 'metadata'):
        for table in Base.metadata.tables.values():
            # Find the class that owns this table
            for mapper in Base.registry.mappers:
                if hasattr(mapper.class_, '__table__') and mapper.class_.__table__ is table:
                    if mapper.class_ not in models:
                        models.append(mapper.class_)
    
    return models


def get_db_tables(conn, is_postgres):
    """Get all existing tables in the database"""
    if is_postgres:
        result = conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        return {row[0] for row in result}
    else:
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ))
        return {row[0] for row in result}


def get_db_columns(conn, table_name, is_postgres):
    """Get existing columns in a database table"""
    if is_postgres:
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = :table_name
        """), {"table_name": table_name})
        return {row[0].lower(): {'type': row[1], 'nullable': row[2]} for row in result}
    else:
        result = conn.execute(text(f"PRAGMA table_info(`{table_name}`)"))
        return {row[1].lower(): {'type': row[2], 'nullable': not row[3]} for row in result}


def table_exists(conn, table_name, is_postgres):
    """Check if a table exists in the database"""
    if is_postgres:
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = :table_name
            )
        """), {"table_name": table_name})
        return result.scalar()
    else:
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"
        ), {"table_name": table_name})
        return result.fetchone() is not None


def add_column(conn, table_name, col_name, col_type, default_clause, is_postgres):
    """Add a column to a table with proper error handling"""
    sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {col_type}{default_clause}'
    
    try:
        conn.execute(text(sql))
        return True, None
    except Exception as e:
        error_str = str(e).lower()
        if 'duplicate' in error_str or 'already exists' in error_str:
            return False, "exists"
        return False, str(e)


def sync_table_columns(conn, model, is_postgres):
    """Sync columns for a single table - add any missing columns"""
    table_name = model.__tablename__
    
    if not table_exists(conn, table_name, is_postgres):
        print(f"    Table doesn't exist - will be created")
        return 0, []
    
    db_columns = get_db_columns(conn, table_name, is_postgres)
    db_column_names = set(db_columns.keys())
    
    # Get model columns from __table__
    model_columns = {}
    for col in model.__table__.columns:
        model_columns[col.name.lower()] = col
    
    model_column_names = set(model_columns.keys())
    missing = model_column_names - db_column_names
    
    if not missing:
        return 0, []
    
    added = 0
    errors = []
    
    for col_name in sorted(missing):
        column = model_columns[col_name]
        
        if is_postgres:
            col_type = get_pg_type(column.type)
        else:
            col_type = get_sqlite_type(column.type)
        
        default_clause = get_default_sql(column, is_postgres)
        
        success, error = add_column(conn, table_name, column.name, col_type, default_clause, is_postgres)
        
        if success:
            print(f"   Added: {column.name} ({col_type})")
            added += 1
        elif error == "exists":
            print(f"  ✓ {column.name} already exists")
        else:
            print(f"   Error adding {column.name}: {error}")
            errors.append((column.name, error))
    
    return added, errors


def run_migration():
    """Run comprehensive migration - check ALL models and ALL columns"""
    print("=" * 60)
    print(" COMPREHENSIVE DATABASE MIGRATION")
    print(f" Database: {'PostgreSQL' if IS_POSTGRES else 'SQLite'}")
    print(f"🔗 URL: {DATABASE_URL[:50]}...")
    print("=" * 60)
    
    engine = create_engine(DATABASE_URL)
    
    # Import models
    print("\n Loading models...")
    try:
        from models import Base
        models = get_all_models_from_base(Base)
        print(f"  Found {len(models)} model classes")
    except Exception as e:
        print(f"   Error loading models: {e}")
        return -1
    
    # Create missing tables first
    print("\n📋 Creating missing tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("   All tables created/verified")
    except Exception as e:
        print(f"   Table creation warning: {e}")
    
    # Sync columns
    print("\n📋 Syncing columns for all tables...")
    
    total_added = 0
    total_errors = []
    tables_processed = 0
    
    with engine.connect() as conn:
        # Sort models by table name for consistent output
        sorted_models = sorted(models, key=lambda m: m.__tablename__)
        
        for model in sorted_models:
            table_name = model.__tablename__
            tables_processed += 1
            
            # Count expected vs actual columns
            model_col_count = len(model.__table__.columns)
            db_columns = get_db_columns(conn, table_name, IS_POSTGRES)
            db_col_count = len(db_columns)
            
            print(f"\n {table_name} (model: {model_col_count} cols, db: {db_col_count} cols)")
            
            try:
                added, errors = sync_table_columns(conn, model, IS_POSTGRES)
                total_added += added
                total_errors.extend([(table_name, e) for e in errors])
                
                if added == 0 and not errors:
                    print(f"  ✓ All columns present")
                    
            except Exception as e:
                print(f"   Error: {e}")
                total_errors.append((table_name, str(e)))
        
        conn.commit()
    
    # Summary
    print("\n" + "=" * 60)
    print(f" MIGRATION COMPLETE")
    print(f"   Tables processed: {tables_processed}")
    print(f"   Columns added: {total_added}")
    if total_errors:
        print(f"   Errors: {len(total_errors)}")
        for table, error in total_errors:
            print(f"     - {table}: {error}")
    print("=" * 60)
    
    return total_added


if __name__ == '__main__':
    run_migration()
