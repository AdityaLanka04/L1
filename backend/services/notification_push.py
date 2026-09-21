"""Durable per-device delivery receipts, bounded retries and Expo receipt handling."""
import hashlib
import json
import logging
import os
from datetime import timedelta
from urllib.parse import urlparse
import requests
from sqlalchemy import or_, func
import models
from services.notification_delivery import utcnow

logger = logging.getLogger(__name__)

def push_config():
    return {'web_enabled': bool(os.getenv('VAPID_PRIVATE_KEY') and os.getenv('VAPID_PUBLIC_KEY') and os.getenv('VAPID_SUBJECT')),
            'public_key': os.getenv('VAPID_PUBLIC_KEY', ''),
            'expo_enabled': os.getenv('EXPO_PUSH_ENABLED', 'false').lower() == 'true'}

def validate_subscription(platform, data):
    if platform == 'expo':
        import re
        token = data.get('token', '')
        if not isinstance(token, str) or not re.fullmatch(r'(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]', token):
            raise ValueError('Invalid device push token')
        return token
    if platform != 'web':
        raise ValueError('Unsupported push platform')
    endpoint = data.get('endpoint', '')
    if not isinstance(endpoint, str) or len(endpoint) > 2048:
        raise ValueError('Invalid push endpoint')
    parsed = urlparse(endpoint)
    allowed = {'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'}
    host = parsed.hostname or ''
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443) or not (host in allowed or host.endswith('.notify.windows.com')):
        raise ValueError('Unsupported push service')
    keys = data.get('keys', {})
    import base64
    try:
        public = base64.urlsafe_b64decode(keys['p256dh'] + '=' * (-len(keys['p256dh']) % 4))
        secret = base64.urlsafe_b64decode(keys['auth'] + '=' * (-len(keys['auth']) % 4))
        if len(public) != 65 or public[0] != 4 or len(secret) != 16: raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise ValueError('Invalid push encryption keys')
    return endpoint

def register_subscription(db, user, platform, data):
    endpoint = validate_subscription(platform, data)
    digest = hashlib.sha256(endpoint.encode()).hexdigest()
    row = db.query(models.NotificationPushSubscription).filter_by(endpoint_hash=digest).first()
    if row and row.user_id != user.id:
        # A device can move between accounts; re-registering drops its old cursor.
        db.query(models.NotificationPushDelivery).filter_by(subscription_id=row.id).delete()
        db.delete(row); db.flush(); row = None
    if not row:
        row = models.NotificationPushSubscription(user_id=user.id, endpoint_hash=digest, platform=platform,
            subscription=json.dumps(data), last_notification_id=db.query(func.max(models.Notification.id)).scalar() or 0)
        db.add(row)
    else:
        row.subscription = json.dumps(data)
    db.commit()
    return row.id

