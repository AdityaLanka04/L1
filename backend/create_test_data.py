"""
Run this from the backend/ directory to seed test data for a user.
Usage: python create_test_data.py --username <username_or_email>

This creates:
- 3 flashcard sets with struggling cards (< 60% accuracy after reviews)
- 5 weak area entries across different topics
- Simulates quiz failures so the ML weak areas system has data
"""
import sys
import argparse
from datetime import datetime, timezone, timedelta

# must be run from backend/
sys.path.insert(0, ".")

from database import SessionLocal
import models

def get_user(db, identifier):
    u = db.query(models.User).filter(models.User.username == identifier).first()
    if not u:
        u = db.query(models.User).filter(models.User.email == identifier).first()
    return u

def seed(username):
    db = SessionLocal()
    try:
        user = get_user(db, username)
        if not user:
            print(f"User '{username}' not found.")
            return

        uid = user.id
        now = datetime.now(timezone.utc)

        # ── Flashcard sets with poor review stats ──
        topics = [
            ("Calculus - Derivatives", "calculus"),
            ("Organic Chemistry Reactions", "chemistry"),
            ("Quantum Mechanics Basics", "physics"),
        ]
        for set_title, category in topics:
            fs = models.FlashcardSet(user_id=uid, title=set_title, source_type="manual")
            db.add(fs)
            db.flush()
            for i in range(6):
                card = models.Flashcard(
                    set_id=fs.id,
                    question=f"{set_title} Q{i+1}: sample question",
                    answer=f"Sample answer {i+1}",
                    category=category,
                    times_reviewed=5,
                    correct_count=1,  # only 20% accuracy → triggers weak area
                )
                db.add(card)
            print(f"  Created flashcard set: {set_title}")

        # ── UserWeakArea entries (simulates quiz failures) ──
        weak_topics = [
            ("Calculus - Derivatives", 22.0, 8, "critical", 18, 4, 14),
            ("Organic Chemistry Reactions", 38.0, 7, "critical", 13, 5, 8),
            ("Quantum Mechanics Basics", 45.0, 6, "needs_practice", 11, 5, 6),
            ("Linear Algebra", 52.0, 5, "needs_practice", 10, 5, 5),
            ("Cell Biology - Mitosis", 61.0, 3, "improving", 9, 6, 3),
        ]
        for topic, score, priority, status, total_q, correct, wrong in weak_topics:
            existing = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.user_id == uid,
                models.UserWeakArea.topic == topic,
            ).first()
            if existing:
                print(f"  Skipping (exists): {topic}")
                continue
            wa = models.UserWeakArea(
                user_id=uid,
                topic=topic,
                total_questions=total_q,
                correct_count=correct,
                incorrect_count=wrong,
                accuracy=round(correct / total_q * 100, 1),
                weakness_score=score,
                consecutive_wrong=wrong,
                practice_sessions=2,
                last_practiced=now - timedelta(days=1),
                improvement_rate=-0.05,
                status=status,
                priority=priority,
                first_identified=now - timedelta(days=3),
                last_updated=now,
            )
            db.add(wa)
            print(f"  Created weak area: {topic} ({status}, score={score})")

        # ── TopicMastery entries ──
        mastery_topics = [
            ("Calculus - Derivatives", 4, 1, 0.25),
            ("Organic Chemistry Reactions", 5, 2, 0.30),
            ("Quantum Mechanics Basics", 5, 2, 0.40),
            ("Linear Algebra", 4, 2, 0.50),
            ("Cell Biology - Mitosis", 3, 2, 0.65),
        ]
        for topic, total, correct, mastery in mastery_topics:
            existing = db.query(models.TopicMastery).filter(
                models.TopicMastery.user_id == uid,
                models.TopicMastery.topic_name == topic,
            ).first()
            if existing:
                continue
            tm = models.TopicMastery(
                user_id=uid,
                topic_name=topic,
                questions_asked=total,
                correct_answers=correct,
                mastery_level=mastery,
                last_practiced=now - timedelta(days=1),
            )
            db.add(tm)

        db.commit()
        print(f"\nDone. Seeded test data for user '{username}' (id={uid}).")
        print("Now open the Weaknesses page → it should show 5 weak areas across Critical/Needs Practice/Improving.")

    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True, help="Username or email")
    args = parser.parse_args()
    seed(args.username)
