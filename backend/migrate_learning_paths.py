"""
Migration script to create Learning Paths tables
Run this to add the new tables to your database
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
import models

def migrate():
    """Create all tables including learning paths"""
    print("🔄 Creating Learning Paths tables...")
    
    try:
        # Create all tables (will skip existing ones)
        models.Base.metadata.create_all(bind=engine)
        
        print("✅ Learning Paths tables created successfully!")
        print("\nNew tables:")
        print("  - learning_paths")
        print("  - learning_path_nodes")
        print("  - learning_path_progress")
        print("  - learning_node_progress")
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate()
