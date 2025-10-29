import sys
sys.path.insert(0, 'd:\\Brainwave\\L1\\backend')

from models import Base, Question, QuestionSet, User, engine, SessionLocal
import json

print("Testing direct insertion into questions table...\n")

# Create a test session
session = SessionLocal()

try:
    # Get a user
    user = session.query(User).first()
    if not user:
        print("No users found in database")
        session.close()
        sys.exit(1)
    
    print(f"Found user: {user.id} - {user.username}")
    
    # Create a question set
    qs = QuestionSet(
        user_id=user.id,
        title="Test Question Set",
        description="Testing insertion",
        source_type="test",
        source_id=None,
        total_questions=1
    )
    session.add(qs)
    session.flush()
    print(f"Created question set: {qs.id}")
    
    # Try to create a question with the points column
    q = Question(
        question_set_id=qs.id,
        question_text="What is 2+2?",
        question_type="multiple_choice",
        difficulty="easy",
        topic="Math",
        correct_answer="4",
        options=json.dumps(["4", "5", "6", "7"]),
        explanation="2+2 equals 4",
        points=1,  # This is the important one
        order_index=0
    )
    session.add(q)
    session.commit()
    print(f"✓ Successfully inserted question: {q.id}")
    
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    session.close()