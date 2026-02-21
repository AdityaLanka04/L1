import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

import models
from database import get_db
from deps import get_current_user, get_user_by_username, get_user_by_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["notifications"])


def _parse_hours_list(raw: str) -> List[float]:
    hours = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            hours.append(float(part))
        except ValueError:
            continue
    return sorted(set(hours))


def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _format_offline_duration(hours: float) -> str:
    if hours < 24:
        rounded = max(1, int(hours))
        return f"{rounded} hour{'s' if rounded != 1 else ''}"
    days = int(hours // 24)
    return f"{days} day{'s' if days != 1 else ''}"


def _get_reminder_notif_meta(reminder: models.Reminder) -> tuple[str, str]:
    notif_type = "calendar_event" if reminder.reminder_type in ("event", "calendar_event") else "reminder"
    title_prefix = "Event" if notif_type == "calendar_event" else "Reminder"
    return notif_type, title_prefix


@router.get("/get_notifications")
async def get_notifications(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Getting notifications for user: {user_id}")
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)

        if not user:
            logger.warning(f"User not found for notifications: {user_id}")
            return {"notifications": []}

        logger.info(f"Found user with id: {user.id}")

        now = datetime.utcnow()
        upcoming_reminders = db.query(models.Reminder).filter(
            models.Reminder.user_id == user.id,
            models.Reminder.is_completed == False,
            models.Reminder.is_notified == False,
            models.Reminder.reminder_date > now
        ).all()

        for reminder in upcoming_reminders:
            notif_type, title_prefix = _get_reminder_notif_meta(reminder)
            time_until = reminder.reminder_date - now
            minutes_until = time_until.total_seconds() / 60

            if minutes_until <= reminder.notify_before_minutes:
                existing = db.query(models.Notification).filter(
                    models.Notification.user_id == user.id,
                    models.Notification.notification_type == notif_type,
                    models.Notification.title.contains(reminder.title),
                    models.Notification.created_at >= datetime.now() - timedelta(hours=1)
                ).first()

                if not existing:
                    notification = models.Notification(
                        user_id=user.id,
                        title=f"{title_prefix}: {reminder.title}",
                        message=f"{reminder.description or 'Upcoming reminder'} at {reminder.reminder_date.isoformat()}",
                        notification_type=notif_type
                    )
                    db.add(notification)
                    reminder.is_notified = True
                    db.commit()
                    logger.info(f"Created reminder notification for: {reminder.title}")

        # Inactivity reminder (offline for configured thresholds)
        inactivity_hours = _parse_hours_list(os.getenv("INACTIVITY_NOTIFICATION_HOURS", "72,168"))
        if inactivity_hours:
            # Determine most recent activity timestamp
            activity_candidates = []

            user_stats = db.query(models.UserStats).filter(
                models.UserStats.user_id == user.id
            ).first()
            if user_stats and user_stats.last_activity:
                activity_candidates.append(_normalize_dt(user_stats.last_activity))

            gam_stats = db.query(models.UserGamificationStats).filter(
                models.UserGamificationStats.user_id == user.id
            ).first()
            if gam_stats and gam_stats.last_activity_date:
                activity_candidates.append(_normalize_dt(gam_stats.last_activity_date))

            if user.created_at:
                activity_candidates.append(_normalize_dt(user.created_at))

            last_activity = max([dt for dt in activity_candidates if dt], default=None)
            if last_activity:
                hours_offline = (now - last_activity).total_seconds() / 3600
                threshold_met = max([h for h in inactivity_hours if hours_offline >= h], default=None)
                if threshold_met is not None:
                    existing_inactivity = db.query(models.Notification).filter(
                        models.Notification.user_id == user.id,
                        models.Notification.notification_type == "inactivity",
                        models.Notification.created_at >= last_activity
                    ).first()

                    if not existing_inactivity:
                        overdue_count = db.query(models.Reminder).filter(
                            models.Reminder.user_id == user.id,
                            models.Reminder.is_completed == False,
                            models.Reminder.reminder_date != None,
                            models.Reminder.reminder_date <= now
                        ).count()

                        offline_duration = _format_offline_duration(hours_offline)
                        message = f"You've been away for {offline_duration}. Ready to jump back in?"
                        if overdue_count > 0:
                            suffix = "reminders" if overdue_count != 1 else "reminder"
                            message += f" You also have {overdue_count} overdue {suffix}."

                        inactivity_notification = models.Notification(
                            user_id=user.id,
                            title="Welcome Back!",
                            message=message,
                            notification_type="inactivity"
                        )
                        db.add(inactivity_notification)
                        db.commit()

        notifications = db.query(models.Notification).filter(
            models.Notification.user_id == user.id
        ).order_by(models.Notification.created_at.desc()).all()

        logger.info(f"Found {len(notifications)} notifications")

        return {
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "notification_type": n.notification_type,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() + 'Z'
                }
                for n in notifications
            ]
        }
    except HTTPException as he:
        logger.error(f"HTTPException in get_notifications: {he.detail}")
        raise
    except Exception as e:
        logger.error(f"Error getting notifications: {str(e)}", exc_info=True)
        return {"notifications": []}


