"""
Script to unlock all existing locked learning path nodes
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from learning_paths_models import create_learning_paths_models
from database import Base

def unlock_all_nodes():
    """Unlock all locked nodes in the database"""
    # Use backend database
    engine = create_engine('sqlite:///./backend/brainwave_tutor.db')
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        _, _, _, LearningNodeProgress, _ = create_learning_paths_models(Base)
        
        # Get all locked nodes
        locked_nodes = db.query(LearningNodeProgress).filter(
            LearningNodeProgress.status == 'locked'
        ).all()
        
        print(f"Found {len(locked_nodes)} locked nodes")
        
        # Unlock them all
        for node in locked_nodes:
            node.status = 'unlocked'
            print(f"  Unlocked node: {node.node_id}")
        
        db.commit()
        print(f"\n✅ Successfully unlocked {len(locked_nodes)} nodes!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    unlock_all_nodes()
