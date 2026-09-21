"""Isolated route/model regression tests; never reads application databases or secrets."""
import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from datetime import timedelta
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Column, Integer, String, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
Base = declarative_base()
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String)
    email = Column(String)

class ComprehensiveUserProfile(Base):
    __tablename__ = 'comprehensive_user_profiles'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    notifications_enabled = Column(Boolean, default=True)

def dep(): pass
def auth_dep(): pass

def load(name, path):
    spec=importlib.util.spec_from_file_location(name, ROOT/path)
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

saved = {name: sys.modules.get(name) for name in ['models','database','deps','services.notification_delivery']}
try:
    sys.modules['database'] = SimpleNamespace(Base=Base,get_db=dep)
    sys.modules['deps'] = SimpleNamespace(get_current_user=auth_dep)
    models=load('audit_models','models/notifications.py'); models.User=User; models.ComprehensiveUserProfile=ComprehensiveUserProfile
    sys.modules['models']=models
    delivery=load('audit_delivery','services/notification_delivery.py')
    sys.modules['services.notification_delivery']=delivery
    routes=load('audit_routes','routes/notifications.py')
finally:
    for name, original in saved.items():
        if original is None: sys.modules.pop(name,None)
        else: sys.modules[name]=original

@pytest.fixture
def setup():
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db=sessionmaker(bind=engine)()
    user=User(username='owner',email='owner@example.test');other=User(username='other',email='other@example.test')
    db.add_all([user,other]);db.commit()
    app=FastAPI();app.include_router(routes.router)
    app.dependency_overrides[dep] = lambda: db
    app.dependency_overrides[auth_dep] = lambda: user
    yield db,user,other,TestClient(app)
    db.close();engine.dispose()

def reminder(db,user,title='Test',minutes=5):
    row=models.Reminder(user_id=user.id,title=title,reminder_date=delivery.utcnow()+timedelta(minutes=minutes),notify_before_minutes=15)
    delivery.configure_reminder(row,'UTC');db.add(row);db.commit();return row

def test_same_title_distinct_occurrences_and_shared_generator(setup):
    db,user,_,client=setup
    reminder(db,user);reminder(db,user)
    assert client.get('/api/check_reminder_notifications').json()['notifications_created']==2
    data=client.get('/api/get_notifications').json()
    assert data['total_count']==2
    assert all(n['reminder_due_at'].endswith('Z') and n['source_id'] for n in data['notifications'])
    assert client.get('/api/check_reminder_notifications').json()['notifications_created']==0

def test_reschedule_retires_previous_occurrence(setup):
    db,user,_,client=setup
    row=reminder(db,user);delivery.generate_reminders(db,user.id)
    delivery.invalidate_reminder(db,row)
    row.reminder_date+=timedelta(minutes=2);row.is_notified=False
    delivery.configure_reminder(row,'UTC');db.commit();delivery.generate_reminders(db,user.id)
    data=client.get('/api/get_notifications').json()
    assert data['total_count']==1
    assert db.query(models.Notification).count()==2

def test_read_delete_and_owner_scope(setup):
    db,user,other,client=setup
    row=models.Notification(user_id=other.id,title='Private',message='Private');db.add(row);db.commit()
    assert client.put(f'/api/mark_notification_read/{row.id}').status_code==404
    assert client.delete(f'/api/delete_notification/{row.id}').status_code==404
    assert client.get('/api/check_reminder_notifications?user_id=other').status_code==403
    assert client.get('/api/debug_notifications?user_id=other').status_code==403
    reminder(db,user);delivery.generate_reminders(db,user.id)
    data=client.get('/api/get_notifications').json();nid=data['notifications'][0]['id']
    assert client.delete(f'/api/delete_notification/{nid}').status_code==200
    assert client.get('/api/get_notifications').json()['total_count']==0

def test_counts_pagination_and_timestamp_ties(setup):
    db,user,_,client=setup
    now=delivery.utcnow()
    for i in range(30):db.add(models.Notification(user_id=user.id,title=str(i),message='Message',created_at=now,is_read=i>0))
    db.commit()
    first=client.get('/api/get_notifications?limit=12').json()
    assert first['unread_count']==1 and first['total_count']==30
    second=client.get(f'/api/get_notifications?limit=12&before_id={first["next_cursor"]}').json()
    assert not set(n['id'] for n in first['notifications']) & set(n['id'] for n in second['notifications'])

def test_old_reminders_and_validation(setup):
    db,user,_,client=setup
    reminder(db,user,minutes=-60)
    assert client.get('/api/get_notifications').json()['total_count']==0
    for payload in [{},{'title':' ','message':'x'},{'title':'x','message':{}},{'title':'x','message':'y','notification_type':'reminder'}]:
        assert client.post('/api/create_notification',json=payload).status_code==422

def test_stable_timezone_instant(setup):
    db,user,_,client=setup
    row=reminder(db,user);row.reminder_date=delivery.utcnow().replace(hour=12,minute=0)
    delivery.configure_reminder(row,'Asia/Kolkata');db.commit();due=row.due_at_utc
    client.get('/api/get_notifications?timezone_offset=480')
    db.refresh(row)
    assert row.due_at_utc==due and due.hour==6 and due.minute==30


def test_legacy_timezone_backfill_keeps_due_metadata(setup):
    db,user,_,client=setup
    date=delivery.utcnow()+timedelta(hours=6)
    row=models.Reminder(user_id=user.id,title='Legacy',reminder_date=date,is_notified=True)
    db.add(row);db.flush()
    db.add(models.Notification(user_id=user.id,title='Reminder: Legacy',message=f'Upcoming [reminder_id:{row.id}] [reminder_due_at:{date.isoformat()}]',notification_type='reminder'))
    db.commit()
    data=client.get('/api/get_notifications?timezone_offset=-330').json()
    assert data['notifications'][0]['reminder_due_at'].endswith('Z')
    assert '[' not in data['notifications'][0]['message']
    assert data['total_count']==1
