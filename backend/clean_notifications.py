"""Clean duplicate notifications from database"""
from database import SessionLocal
from models import Notification
from sqlalchemy import func

db = SessionLocal()

# Get all notifications
all_notifs = db.query(Notification).all()
print(f"Total notifications: {len(all_notifs)}")

# Show first 10
print("\nFirst 10 notifications:")
for n in all_notifs[:10]:
    print(f"ID: {n.id}, Title: {n.title}, User: {n.user_id}, Read: {n.is_read}, Created: {n.created_at}")

# Find duplicates (same user_id and title)
print("\n\nFinding duplicates...")
duplicates = db.query(
    Notification.user_id,
    Notification.title,
    func.count(Notification.id).label('count')
).group_by(
    Notification.user_id,
    Notification.title
).having(func.count(Notification.id) > 1).all()

print(f"Found {len(duplicates)} duplicate notification types")
for user_id, title, count in duplicates:
    print(f"  User: {user_id}, Title: {title}, Count: {count}")
    
    # Keep only the most recent one, delete the rest
    notifs = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.title == title
    ).order_by(Notification.created_at.desc()).all()
    
    if len(notifs) > 1:
        keep = notifs[0]
        delete = notifs[1:]
        print(f"    Keeping ID {keep.id}, deleting {len(delete)} duplicates")
        for n in delete:
            db.delete(n)

db.commit()
print("\n✅ Cleanup complete!")

# Show final count
final_count = db.query(Notification).count()
print(f"Final notification count: {final_count}")

db.close()
