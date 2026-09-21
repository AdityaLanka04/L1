import json
import sys
from types import SimpleNamespace
from datetime import timedelta
import pytest
from test_notification_delivery import setup, models, delivery, load, ComprehensiveUserProfile
saved={k:sys.modules.get(k) for k in ['models','services.notification_delivery']}
try:
    sys.modules['models']=models;sys.modules['services.notification_delivery']=delivery
    push=load('audit_push','services/notification_push.py')
finally:
    for key,value in saved.items():
        if value is None: sys.modules.pop(key,None)
        else:sys.modules[key]=value

def test_rejects_untrusted_endpoints():
    for url in ['http://localhost/push','https://127.0.0.1/push','https://fcm.googleapis.com.evil.test/push','https://user@fcm.googleapis.com/push']:
        with pytest.raises(ValueError):push.validate_subscription('web',{'endpoint':url})
    with pytest.raises(ValueError):push.validate_subscription('expo',{'token':'bad'})

def test_device_binding_and_history_not_replayed(setup):
    db,user,other,_=setup
    db.add(models.Notification(user_id=user.id,title='Old',message='old'));db.commit()
    sid=push.register_subscription(db,user,'expo',{'token':'ExpoPushToken[abc123]'})
    row=db.get(models.NotificationPushSubscription,sid)
    assert row.last_notification_id==1
    push.register_subscription(db,other,'expo',{'token':'ExpoPushToken[abc123]'})
    assert db.query(models.NotificationPushSubscription).count()==1
    assert db.query(models.NotificationPushSubscription).first().user_id==other.id

def test_deliver_retries_and_honors_preferences(setup,monkeypatch):
    db,user,_,_=setup
    sid=push.register_subscription(db,user,'expo',{'token':'ExpoPushToken[abc123]'})
    db.add(models.Notification(user_id=user.id,title='Private title',message='Private message'));db.commit()
    calls=[]
    def fail(*args):calls.append(args);raise RuntimeError('offline')
    monkeypatch.setattr(push,'send_subscription',fail)
    push.deliver_push(db)
    row=db.get(models.NotificationPushSubscription,sid)
    assert row.last_notification_id==0 and row.retry_at>delivery.utcnow()
    push.deliver_push(db);assert len(calls)==1
    row.retry_at=None;db.add(ComprehensiveUserProfile(user_id=user.id,notifications_enabled=False));db.commit()
    push.deliver_push(db)
    assert row.last_notification_id==1 and len(calls)==1

def test_generic_preview_and_expired_device_removal(setup,monkeypatch):
    db,user,_,_=setup
    sid=push.register_subscription(db,user,'expo',{'token':'ExpoPushToken[abc123]'})
    db.add(models.Notification(user_id=user.id,title='Private',message='Private content'));db.commit()
    monkeypatch.setenv('EXPO_PUSH_ENABLED','true')
    payloads=[]
    def rejected(path,payload):payloads.append(payload);return {'status':'error','details':{'error':'DeviceNotRegistered'}}
    monkeypatch.setattr(push,'_expo_request',rejected)
    push.deliver_push(db)
    assert 'Private' not in json.dumps(payloads)
    assert db.query(models.NotificationPushSubscription).count()==0


def test_late_commit_with_lower_id_is_not_skipped(setup,monkeypatch):
    db,user,_,_=setup
    push.register_subscription(db,user,'expo',{'token':'ExpoPushToken[abc123]'})
    db.add(models.Notification(id=20,user_id=user.id,title='First commit',message='first'));db.commit()
    sent=[]
    monkeypatch.setattr(push,'send_subscription',lambda device,n: sent.append(n.id) or True)
    push.deliver_push(db)
    db.add(models.Notification(id=19,user_id=user.id,title='Late commit',message='late'));db.commit()
    push.deliver_push(db);push.deliver_push(db)
    assert sent==[20,19]
