import logging
import re
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, StrictStr
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
import models
from database import get_db
from deps import get_current_user
from services.notification_delivery import generate_reminders, iso_utc, utcnow, configure_reminder

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api', tags=['notifications'])

def _assert_user_matches_request(user_id, current_user):
    if user_id and str(user_id).strip().lower() not in {str(current_user.id), (current_user.username or '').lower(), (current_user.email or '').lower()}:
        raise HTTPException(403, 'Access denied')

def inbox(db, user):
    return db.query(models.Notification).filter(models.Notification.user_id == user.id, models.Notification.cancelled == False)

def serialize_notification(n):
    message = re.sub(r'\s*\[(?:reminder_id|reminder_due_at|login_return):[^\]]*\]', '', n.message or '').strip()
    if n.notification_type in ('reminder', 'calendar_event'):
        message = re.sub(r'\s*-\s*(?:Due at|Scheduled for) \d{1,2}:\d{2} [AP]M(?: \(in \d+ min\))?', '', message).strip()
    return {'id': n.id, 'title': n.title, 'message': message,
            'notification_type': n.notification_type, 'is_read': n.is_read,
            'created_at': iso_utc(n.created_at), 'reminder_due_at': iso_utc(n.due_at),
            'source_id': n.source_id, 'action_url': n.action_url}

def notification_page(db, user, limit=25, before_id=None, classroom=False):
    query = inbox(db, user)
    if classroom:
        query = query.filter(models.Notification.notification_type.startswith('class_'))
    profile = db.query(models.ComprehensiveUserProfile).filter_by(user_id=user.id).first()
    total = query.count()
    unread = query.filter(models.Notification.is_read == False).count()
    if before_id is not None:
        anchor = db.query(models.Notification).filter(models.Notification.user_id == user.id, models.Notification.id == before_id).first()
        if anchor:
            query = query.filter(or_(models.Notification.created_at < anchor.created_at,
                and_(models.Notification.created_at == anchor.created_at, models.Notification.id < anchor.id)))
        else:
            # Deleted cursor: IDs still give a stable continuation for ordinary inserts.
            query = query.filter(models.Notification.id < before_id)
    rows = query.order_by(models.Notification.created_at.desc(), models.Notification.id.desc()).limit(limit + 1).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return {'notifications': [serialize_notification(n) for n in rows], 'notifications_enabled': not profile or profile.notifications_enabled is not False, 'unread_count': unread,
            'total_count': total, 'next_cursor': rows[-1].id if more else None}

@router.get('/get_notifications')
def get_notifications(user_id: Optional[str] = Query(None), timezone_offset: int = Query(0, ge=-840, le=840),
    limit: int = Query(25, ge=1, le=200), before_id: Optional[int] = Query(None),
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(user_id, current_user)
    # Assign a stable instant once to timezone-less legacy rows, never on every poll.
    legacy = db.query(models.Reminder).filter(models.Reminder.user_id == current_user.id, models.Reminder.reminder_date != None, models.Reminder.due_at_utc == None).all()
    for reminder in legacy:
        configure_reminder(reminder, offset=timezone_offset)
        previous = db.query(models.Notification).filter(
            models.Notification.user_id == current_user.id,
            models.Notification.notification_type.in_(['reminder', 'calendar_event']),
            models.Notification.message.contains(f'[reminder_id:{reminder.id}]'),
        ).order_by(models.Notification.id.desc()).all()
        for index, notification in enumerate(previous):
            notification.source_id = reminder.id
            notification.due_at = reminder.due_at_utc
            notification.action_url = f'/activity-timeline?reminder={reminder.id}'
            if index == 0 and not notification.occurrence_key:
                notification.occurrence_key = f'reminder:{reminder.id}:{iso_utc(reminder.due_at_utc)}'
            if index or reminder.is_completed:
                notification.cancelled = notification.is_read = True
        if previous:
            reminder.is_notified = True
    if legacy:
        db.commit()
    try:
        generate_reminders(db, current_user.id)
    except Exception:
        db.rollback()
        logger.exception('Reminder generation failed; serving existing inbox')
    return notification_page(db, current_user, limit, before_id)

def owned_notification(db, user, notification_id):
    row = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == user.id).first()
    if not row:
        raise HTTPException(404, 'Notification not found')
    return row

