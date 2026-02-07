"""
Test script to verify progress tracking is working
Run this after asking a question in AI chat
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from learning_paths_models import create_learning_paths_models
from database import Base
from sqlalchemy import and_

# Create models
LearningPath, LearningPathNode, LearningPathProgress, LearningNodeProgress, _ = \
    create_learning_paths_models(Base)

def check_progress():
    db = SessionLocal()
    
    try:
        # Check for user 1 (adjust if needed)
        user_id = 1
        
        print(f"\n{'='*80}")
        print(f"PROGRESS TRACKING VERIFICATION")
        print(f"{'='*80}\n")
        
        # Get active learning paths
        paths = db.query(LearningPath).filter(
            and_(
                LearningPath.user_id == user_id,
                LearningPath.status == 'active'
            )
        ).all()
        
        print(f"📚 Active Learning Paths: {len(paths)}")
        for path in paths:
            print(f"   - {path.title} (ID: {path.id})")
            
            # Get nodes
            nodes = db.query(LearningPathNode).filter(
                LearningPathNode.path_id == path.id
            ).all()
            
            print(f"     Nodes: {len(nodes)}")
            
            # Check progress for each node
            for node in nodes:
                progress = db.query(LearningNodeProgress).filter(
                    and_(
                        LearningNodeProgress.node_id == node.id,
                        LearningNodeProgress.user_id == user_id
                    )
                ).first()
                
                if progress:
                    print(f"     - {node.title}")
                    print(f"       Progress: {progress.progress_pct}%")
                    print(f"       Status: {progress.status}")
                    print(f"       Activities: {len(progress.activities_completed or [])}")
                    if progress.activities_completed:
                        print(f"       Last activity: {progress.activities_completed[-1].get('type')}")
                else:
                    print(f"     - {node.title}: No progress record")
        
        print(f"\n{'='*80}\n")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_progress()
