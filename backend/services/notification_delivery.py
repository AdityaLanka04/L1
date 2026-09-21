"""One occurrence-based reminder generator for polling, mutations and the scheduler."""
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy import or_
import models

logger = logging.getLogger(__name__)

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def iso_utc(value):
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z') if value.tzinfo is None else value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def configure_reminder(reminder, timezone_name=None, offset=0):
    date = reminder.reminder_date
    if not date:
        reminder.due_at_utc = reminder.notify_at_utc = None
        return
    zone = timezone_name or reminder.timezone_name
    try:
        if zone and zone.startswith('UTC') and len(zone) > 3:
            sign = 1 if zone[3] == '+' else -1
            hours, minutes = map(int, zone[4:].split(':'))
            tz = timezone(timedelta(minutes=sign * (hours * 60 + minutes)))
        else:
            tz = ZoneInfo(zone) if zone else (date.tzinfo or timezone(timedelta(minutes=-offset)))
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError('Choose a valid reminder timezone')
    if date.tzinfo is None:
        date = date.replace(tzinfo=tz)
    local_date = date.astimezone(tz)
    reminder.timezone_name = zone or str(tz)
    reminder.reminder_date = local_date.replace(tzinfo=None)
    reminder.due_at_utc = date.astimezone(timezone.utc).replace(tzinfo=None)
    reminder.notify_at_utc = reminder.due_at_utc - timedelta(minutes=reminder.notify_before_minutes if reminder.notify_before_minutes is not None else 15)

def invalidate_reminder(db, reminder, descendants=False):
    # Serialize cancellation with the scheduler's occurrence claim.
    db.query(models.Reminder).filter_by(id=reminder.id).with_for_update().first()
    if descendants:
        for child in reminder.subtasks:
            invalidate_reminder(db, child, descendants=True)
    # Also retire historical marker-based notifications during the transition.
    db.query(models.Notification).filter(
        models.Notification.user_id == reminder.user_id,
        models.Notification.notification_type.in_(['reminder', 'calendar_event']),
        or_(models.Notification.source_id == reminder.id,
            models.Notification.message.contains(f'[reminder_id:{reminder.id}]')),
    ).update({'cancelled': True, 'is_read': True}, synchronize_session=False)

def generate_reminders(db, user_id=None):
    now = utcnow()
    query = db.query(models.Reminder).filter(
        models.Reminder.is_completed == False,
        models.Reminder.is_notified == False,
        models.Reminder.notify_at_utc <= now,
    )
    if user_id is not None:
        query = query.filter(models.Reminder.user_id == user_id)
    made = 0
    for reminder in query.order_by(models.Reminder.notify_at_utc).limit(500).all():
        # A savepoint keeps a failed occurrence from poisoning other notifications.
        with db.begin_nested():
            claimed = db.query(models.Reminder).filter(
                models.Reminder.id == reminder.id,
                models.Reminder.is_notified == False,
                models.Reminder.due_at_utc == reminder.due_at_utc,
                models.Reminder.is_completed == False,
            ).update({'is_notified': True}, synchronize_session=False)
            if not claimed:
                continue
            if reminder.due_at_utc < now - timedelta(minutes=30):
                continue  # Past reminders remain available in the timeline, not as new alerts.
            key = f'reminder:{reminder.id}:{iso_utc(reminder.due_at_utc)}'
            existing = db.query(models.Notification).filter(models.Notification.occurrence_key == key).first()
            kind = 'calendar_event' if reminder.reminder_type in ('event', 'calendar_event') else 'reminder'
            title = f'{"Event" if kind == "calendar_event" else "Reminder"}: {reminder.title}'
            message = reminder.description or 'Your scheduled reminder'
            if existing:
                existing.title, existing.message = title, message
                existing.cancelled, existing.is_read = False, False
            else:
                db.add(models.Notification(user_id=reminder.user_id, title=title, message=message,
                    notification_type=kind, source_id=reminder.id, occurrence_key=key,
                    due_at=reminder.due_at_utc, action_url=f'/activity-timeline?reminder={reminder.id}'))
            made += 1
    db.commit()
    return made

def run_notification_scheduler():
    from database import SessionLocal
    with SessionLocal() as db:
        try:
            generate_reminders(db)
        except Exception:
            db.rollback()
            logger.exception('Notification scheduling failed; retrying on the next tick')


def run_push_scheduler():
    from database import SessionLocal
    from services.notification_push import deliver_push
    with SessionLocal() as db:
        try:
            deliver_push(db)
        except Exception:
            db.rollback()
            logger.exception('Push sender failed; retrying on the next tick')