def _expo_request(path, body):
    headers = {'Content-Type': 'application/json'}
    if os.getenv('EXPO_ACCESS_TOKEN'): headers['Authorization'] = 'Bearer ' + os.environ['EXPO_ACCESS_TOKEN']
    response = requests.post('https://exp.host/--/api/v2/push/' + path, json=body, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()['data']

def send_subscription(row, notification):
    config = push_config()
    if not config[f'{row.platform if row.platform == "expo" else "web"}_enabled']:
        return False
    # Lock screens carry a generic preview; private content is read after authentication.
    payload = {'title': 'Cerbyl notification', 'body': 'You have a new update. Open Cerbyl to read it.',
               'url': '/dashboard-cerbyl', 'tag': f'notification-{notification.id}'}
    data = json.loads(row.subscription)
    if row.platform == 'web':
        from pywebpush import webpush
        webpush(subscription_info=data, data=json.dumps(payload), vapid_private_key=os.environ['VAPID_PRIVATE_KEY'],
                vapid_claims={'sub': os.environ['VAPID_SUBJECT']}, ttl=1800, timeout=10)
    else:
        ticket = _expo_request('send', {'to': data['token'], 'title': payload['title'], 'body': payload['body'],
            'sound': 'default', 'data': {'notification_id': notification.id}, 'ttl': 1800})
        if ticket.get('status') == 'error':
            if ticket.get('details', {}).get('error') == 'DeviceNotRegistered': raise LookupError('Expired device')
            raise RuntimeError('Expo rejected push delivery')
        row.receipt_id = ticket.get('id')
    return True

def deliver_push(db):
    now = utcnow()
    pending = db.query(models.Notification.id).filter(
        models.Notification.user_id == models.NotificationPushSubscription.user_id,
        models.Notification.created_at >= models.NotificationPushSubscription.created_at,
        models.Notification.created_at >= now - timedelta(minutes=30),
        ~db.query(models.NotificationPushDelivery.id).filter(
            models.NotificationPushDelivery.subscription_id == models.NotificationPushSubscription.id,
            models.NotificationPushDelivery.notification_id == models.Notification.id,
        ).correlate(models.Notification, models.NotificationPushSubscription).exists(),
    ).correlate(models.NotificationPushSubscription).exists()
    subscriptions = db.query(models.NotificationPushSubscription).filter(
        or_(models.NotificationPushSubscription.retry_at == None, models.NotificationPushSubscription.retry_at <= now),
        or_(models.NotificationPushSubscription.receipt_id != None, pending),
    ).order_by(models.NotificationPushSubscription.id).limit(100).all()
    for device in subscriptions:
        try:
            if device.receipt_id:
                receipt = _expo_request('getReceipts', {'ids': [device.receipt_id]}).get(device.receipt_id)
                if not receipt:
                    device.retry_at = now + timedelta(seconds=60); db.commit(); continue
                device.receipt_id = None
                if receipt.get('status') == 'error':
                    if receipt.get('details', {}).get('error') == 'DeviceNotRegistered': raise LookupError('Expired device')
                    attempted = db.query(models.NotificationPushDelivery).filter_by(subscription_id=device.id).order_by(models.NotificationPushDelivery.id.desc()).first()
                    if attempted: db.delete(attempted)
                    raise RuntimeError('Push provider could not deliver an accepted notification')
            profile = db.query(models.ComprehensiveUserProfile).filter_by(user_id=device.user_id).first()
            allowed = not profile or profile.notifications_enabled is not False
            rows = db.query(models.Notification).filter(models.Notification.user_id == device.user_id, models.Notification.created_at >= device.created_at,
                models.Notification.created_at >= now - timedelta(minutes=30),
                ~db.query(models.NotificationPushDelivery.id).filter(models.NotificationPushDelivery.subscription_id == device.id, models.NotificationPushDelivery.notification_id == models.Notification.id).exists()).order_by(models.Notification.id).limit(20).all()
            for notification in rows:
                if allowed and not notification.cancelled and not notification.is_read and notification.created_at >= now - timedelta(minutes=30):
                    if not send_subscription(device, notification):
                        device.retry_at = now + timedelta(minutes=5)
                        break
                device.last_notification_id = max(device.last_notification_id, notification.id)
                db.add(models.NotificationPushDelivery(subscription_id=device.id, notification_id=notification.id))
                device.failures = 0; device.retry_at = None
                db.commit()
                if device.receipt_id:
                    device.retry_at = now + timedelta(seconds=60); break
            db.commit()
        except LookupError:
            db.query(models.NotificationPushDelivery).filter_by(subscription_id=device.id).delete()
            db.delete(device); db.commit()
        except Exception as error:
            status = getattr(error, 'status_code', None) or getattr(getattr(error, 'response', None), 'status_code', None)
            if status in (404, 410):
                db.query(models.NotificationPushDelivery).filter_by(subscription_id=device.id).delete()
                db.delete(device)
            else:
                device.failures += 1
                device.retry_at = now + timedelta(seconds=min(3600, 30 * 2 ** min(device.failures, 7)))
                logger.warning('Push delivery failed; subscription=%s will retry', device.id)
            db.commit()
