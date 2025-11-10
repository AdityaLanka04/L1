"""
Comprehensive database column checker and fixer
Compares models.py with actual database schema and adds missing columns
"""
import sqlite3
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.models import Base
from sqlalchemy import inspect, create_engine

DATABASE_PATH = "brainwave_tutor.db"

def get_model_columns(model_class):
    """Get all columns defined in a SQLAlchemy model"""
    columns = {}
    for column in model_class.__table__.columns:
        col_type = str(column.type)
        nullable = column.nullable
        default = column.default
        columns[column.name] = {
            'type': col_type,
            'nullable': nullable,
            'default': default
        }
    return columns

def get_db_columns(table_name):
    """Get all columns that exist in the database table"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    rows = cursor.fetchall()
    conn.close()
    
    columns = {}
    for row in rows:
        # row format: (cid, name, type, notnull, dflt_value, pk)
        columns[row[1]] = {
            'type': row[2],
            'nullable': not bool(row[3]),
            'default': row[4]
        }
    return columns

def sqlalchemy_to_sqlite_type(sa_type):
    """Convert SQLAlchemy type to SQLite type"""
    sa_type = sa_type.upper()
    
    if 'VARCHAR' in sa_type or 'TEXT' in sa_type or 'STRING' in sa_type:
        return 'TEXT'
    elif 'INTEGER' in sa_type or 'BIGINT' in sa_type:
        return 'INTEGER'
    elif 'FLOAT' in sa_type or 'NUMERIC' in sa_type or 'DECIMAL' in sa_type:
        return 'REAL'
    elif 'BOOLEAN' in sa_type or 'BOOL' in sa_type:
        return 'INTEGER'
    elif 'DATETIME' in sa_type or 'TIMESTAMP' in sa_type or 'DATE' in sa_type:
        return 'DATETIME'
    elif 'JSON' in sa_type:
        return 'TEXT'
    else:
        return 'TEXT'

def add_missing_columns():
    """Check all models and add missing columns to database"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Get all tables from database
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    db_tables = [row[0] for row in cursor.fetchall()]
    
    print("=" * 70)
    print("DATABASE COLUMN CHECKER AND FIXER")
    print("=" * 70)
    print(f"Database: {DATABASE_PATH}")
    print(f"Tables in database: {len(db_tables)}")
    print("=" * 70)
    
    total_missing = 0
    total_added = 0
    errors = []
    
    # Check each model
    for model_name, model_class in Base.registry._class_registry.items():
        if model_name == '_sa_module_registry' or not hasattr(model_class, '__tablename__'):
            continue
        
        table_name = model_class.__tablename__
        
        if table_name not in db_tables:
            print(f"\n⚠️  Table '{table_name}' doesn't exist in database - skipping")
            continue
        
        # Get columns from model and database
        model_columns = get_model_columns(model_class)
        db_columns = get_db_columns(table_name)
        
        # Find missing columns
        missing_columns = set(model_columns.keys()) - set(db_columns.keys())
        
        if missing_columns:
            print(f"\n📋 Table: {table_name}")
            print(f"   Missing columns: {len(missing_columns)}")
            total_missing += len(missing_columns)
            
            for col_name in missing_columns:
                col_info = model_columns[col_name]
                col_type = sqlalchemy_to_sqlite_type(col_info['type'])
                
                # Build ALTER TABLE statement
                alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                
                # Add NULL/NOT NULL
                if not col_info['nullable']:
                    # For NOT NULL columns, we need a default value
                    if col_type == 'INTEGER':
                        alter_sql += " DEFAULT 0"
                    elif col_type == 'TEXT':
                        alter_sql += " DEFAULT ''"
                    elif col_type == 'REAL':
                        alter_sql += " DEFAULT 0.0"
                    elif col_type == 'DATETIME':
                        alter_sql += " DEFAULT CURRENT_TIMESTAMP"
                
                try:
                    print(f"   ➕ Adding: {col_name} ({col_type})")
                    cursor.execute(alter_sql)
                    total_added += 1
                    print(f"      ✅ Success")
                except Exception as e:
                    error_msg = f"Failed to add {table_name}.{col_name}: {str(e)}"
                    errors.append(error_msg)
                    print(f"      ❌ Error: {str(e)}")
        else:
            print(f"✅ {table_name}: All columns present")
    
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total missing columns found: {total_missing}")
    print(f"Total columns added: {total_added}")
    print(f"Errors: {len(errors)}")
    
    if errors:
        print("\n❌ ERRORS:")
        for error in errors:
            print(f"   - {error}")
    
    if total_added > 0:
        print("\n✅ Database updated successfully!")
        print("   Please restart your backend server.")
    else:
        print("\n✅ Database is up to date!")
    
    print("=" * 70)

if __name__ == "__main__":
    try:
        add_missing_columns()
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
