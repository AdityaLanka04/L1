"""
Production Migration script for Learning Paths tables
Run this on your production PostgreSQL database
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from sqlalchemy import text

def migrate_production():
    """Create Learning Paths tables for production PostgreSQL"""
    print("🔄 Creating Learning Paths tables for production...")
    
    try:
        with engine.connect() as connection:
            # Create learning_paths table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS learning_paths (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    title VARCHAR(255) NOT NULL,
                    topic_prompt TEXT NOT NULL,
                    description TEXT,
                    difficulty VARCHAR(20) DEFAULT 'intermediate',
                    status VARCHAR(20) DEFAULT 'active',
                    total_nodes INTEGER DEFAULT 0,
                    completed_nodes INTEGER DEFAULT 0,
                    estimated_hours FLOAT DEFAULT 0.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP WITH TIME ZONE
                );
            """))
            
            # Create learning_path_nodes table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS learning_path_nodes (
                    id VARCHAR(36) PRIMARY KEY,
                    path_id VARCHAR(36) NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
                    order_index INTEGER NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    objectives JSON,
                    estimated_minutes INTEGER DEFAULT 30,
                    content_plan JSON,
                    unlock_rule JSON,
                    reward JSON,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            
            # Create learning_path_progress table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS learning_path_progress (
                    id VARCHAR(36) PRIMARY KEY,
                    path_id VARCHAR(36) NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    current_node_index INTEGER DEFAULT 0,
                    total_xp_earned INTEGER DEFAULT 0,
                    completion_percentage FLOAT DEFAULT 0.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(path_id)
                );
            """))
            
            # Create learning_node_progress table
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS learning_node_progress (
                    id VARCHAR(36) PRIMARY KEY,
                    node_id VARCHAR(36) NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    status VARCHAR(20) DEFAULT 'locked',
                    progress_pct INTEGER DEFAULT 0,
                    xp_earned INTEGER DEFAULT 0,
                    evidence JSON,
                    started_at TIMESTAMP WITH TIME ZONE,
                    completed_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            
            # Create indexes for better performance
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);
            """))
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_path_id ON learning_path_nodes(path_id);
            """))
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_learning_path_progress_user_id ON learning_path_progress(user_id);
            """))
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_learning_node_progress_node_id ON learning_node_progress(node_id);
            """))
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_learning_node_progress_user_id ON learning_node_progress(user_id);
            """))
            
            connection.commit()
        
        print("✅ Learning Paths tables created successfully in production!")
        print("\nNew tables:")
        print("  - learning_paths")
        print("  - learning_path_nodes")
        print("  - learning_path_progress")
        print("  - learning_node_progress")
        print("\nIndexes created for optimal performance")
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        print("\nNote: If tables already exist, this is normal.")
        sys.exit(1)

if __name__ == "__main__":
    # Check if we're using PostgreSQL
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    
    if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
        print("📊 Detected PostgreSQL database")
        migrate_production()
    else:
        print("⚠️  This script is for PostgreSQL production databases.")
        print("For SQLite (development), use: python migrate_learning_paths.py")
        
        # Ask user if they want to proceed anyway
        response = input("\nProceed anyway? (y/n): ")
        if response.lower() == 'y':
            migrate_production()
        else:
            print("Migration cancelled.")
