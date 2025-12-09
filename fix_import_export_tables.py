"""
Fix import/export tables - rename metadata columns
"""

import sqlite3

def fix_tables():
    conn = sqlite3.connect('backend/brainwave_tutor.db')
    cursor = conn.cursor()
    
    print("🔄 Fixing import/export tables...")
    
    # Drop existing tables
    print("Dropping old tables...")
    cursor.execute("DROP TABLE IF EXISTS import_export_history")
    cursor.execute("DROP TABLE IF EXISTS exported_files")
    cursor.execute("DROP TABLE IF EXISTS batch_operations")
    cursor.execute("DROP TABLE IF EXISTS external_imports")
    
    # Recreate with correct column names
    print("Creating tables with correct column names...")
    
    # Import/Export History table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS import_export_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            operation_type VARCHAR(20) NOT NULL,
            source_type VARCHAR(50) NOT NULL,
            destination_type VARCHAR(50) NOT NULL,
            source_ids TEXT,
            destination_ids TEXT,
            item_count INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'completed',
            error_message TEXT,
            operation_metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    print("✅ Created import_export_history table")
    
    # Exported Files table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exported_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            history_id INTEGER,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500),
            file_type VARCHAR(20) NOT NULL,
            file_size INTEGER,
            content_type VARCHAR(50) NOT NULL,
            download_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (history_id) REFERENCES import_export_history(id)
        )
    """)
    print("✅ Created exported_files table")
    
    # Batch Operations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS batch_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            operation_name VARCHAR(100) NOT NULL,
            source_type VARCHAR(50) NOT NULL,
            source_ids TEXT NOT NULL,
            result_id INTEGER,
            result_type VARCHAR(50),
            status VARCHAR(20) DEFAULT 'pending',
            progress INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    print("✅ Created batch_operations table")
    
    # External Imports table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS external_imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            source_platform VARCHAR(50) NOT NULL,
            source_url VARCHAR(500),
            source_file_name VARCHAR(255),
            import_type VARCHAR(50) NOT NULL,
            items_imported INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending',
            error_message TEXT,
            import_metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    print("✅ Created external_imports table")
    
    conn.commit()
    conn.close()
    
    print("✅ All tables fixed successfully!")

if __name__ == "__main__":
    fix_tables()
