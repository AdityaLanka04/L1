import sys, types, importlib.util, asyncio
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
from fastapi import HTTPException
Base=declarative_base()
class User(Base):
    __tablename__='users'
    id=Column(Integer,primary_key=True)
    username=Column(String)
    email=Column(String)
def fake_dep(): pass
sys.modules['database']=types.SimpleNamespace(Base=Base,get_db=fake_dep)
sys.modules['deps']=types.SimpleNamespace(get_current_user=fake_dep)
def read_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);sys.modules[name]=mod;spec.loader.exec_module(mod);return mod
m=read_module('models','backend/models/notifications.py');m.User=User
n=read_module('audit_notifications','backend/routes/notifications.py')
r=read_module('audit_reminders_stub','backend/routes/notifications.py')
engine=create_engine('sqlite://');Base.metadata.create_all(engine)
db=sessionmaker(bind=engine)();u=User(username='audit',email='audit@example.test');db.add(u);db.commit()
def poll(limit=12):return asyncio.run(n.get_notifications(user_id=u.username,timezone_offset=0,limit=limit,db=db,current_user=u))
a=m.Reminder(user_id=u.id,title='Rescheduled',reminder_date=datetime.utcnow(),is_notified=False);db.add(a);db.commit();poll();a.reminder_date=datetime.utcnow()+timedelta(minutes=5);a.is_notified=False;db.commit();poll()
print('Reschedule:',db.query(m.Notification).count(),'notification; is_notified=',a.is_notified)
assert db.query(m.Notification).count()==1 and a.is_notified
# Distinct same-title reminders through alternate endpoint.
db.query(m.Notification).delete();db.query(m.Reminder).delete();db.commit()
for _ in range(2):db.add(m.Reminder(user_id=u.id,title='Same title',reminder_date=datetime.utcnow()+timedelta(minutes=5)))
db.commit()
res=asyncio.run(n.check_reminder_notifications(user_id=u.username,current_time=datetime.utcnow().isoformat(),db=db,current_user=u))
print('Two distinct same-title reminders:',res['notifications_created'],'notification')
assert res['notifications_created']==1
print('Alternate endpoint due markers:', '[reminder_due_at:' in db.query(m.Notification).first().message)
# authorization must not be returned as a 200 error object.
res=asyncio.run(n.check_reminder_notifications(user_id='another-user',current_time=None,db=db,current_user=u));print('Scope mismatch returned normally:',res)
# Default inbox truncates unread backlog.
db.query(m.Reminder).delete();db.query(m.Notification).delete();db.commit()
for i in range(13):db.add(m.Notification(user_id=u.id,title=str(i),message='message',is_read=i>0,created_at=datetime.utcnow()+timedelta(seconds=i)))
db.commit();res=poll();print('DB unread=',db.query(m.Notification).filter_by(is_read=False).count(),'; inbox unread=',sum(not x['is_read'] for x in res['notifications']))
assert sum(not x['is_read'] for x in res['notifications'])==0
# ownership protects direct writes.
other=User(username='other',email='other@example.test');db.add(other);db.commit()
try:asyncio.run(n.mark_notification_read(notification_id=db.query(m.Notification).first().id,db=db,current_user=other))
except HTTPException as e:assert e.status_code==404;print('Cross-user mark-read correctly rejected (404)')
