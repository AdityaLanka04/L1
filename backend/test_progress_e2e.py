"""
End-to-End Test for Progress Tracking
Simulates an AI chat question and verifies progress is tracked
"""
import sys
import os
import asyncio
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from learning_paths_models import create_learning_paths_models
from database import Base
from sqlalchemy import and_
from learning_progress_hooks import track_chat_activity

# Create models
LearningPath, LearningPathNode, LearningPathProgress, LearningNodeProgress, _ = \
    create_learning_paths_models(Base)

async def test_progress_tracking():
    db = SessionLocal()
    
    try:
        user_id = 1
        
        print(f"\n{'='*80}")
        print(f"🧪 END-TO-END PROGRESS TRACKING TEST")
        print(f"{'='*80}\n")
        
        # Step 1: Check initial state
        print(f"📊 STEP 1: Checking initial state...")
        paths = db.query(LearningPath).filter(
            and_(
                LearningPath.user_id == user_id,
                LearningPath.status == 'active'
            )
        ).all()
        
        if not paths:
            print(f"❌ ERROR: No active learning paths found for user {user_id}")
            print(f"   Please create a learning path first!")
            return
        
        print(f"✅ Found {len(paths)} active learning path(s)")
        for path in paths:
            print(f"   - {path.title}")
        
        # Get nodes
        path = paths[0]
        nodes = db.query(LearningPathNode).filter(
            LearningPathNode.path_id == path.id
        ).all()
        
        print(f"\n📚 Learning Path: {path.title}")
        print(f"   Total Nodes: {len(nodes)}")
        
        # Show initial progress
        print(f"\n📊 Initial Progress:")
        for node in nodes[:3]:  # Show first 3 nodes
            progress = db.query(LearningNodeProgress).filter(
                and_(
                    LearningNodeProgress.node_id == node.id,
                    LearningNodeProgress.user_id == user_id
                )
            ).first()
            
            pct = progress.progress_pct if progress else 0
            print(f"   - {node.title}: {pct}%")
        
        # Step 2: Simulate AI chat about supervised learning
        print(f"\n{'='*80}")
        print(f"🤖 STEP 2: Simulating AI Chat Question")
        print(f"{'='*80}\n")
        
        chat_messages = [
            {"role": "user", "content": "What is supervised learning in machine learning?"},
            {"role": "assistant", "content": "Supervised learning is a type of machine learning where the algorithm learns from labeled training data. In supervised learning, you provide the algorithm with input-output pairs, and it learns to map inputs to outputs. The main types are classification (predicting categories) and regression (predicting continuous values). Common algorithms include linear regression, logistic regression, decision trees, and neural networks."},
            {"role": "user", "content": "Can you explain the difference between classification and regression?"},
            {"role": "assistant", "content": "Classification predicts discrete categories (like spam/not spam, cat/dog), while regression predicts continuous numerical values (like house prices, temperature). Classification outputs a class label, regression outputs a number. Both use labeled training data but solve different types of problems."}
        ]
        
        topic = "Supervised Learning"
        
        print(f"📝 Simulating chat about: {topic}")
        print(f"   Messages: {len(chat_messages)}")
        print(f"   Content preview: {chat_messages[0]['content'][:80]}...")
        
        # Step 3: Track the activity
        print(f"\n{'='*80}")
        print(f"🚀 STEP 3: Tracking Progress")
        print(f"{'='*80}\n")
        
        result = await track_chat_activity(
            db=db,
            user_id=user_id,
            chat_messages=chat_messages,
            topic=topic
        )
        
        # Step 4: Check results
        print(f"\n{'='*80}")
        print(f"📊 STEP 4: Verifying Results")
        print(f"{'='*80}\n")
        
        if result:
            print(f"✅ Tracking completed successfully!")
            print(f"   Success: {result.get('success')}")
            print(f"   Matched Nodes: {result.get('matched_nodes', 0)}")
            print(f"   Updated Nodes: {result.get('updated_nodes', 0)}")
            
            if result.get('updates'):
                print(f"\n📈 Node Updates:")
                for update in result['updates']:
                    print(f"   ✅ {update.get('node_title')}")
                    print(f"      Path: {update.get('path_title')}")
                    print(f"      Progress: +{update.get('progress_delta')}% → {update.get('new_progress')}%")
                    print(f"      Status: {update.get('status')}")
            else:
                print(f"\n⚠️ No nodes were updated")
                print(f"   Message: {result.get('message', 'Unknown')}")
        else:
            print(f"❌ Tracking failed - no result returned")
        
        # Step 5: Verify in database
        print(f"\n{'='*80}")
        print(f"💾 STEP 5: Verifying Database State")
        print(f"{'='*80}\n")
        
        print(f"📊 Final Progress:")
        for node in nodes[:3]:  # Show first 3 nodes
            progress = db.query(LearningNodeProgress).filter(
                and_(
                    LearningNodeProgress.node_id == node.id,
                    LearningNodeProgress.user_id == user_id
                )
            ).first()
            
            if progress:
                print(f"   - {node.title}")
                print(f"     Progress: {progress.progress_pct}%")
                print(f"     Status: {progress.status}")
                print(f"     Activities: {len(progress.activities_completed or [])}")
                if progress.activities_completed:
                    last_activity = progress.activities_completed[-1]
                    print(f"     Last Activity: {last_activity.get('type')} (+{last_activity.get('progress_delta')}%)")
            else:
                print(f"   - {node.title}: No progress")
        
        # Summary
        print(f"\n{'='*80}")
        print(f"✅ TEST COMPLETE")
        print(f"{'='*80}\n")
        
        if result and result.get('updated_nodes', 0) > 0:
            print(f"🎉 SUCCESS! Progress tracking is working!")
            print(f"   {result.get('updated_nodes')} node(s) were updated")
        else:
            print(f"⚠️ WARNING: No progress was tracked")
            print(f"   Possible issues:")
            print(f"   1. No matching nodes found (check node tags/keywords)")
            print(f"   2. AI matching confidence too low")
            print(f"   3. Error in tracking logic")
            print(f"\n   Check the detailed logs above for more information")
        
    except Exception as e:
        print(f"\n❌ ERROR IN TEST")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_progress_tracking())
