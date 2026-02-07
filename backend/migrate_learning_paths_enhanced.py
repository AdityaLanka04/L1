"""
Migration script to add enhanced fields to learning path tables
Run this to upgrade existing learning paths with new features
"""
import sys
import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def column_exists(inspector, table_name, column_name):
    """Check if a column exists in a table"""
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def migrate_learning_paths():
    """Add new columns to learning path tables"""
    
    # Get database URL from environment or use default
    # Use backend/brainwave_tutor.db for local development
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backend/brainwave_tutor.db")
    
    # Fix for Supabase Transaction mode
    if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
        if ":5432/" in DATABASE_URL:
            DATABASE_URL = DATABASE_URL.replace(":5432/", ":6543/")
            logger.info("Switched to Transaction mode pooling (port 6543)")
    
    is_sqlite = DATABASE_URL.startswith("sqlite")
    logger.info(f"Using database: {DATABASE_URL.split('@')[0] if '@' in DATABASE_URL else 'sqlite'}...")
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # Define migrations with table, column, and type
    migrations = [
        # Learning Path Nodes - Enhanced metadata
        ("learning_path_nodes", "tags", "JSON"),
        ("learning_path_nodes", "keywords", "JSON"),
        ("learning_path_nodes", "bloom_level", "VARCHAR(50)"),
        ("learning_path_nodes", "cognitive_load", "VARCHAR(20)"),
        ("learning_path_nodes", "industry_relevance", "JSON"),
        
        # Learning Path Nodes - Multi-layer content
        ("learning_path_nodes", "introduction", "TEXT"),
        ("learning_path_nodes", "core_sections", "JSON"),
        ("learning_path_nodes", "summary", "JSON"),
        ("learning_path_nodes", "connection_map", "JSON"),
        ("learning_path_nodes", "real_world_applications", "JSON"),
        
        # Learning Path Nodes - Progressive disclosure
        ("learning_path_nodes", "beginner_content", "JSON"),
        ("learning_path_nodes", "intermediate_content", "JSON"),
        ("learning_path_nodes", "advanced_content", "JSON"),
        
        # Learning Path Nodes - Content formats
        ("learning_path_nodes", "video_resources", "JSON"),
        ("learning_path_nodes", "interactive_diagrams", "JSON"),
        ("learning_path_nodes", "audio_narration", "JSON"),
        ("learning_path_nodes", "infographics", "JSON"),
        ("learning_path_nodes", "code_playgrounds", "JSON"),
        
        # Learning Path Nodes - Enhanced learning content
        ("learning_path_nodes", "learning_outcomes", "JSON"),
        ("learning_path_nodes", "prerequisites", "JSON"),
        ("learning_path_nodes", "prerequisite_nodes", "JSON"),
        
        # Learning Path Nodes - Enhanced resources
        ("learning_path_nodes", "resources", "JSON"),
        ("learning_path_nodes", "primary_resources", "JSON"),
        ("learning_path_nodes", "supplementary_resources", "JSON"),
        ("learning_path_nodes", "practice_resources", "JSON"),
        
        # Learning Path Nodes - Interactive activities
        ("learning_path_nodes", "concept_mapping", "JSON"),
        ("learning_path_nodes", "scenarios", "JSON"),
        ("learning_path_nodes", "hands_on_projects", "JSON"),
        
        # Learning Path Nodes - Prerequisite validation
        ("learning_path_nodes", "prerequisite_quiz", "JSON"),
        
        # Learning Node Progress - Enhanced tracking
        ("learning_node_progress", "difficulty_view", "VARCHAR(20)"),
        ("learning_node_progress", "time_spent_minutes", "INTEGER"),
        ("learning_node_progress", "quiz_attempts", "JSON"),
        ("learning_node_progress", "concept_mastery", "JSON"),
        ("learning_node_progress", "struggle_points", "JSON"),
        ("learning_node_progress", "resources_completed", "JSON"),
        ("learning_node_progress", "resource_ratings", "JSON"),
        ("learning_node_progress", "activities_completed", "JSON"),
        ("learning_node_progress", "last_accessed", "TIMESTAMP"),
    ]
    
    try:
        added_count = 0
        skipped_count = 0
        
        with engine.connect() as conn:
            for table_name, column_name, column_type in migrations:
                # Check if column already exists
                if column_exists(inspector, table_name, column_name):
                    logger.info(f"Skipping {table_name}.{column_name} (already exists)")
                    skipped_count += 1
                    continue
                
                try:
                    # Build SQL based on database type
                    if is_sqlite:
                        sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                    else:
                        # PostgreSQL supports IF NOT EXISTS
                        sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                    
                    logger.info(f"Adding {table_name}.{column_name}...")
                    conn.execute(text(sql))
                    conn.commit()
                    logger.info(f"Added {table_name}.{column_name}")
                    added_count += 1
                except Exception as e:
                    logger.error(f"Failed to add {table_name}.{column_name}: {e}")
                    conn.rollback()
        
        logger.info(f"\nMigration summary: {added_count} columns added, {skipped_count} skipped")
        
        # Initialize new fields for existing records (only if we added columns)
        if added_count > 0:
            logger.info("\nInitializing new fields for existing records...")
            # Refresh inspector after adding columns
            inspector = inspect(engine)
            with engine.connect() as conn:
                # Initialize JSON fields to empty arrays/objects
                init_queries = []
                
                # Only initialize columns that exist
                if column_exists(inspector, "learning_path_nodes", "tags"):
                    init_queries.append(("learning_path_nodes", "tags", "[]"))
                if column_exists(inspector, "learning_path_nodes", "keywords"):
                    init_queries.append(("learning_path_nodes", "keywords", "[]"))
                if column_exists(inspector, "learning_path_nodes", "industry_relevance"):
                    init_queries.append(("learning_path_nodes", "industry_relevance", "[]"))
                if column_exists(inspector, "learning_path_nodes", "core_sections"):
                    init_queries.append(("learning_path_nodes", "core_sections", "[]"))
                if column_exists(inspector, "learning_path_nodes", "summary"):
                    init_queries.append(("learning_path_nodes", "summary", "[]"))
                if column_exists(inspector, "learning_path_nodes", "connection_map"):
                    init_queries.append(("learning_path_nodes", "connection_map", "{}"))
                if column_exists(inspector, "learning_path_nodes", "real_world_applications"):
                    init_queries.append(("learning_path_nodes", "real_world_applications", "[]"))
                if column_exists(inspector, "learning_path_nodes", "video_resources"):
                    init_queries.append(("learning_path_nodes", "video_resources", "[]"))
                if column_exists(inspector, "learning_path_nodes", "interactive_diagrams"):
                    init_queries.append(("learning_path_nodes", "interactive_diagrams", "[]"))
                if column_exists(inspector, "learning_path_nodes", "audio_narration"):
                    init_queries.append(("learning_path_nodes", "audio_narration", "[]"))
                if column_exists(inspector, "learning_path_nodes", "infographics"):
                    init_queries.append(("learning_path_nodes", "infographics", "[]"))
                if column_exists(inspector, "learning_path_nodes", "code_playgrounds"):
                    init_queries.append(("learning_path_nodes", "code_playgrounds", "[]"))
                if column_exists(inspector, "learning_path_nodes", "learning_outcomes"):
                    init_queries.append(("learning_path_nodes", "learning_outcomes", "[]"))
                if column_exists(inspector, "learning_path_nodes", "prerequisites"):
                    init_queries.append(("learning_path_nodes", "prerequisites", "[]"))
                if column_exists(inspector, "learning_path_nodes", "prerequisite_nodes"):
                    init_queries.append(("learning_path_nodes", "prerequisite_nodes", "[]"))
                if column_exists(inspector, "learning_path_nodes", "resources"):
                    init_queries.append(("learning_path_nodes", "resources", "[]"))
                if column_exists(inspector, "learning_path_nodes", "primary_resources"):
                    init_queries.append(("learning_path_nodes", "primary_resources", "[]"))
                if column_exists(inspector, "learning_path_nodes", "supplementary_resources"):
                    init_queries.append(("learning_path_nodes", "supplementary_resources", "[]"))
                if column_exists(inspector, "learning_path_nodes", "practice_resources"):
                    init_queries.append(("learning_path_nodes", "practice_resources", "[]"))
                if column_exists(inspector, "learning_path_nodes", "concept_mapping"):
                    init_queries.append(("learning_path_nodes", "concept_mapping", "{}"))
                if column_exists(inspector, "learning_path_nodes", "scenarios"):
                    init_queries.append(("learning_path_nodes", "scenarios", "[]"))
                if column_exists(inspector, "learning_path_nodes", "hands_on_projects"):
                    init_queries.append(("learning_path_nodes", "hands_on_projects", "[]"))
                if column_exists(inspector, "learning_path_nodes", "prerequisite_quiz"):
                    init_queries.append(("learning_path_nodes", "prerequisite_quiz", "[]"))
                if column_exists(inspector, "learning_path_nodes", "bloom_level"):
                    init_queries.append(("learning_path_nodes", "bloom_level", "'understand'"))
                if column_exists(inspector, "learning_path_nodes", "cognitive_load"):
                    init_queries.append(("learning_path_nodes", "cognitive_load", "'medium'"))
                
                if column_exists(inspector, "learning_node_progress", "difficulty_view"):
                    init_queries.append(("learning_node_progress", "difficulty_view", "'intermediate'"))
                if column_exists(inspector, "learning_node_progress", "time_spent_minutes"):
                    init_queries.append(("learning_node_progress", "time_spent_minutes", "0"))
                if column_exists(inspector, "learning_node_progress", "quiz_attempts"):
                    init_queries.append(("learning_node_progress", "quiz_attempts", "[]"))
                if column_exists(inspector, "learning_node_progress", "concept_mastery"):
                    init_queries.append(("learning_node_progress", "concept_mastery", "{}"))
                if column_exists(inspector, "learning_node_progress", "struggle_points"):
                    init_queries.append(("learning_node_progress", "struggle_points", "[]"))
                if column_exists(inspector, "learning_node_progress", "resources_completed"):
                    init_queries.append(("learning_node_progress", "resources_completed", "[]"))
                if column_exists(inspector, "learning_node_progress", "resource_ratings"):
                    init_queries.append(("learning_node_progress", "resource_ratings", "{}"))
                if column_exists(inspector, "learning_node_progress", "activities_completed"):
                    init_queries.append(("learning_node_progress", "activities_completed", "[]"))
                
                for table, column, value in init_queries:
                    try:
                        query = f"UPDATE {table} SET {column} = {value} WHERE {column} IS NULL"
                        conn.execute(text(query))
                        conn.commit()
                        logger.info(f"Initialized {table}.{column}")
                    except Exception as e:
                        logger.warning(f"Failed to initialize {table}.{column}: {e}")
                        conn.rollback()
            
            logger.info("Initialization completed!")
        else:
            logger.info("No new columns added, skipping initialization")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    logger.info("Starting learning paths enhanced migration...")
    migrate_learning_paths()
    logger.info("Migration complete!")
