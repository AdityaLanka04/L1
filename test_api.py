import sys
sys.path.append('backend')
from database import SessionLocal
from models import User
from gamification_system import get_user_stats

db = SessionLocal()
user = db.query(User).filter(User.email == 'stupendous0512@gmail.com').first()
print(f'User ID: {user.id}')

result = get_user_stats(db, user.id)
print(f'API Result: {result}')
db.close()