@router.put('/mark_notification_read/{notification_id}')
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    owned_notification(db, current_user, notification_id).is_read = True
    db.commit()
    return {'status': 'success'}

@router.put('/mark_all_notifications_read')
def mark_all_notifications_read(user_id: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(user_id, current_user)
    inbox(db, current_user).filter(models.Notification.is_read == False).update({'is_read': True})
    db.commit()
    return {'status': 'success'}

class NotificationCreate(BaseModel):
    user_id: Optional[StrictStr] = None
    title: StrictStr = Field(..., min_length=1, max_length=200)
    message: StrictStr = Field(..., min_length=1, max_length=5000)
    notification_type: StrictStr = Field('general', min_length=1, max_length=50, pattern=r'^[a-z][a-z0-9_]*$')

@router.post('/create_notification')
def create_notification(payload: NotificationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(payload.user_id, current_user)
    if not payload.title.strip() or not payload.message.strip():
        raise HTTPException(422, 'Title and message cannot be blank')
    # Public callers create general messages; product event types are server-owned.
    if payload.notification_type != 'general':
        raise HTTPException(422, 'Only general notifications can be created directly')
    row = models.Notification(user_id=current_user.id, title=payload.title.strip(), message=payload.message.strip(), notification_type=payload.notification_type)
    db.add(row); db.commit(); db.refresh(row)
    return {'status': 'success', 'notification_id': row.id}

@router.get('/debug_notifications')
def debug_notifications(user_id: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(user_id, current_user)
    page = notification_page(db, current_user, 200)
    return {**page, 'total_notifications': page['total_count'], 'user_id': current_user.id}

@router.delete('/delete_notification/{notification_id}')
def delete_notification(notification_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Keep the occurrence tombstone so a deleted reminder cannot be regenerated.
    row = owned_notification(db, current_user, notification_id)
    row.cancelled = row.is_read = True
    db.commit()
    return {'status': 'success'}

@router.post('/clear_old_notifications')
def clear_old_notifications(user_id: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(user_id, current_user)
    count = inbox(db, current_user).filter(models.Notification.created_at < utcnow() - timedelta(days=30)).update({'cancelled': True, 'is_read': True})
    db.commit()
    return {'status': 'success', 'cleared': count}

@router.delete('/clear_all_notifications')
def clear_all_notifications(user_id: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(user_id, current_user)
    count = inbox(db, current_user).update({'cancelled': True, 'is_read': True})
    db.commit()
    return {'status': 'success', 'cleared': count}

@router.get('/check_reminder_notifications')
def check_reminder_notifications(user_id: Optional[str] = Query(None), current_time: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _assert_user_matches_request(user_id, current_user)
    # Client clock is intentionally ignored: every entry point uses the same UTC clock.
    count = generate_reminders(db, current_user.id)
    return {'status': 'success', 'notifications_created': count, 'server_time': iso_utc(utcnow())}

class PushRegistration(BaseModel):
    platform: StrictStr = Field(..., max_length=10)
    subscription: dict

@router.get('/notification_push/config')
def notification_push_config(current_user: models.User = Depends(get_current_user)):
    from services.notification_push import push_config
    return push_config()

@router.post('/notification_push/subscriptions')
def subscribe_push(payload: PushRegistration, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from services.notification_push import register_subscription, push_config
    if len(str(payload.subscription)) > 5000:
        raise HTTPException(422, 'Push subscription is too large')
    if payload.platform not in ('web', 'expo') or not push_config().get(f'{payload.platform}_enabled'):
        raise HTTPException(503, 'Push notifications are not configured for this platform yet')
    try:
        return {'id': register_subscription(db, current_user, payload.platform, payload.subscription)}
    except ValueError as error:
        raise HTTPException(422, str(error))

@router.delete('/notification_push/subscriptions/{subscription_id}')
def unsubscribe_push(subscription_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    owned = db.query(models.NotificationPushSubscription).filter_by(id=subscription_id, user_id=current_user.id).first()
    if owned:
        db.query(models.NotificationPushDelivery).filter_by(subscription_id=owned.id).delete()
        db.delete(owned)
    db.commit()
    return {'status': 'success'}
