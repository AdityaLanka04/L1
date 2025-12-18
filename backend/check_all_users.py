from database import SessionLocal
import models

db = SessionLocal()
users = db.query(models.User).all()
print(f'Total users: {len(users)}\n')

for user in users:
    print(f'User ID: {user.id}')
    print(f'  Email: {user.email}')
    print(f'  Username: {user.username}')
    
    stats = db.query(models.UserGamificationStats).filter(
        models.UserGamificationStats.user_id == user.id
    ).first()
    
    if stats:
        print(f'  Stats: total_ai_chats={stats.total_ai_chats}, weekly_ai_chats={stats.weekly_ai_chats}, points={stats.total_points}')
    else:
        print(f'  Stats: None')
    print()

db.close()
