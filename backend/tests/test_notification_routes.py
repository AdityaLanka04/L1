"""Exercise reminders and notifications together through authenticated HTTP routes."""
from datetime import datetime, timedelta, timezone
from test_b2b_journey import world
import models
from routes import reminders, notifications

def test_reminder_edit_complete_delete_lifecycle(world):
    db,users,c,login,*_=world
    c.app.include_router(reminders.router);c.app.include_router(notifications.router)
    login(2)
    due=datetime.now(timezone.utc)+timedelta(minutes=10)
    created=c.post('/api/create_reminder',data={'user_id':users[2].username,'title':'Prepare lesson','reminder_date':due.isoformat(),'user_timezone':'Asia/Kolkata','timezone_offset':-330})
    assert created.status_code==200,created.text
    reminder=created.json()
    assert reminder['reminder_date'].endswith('Z')
    inbox=c.get('/api/get_notifications').json()
    assert inbox['total_count']==1
    previous=inbox['notifications'][0]['id']
    moved=c.put(f'/api/update_reminder/{reminder["id"]}',data={'reminder_date':(due+timedelta(minutes=2)).isoformat(),'user_timezone':'Asia/Kolkata'})
    assert moved.status_code==200,moved.text
    inbox=c.get('/api/get_notifications').json()
    assert inbox['total_count']==1 and inbox['notifications'][0]['id']!=previous
    assert c.put(f'/api/update_reminder/{reminder["id"]}',data={'is_completed':'true'}).status_code==200
    assert c.get('/api/get_notifications').json()['total_count']==0
    assert c.put(f'/api/update_reminder/{reminder["id"]}',data={'is_completed':'false'}).status_code==200
    assert c.get('/api/get_notifications').json()['total_count']==1
    assert c.delete(f'/api/delete_reminder/{reminder["id"]}').status_code==200
    assert c.get('/api/get_notifications').json()['total_count']==0

def test_reminder_titles_refresh_and_invalid_lead_time_rejected(world):
    db,users,c,login,*_=world
    c.app.include_router(reminders.router);c.app.include_router(notifications.router);login(2)
    due=datetime.now(timezone.utc)+timedelta(minutes=5)
    payload={'user_id':users[2].username,'title':'Original','reminder_date':due.isoformat()}
    invalid=c.post('/api/create_reminder',data={**payload,'notify_before_minutes':-1})
    assert invalid.status_code==422
    response=c.post('/api/create_reminder',data=payload);assert response.status_code==200,response.text
    rid=response.json()['id']
    assert c.put(f'/api/update_reminder/{rid}',data={'title':'Changed'}).status_code==200
    assert c.get('/api/get_notifications').json()['notifications'][0]['title']=='Reminder: Changed'


def test_unchanged_due_date_does_not_mark_read_notification_unread(world):
    db,users,c,login,*_=world
    c.app.include_router(reminders.router);c.app.include_router(notifications.router);login(2)
    due=(datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat()
    r=c.post('/api/create_reminder',data={'user_id':users[2].username,'title':'Original','reminder_date':due})
    assert r.status_code==200,r.text
    nid=c.get('/api/get_notifications').json()['notifications'][0]['id']
    c.put(f'/api/mark_notification_read/{nid}')
    result=c.put(f'/api/update_reminder/{r.json()["id"]}',data={'title':'Renamed','reminder_date':due})
    assert result.status_code==200,result.text
    assert c.get('/api/get_notifications').json()['unread_count']==0