@router.put("/mark_notification_read/{notification_id}")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db)
):
    try:
        notification = db.query(models.Notification).filter(
            models.Notification.id == notification_id
        ).first()

        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        notification.is_read = True
        db.commit()

        return {"status": "success", "message": "Notification marked as read"}
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/mark_all_notifications_read")
async def mark_all_notifications_read(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        db.query(models.Notification).filter(
            models.Notification.user_id == user.id,
            models.Notification.is_read == False
        ).update({"is_read": True})

        db.commit()

        return {"status": "success", "message": "All notifications marked as read"}
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create_notification")
async def create_notification(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        title = payload.get("title")
        message = payload.get("message")
        notification_type = payload.get("notification_type", "general")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        notification = models.Notification(
            user_id=user.id,
            title=title,
            message=message,
            notification_type=notification_type
        )

        db.add(notification)
        db.commit()
        db.refresh(notification)

        return {
            "status": "success",
            "notification_id": notification.id,
            "message": "Notification created"
        }
    except Exception as e:
        logger.error(f"Error creating notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug_notifications")
async def debug_notifications(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            return {"error": "User not found", "user_id": user_id}

        notifications = db.query(models.Notification).filter(
            models.Notification.user_id == user.id
        ).all()

        return {
            "user_id": user.id,
            "username": user.username,
            "total_notifications": len(notifications),
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message[:100],
                    "type": n.notification_type,
                    "is_read": n.is_read,
                    "created_at": str(n.created_at)
                }
                for n in notifications
            ]
        }
    except Exception as e:
        return {"error": str(e)}


@router.delete("/delete_notification/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db)
):
    try:
        notification = db.query(models.Notification).filter(
            models.Notification.id == notification_id
        ).first()

        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        db.delete(notification)
        db.commit()

        return {"status": "success", "message": "Notification deleted"}
    except Exception as e:
        logger.error(f"Error deleting notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear_old_notifications")
async def clear_old_notifications(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Clearing old notifications for user: {user_id}")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"status": "success", "cleared": 0, "message": "User not found, nothing to clear"}

        deleted = db.query(models.Notification).filter(
            models.Notification.user_id == user.id
        ).delete()

        db.commit()

        logger.info(f"Cleared {deleted} old notifications for user {user_id}")
        return {"status": "success", "cleared": deleted, "message": f"Cleared {deleted} old notifications"}
    except Exception as e:
        logger.error(f"Error clearing notifications: {str(e)}")
        return {"status": "error", "cleared": 0, "message": str(e)}


@router.delete("/clear_all_notifications")
async def clear_all_notifications(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Clearing ALL notifications for user: {user_id}")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"status": "success", "cleared": 0, "message": "User not found"}

        deleted = db.query(models.Notification).filter(
            models.Notification.user_id == user.id
        ).delete()

        db.commit()

        logger.info(f"Cleared {deleted} notifications for user {user_id}")
        return {"status": "success", "cleared": deleted, "message": f"Cleared {deleted} notifications"}
    except Exception as e:
        logger.error(f"Error clearing all notifications: {str(e)}")
        db.rollback()
        return {"status": "error", "cleared": 0, "message": str(e)}


@router.get("/check_reminder_notifications")
async def check_reminder_notifications(
    user_id: str = Query(...),
    current_time: str = Query(None),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            return {"status": "error", "message": "User not found", "notifications_created": 0}

        if current_time:
            try:
                now = datetime.fromisoformat(current_time.replace('Z', '').replace('+00:00', ''))
                logger.info(f"Using client time: {now}")
            except Exception:
                now = datetime.now()
                logger.info(f"Failed to parse client time, using server time: {now}")
        else:
            now = datetime.now()
            logger.info(f"No client time provided, using server time: {now}")

        notifications_created = []

        pending_reminders = db.query(models.Reminder).filter(
            models.Reminder.user_id == user.id,
            models.Reminder.is_completed == False,
            models.Reminder.is_notified == False,
            models.Reminder.reminder_date != None
        ).all()

        logger.info(f"Found {len(pending_reminders)} pending reminders for user {user_id}")

        for reminder in pending_reminders:
            if not reminder.reminder_date:
                continue

            time_until = reminder.reminder_date - now
            minutes_until = time_until.total_seconds() / 60

            logger.info(f"Reminder '{reminder.title}': scheduled={reminder.reminder_date}, now={now}, minutes_until={minutes_until:.1f}, notify_before={reminder.notify_before_minutes}")

            notify_window_start = reminder.notify_before_minutes
            is_in_notify_window = minutes_until <= notify_window_start and minutes_until >= -30

            if is_in_notify_window:
                notif_type, title_prefix = _get_reminder_notif_meta(reminder)
                existing_notification = db.query(models.Notification).filter(
                    models.Notification.user_id == user.id,
                    models.Notification.notification_type == notif_type,
                    models.Notification.title.contains(reminder.title),
                    models.Notification.created_at >= datetime.now() - timedelta(hours=1)
                ).first()

                if existing_notification:
                    logger.info(f"Skipping duplicate notification for: {reminder.title}")
                    continue

                reminder_time = reminder.reminder_date.strftime('%I:%M %p')
                reminder_date_str = reminder.reminder_date.strftime('%B %d, %Y at %I:%M %p')

                base_title = f"{title_prefix}: {reminder.title}"
                if minutes_until <= 0:
                    notification = models.Notification(
                        user_id=user.id,
                        title=f"{base_title} - NOW!",
                        message=f"{reminder.description or 'Your event is happening now!'} - Scheduled for {reminder_time}",
                        notification_type=notif_type
                    )
                elif minutes_until <= 5:
                    notification = models.Notification(
                        user_id=user.id,
                        title=f"{base_title} - In {int(minutes_until)} min!",
                        message=f"{reminder.description or 'Your reminder is coming up!'} - Due at {reminder_time}",
                        notification_type=notif_type
                    )
                else:
                    notification = models.Notification(
                        user_id=user.id,
                        title=f"{base_title}",
                        message=f"{reminder.description or 'Your scheduled reminder'} - Due at {reminder_time} (in {int(minutes_until)} min)",
                        notification_type=notif_type
                    )

                db.add(notification)
                reminder.is_notified = True

                notifications_created.append({
                    "reminder_id": reminder.id,
                    "title": reminder.title,
                    "minutes_until": round(minutes_until),
                    "reminder_time": reminder_date_str
                })

                logger.info(f"Created reminder notification for: {reminder.title} at {reminder_date_str}")

        if notifications_created:
            db.commit()
            logger.info(f"Created {len(notifications_created)} reminder notifications")

        return {
            "status": "success",
            "notifications_created": len(notifications_created),
            "details": notifications_created,
            "server_time": datetime.now().isoformat(),
            "client_time_received": current_time
        }
    except Exception as e:
        logger.error(f"Error checking reminder notifications: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return {"status": "error", "message": str(e), "notifications_created": 0}
