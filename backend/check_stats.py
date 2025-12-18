from database import SessionLocal
import models

db = SessionLocal()
user = db.query(models.User).filter(models.User.email == 'anirudh@gmail.com').first()
print(f'User ID: {user.id if user else None}')
print(f'Username: {user.username if user else None}')

if user:
    stats = db.query(models.UserGamificationStats).filter(
        models.UserGamificationStats.user_id == user.id
    ).first()
    
    if stats:
        print(f'\nGamification Stats:')
        print(f'  total_ai_chats: {stats.total_ai_chats}')
        print(f'  weekly_ai_chats: {stats.weekly_ai_chats}')
        print(f'  total_points: {stats.total_points}')
        print(f'  level: {stats.level}')
    else:
        print('No stats found')

db.close()
