import json
import re
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Body, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from jose import JWTError, jwt

import models
from database import get_db
from deps import get_current_user, call_ai, get_user_by_username, get_user_by_email, verify_token, SECRET_KEY, ALGORITHM
from websocket_manager import manager, notify_battle_challenge, notify_battle_accepted, notify_battle_declined, notify_battle_started, notify_battle_completed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["social"])

ws_router = APIRouter(tags=["websocket"])

security = HTTPBearer()

class ShareContentRequest(BaseModel):
    content_type: str
    content_id: int
    friend_ids: List[int]
    message: Optional[str] = None
    permission: str = "view"

@router.get("/search_users")
async def search_users(
    query: str = Query(..., min_length=1),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        search_pattern = f"%{query}%"
        users = db.query(models.User).filter(
            and_(
                models.User.id != current_user.id,
                (models.User.username.ilike(search_pattern) | models.User.email.ilike(search_pattern))
            )
        ).limit(20).all()

        result = []
        for user in users:
            comp_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == user.id
            ).first()

            gam_stats = db.query(models.UserGamificationStats).filter(
                models.UserGamificationStats.user_id == user.id
            ).first()

            friendship = db.query(models.Friendship).filter(
                and_(
                    models.Friendship.user_id == current_user.id,
                    models.Friendship.friend_id == user.id
                )
            ).first()

            pending_request_sent = db.query(models.FriendRequest).filter(
                and_(
                    models.FriendRequest.sender_id == current_user.id,
                    models.FriendRequest.receiver_id == user.id,
                    models.FriendRequest.status == "pending"
                )
            ).first()

            pending_request_received = db.query(models.FriendRequest).filter(
                and_(
                    models.FriendRequest.sender_id == user.id,
                    models.FriendRequest.receiver_id == current_user.id,
                    models.FriendRequest.status == "pending"
                )
            ).first()

            preferred_subjects = []
            if comp_profile and comp_profile.preferred_subjects:
                try:
                    preferred_subjects = json.loads(comp_profile.preferred_subjects)
                except Exception:
                    preferred_subjects = []

            result.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "picture_url": user.picture_url or "",
                "field_of_study": user.field_of_study or "",
                "preferred_subjects": preferred_subjects,
                "stats": {
                    "ai_chats": gam_stats.total_ai_chats if gam_stats else 0,
                    "flashcards": gam_stats.total_flashcards_created if gam_stats else 0,
                    "notes": gam_stats.total_notes_created if gam_stats else 0,
                    "quizzes": gam_stats.total_quizzes_completed if gam_stats else 0
                },
                "is_friend": friendship is not None,
                "request_sent": pending_request_sent is not None,
                "request_received": pending_request_received is not None
            })

        return {"users": result}

    except Exception as e:
        logger.error(f"Error searching users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send_friend_request")
async def send_friend_request(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        receiver_id = payload.get("receiver_id")
        if not receiver_id:
            raise HTTPException(status_code=400, detail="receiver_id is required")

        receiver = db.query(models.User).filter(models.User.id == receiver_id).first()
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")

        existing_friendship = db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == receiver_id
            )
        ).first()

        if existing_friendship:
            raise HTTPException(status_code=400, detail="Already friends")

        existing_request = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.sender_id == current_user.id,
                models.FriendRequest.receiver_id == receiver_id,
                models.FriendRequest.status == "pending"
            )
        ).first()

        if existing_request:
            raise HTTPException(status_code=400, detail="Friend request already sent")

        friend_request = models.FriendRequest(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            status="pending"
        )
        db.add(friend_request)

        notification = models.Notification(
            user_id=receiver_id,
            title="New Friend Request",
            message=f"{current_user.username} wants to be your friend!",
            notification_type="friend_request",
            is_read=False
        )
        db.add(notification)
        db.commit()

        return {
            "status": "success",
            "message": "Friend request sent successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending friend request: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/friend_requests")
async def get_friend_requests(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        received_requests = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.receiver_id == current_user.id,
                models.FriendRequest.status == "pending"
            )
        ).all()

        sent_requests = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.sender_id == current_user.id,
                models.FriendRequest.status == "pending"
            )
        ).all()

        received_result = []
        for req in received_requests:
            sender = req.sender
            received_result.append({
                "request_id": req.id,
                "user_id": sender.id,
                "username": sender.username,
                "email": sender.email,
                "first_name": sender.first_name or "",
                "last_name": sender.last_name or "",
                "picture_url": sender.picture_url or "",
                "created_at": req.created_at.isoformat() + "Z"
            })

        sent_result = []
        for req in sent_requests:
            receiver = req.receiver
            sent_result.append({
                "request_id": req.id,
                "user_id": receiver.id,
                "username": receiver.username,
                "email": receiver.email,
                "first_name": receiver.first_name or "",
                "last_name": receiver.last_name or "",
                "picture_url": receiver.picture_url or "",
                "created_at": req.created_at.isoformat() + "Z"
            })

        return {
            "received": received_result,
            "sent": sent_result
        }

    except Exception as e:
        logger.error(f"Error getting friend requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/respond_friend_request")
async def respond_friend_request(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        request_id = payload.get("request_id")
        action = payload.get("action")

        if not request_id or not action:
            raise HTTPException(status_code=400, detail="request_id and action are required")

        friend_request = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.id == request_id,
                models.FriendRequest.receiver_id == current_user.id,
                models.FriendRequest.status == "pending"
            )
        ).first()

        if not friend_request:
            raise HTTPException(status_code=404, detail="Friend request not found")

        if action == "accept":
            friend_request.status = "accepted"
            friend_request.responded_at = datetime.now(timezone.utc)

            friendship1 = models.Friendship(
                user_id=current_user.id,
                friend_id=friend_request.sender_id
            )
            friendship2 = models.Friendship(
                user_id=friend_request.sender_id,
                friend_id=current_user.id
            )

            db.add(friendship1)
            db.add(friendship2)

            notification = models.Notification(
                user_id=friend_request.sender_id,
                title="Friend Request Accepted!",
                message=f"{current_user.username} accepted your friend request. You're now friends!",
                notification_type="friend_accepted",
                is_read=False
            )
            db.add(notification)
            db.commit()

            return {
                "status": "success",
                "message": "Friend request accepted"
            }

        elif action == "reject":
            friend_request.status = "rejected"
            friend_request.responded_at = datetime.now(timezone.utc)
            notification = models.Notification(
                user_id=friend_request.sender_id,
                title="Friend Request Declined",
                message=f"{current_user.username} declined your friend request.",
                notification_type="friend_rejected",
                is_read=False
            )
            db.add(notification)
            db.commit()

            return {
                "status": "success",
                "message": "Friend request rejected"
            }

        else:
            raise HTTPException(status_code=400, detail="Invalid action")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to friend request: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/friends")
async def get_friends(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        friendships = db.query(models.Friendship).filter(
            models.Friendship.user_id == current_user.id
        ).all()

        result = []
        for friendship in friendships:
            friend = friendship.friend

            comp_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == friend.id
            ).first()

            gam_stats = db.query(models.UserGamificationStats).filter(
                models.UserGamificationStats.user_id == friend.id
            ).first()

            preferred_subjects = []
            if comp_profile and comp_profile.preferred_subjects:
                try:
                    preferred_subjects = json.loads(comp_profile.preferred_subjects)
                except Exception:
                    preferred_subjects = []

            result.append({
                "id": friend.id,
                "username": friend.username,
                "email": friend.email,
                "first_name": friend.first_name or "",
                "last_name": friend.last_name or "",
                "picture_url": friend.picture_url or "",
                "field_of_study": friend.field_of_study or "",
                "preferred_subjects": preferred_subjects,
                "stats": {
                    "ai_chats": gam_stats.total_ai_chats if gam_stats else 0,
                    "flashcards": gam_stats.total_flashcards_created if gam_stats else 0,
                    "notes": gam_stats.total_notes_created if gam_stats else 0,
                    "quizzes": gam_stats.total_quizzes_completed if gam_stats else 0
                },
                "friends_since": friendship.created_at.isoformat() + "Z"
            })

        return {"friends": result}

    except Exception as e:
        logger.error(f"Error getting friends: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/remove_friend")
async def remove_friend(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")

        friend_id = payload.get("friend_id")
        if not friend_id:
            raise HTTPException(status_code=400, detail="friend_id is required")

        db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == friend_id
            )
        ).delete()

        db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == friend_id,
                models.Friendship.friend_id == current_user.id
            )
        ).delete()

        notification = models.Notification(
            user_id=friend_id,
            title="Friend Removed",
            message=f"{current_user.username} removed you from their friends list.",
            notification_type="friend_removed",
            is_read=False
        )
        db.add(notification)

        db.commit()

        return {
            "status": "success",
            "message": "Friend removed successfully"
        }

    except Exception as e:
        logger.error(f"Error removing friend: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/friend_activity_feed")
async def get_friend_activity_feed(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    limit: int = Query(50, le=100)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        friendships = db.query(models.Friendship).filter(
            models.Friendship.user_id == current_user.id
        ).all()
        friend_ids = [f.friend_id for f in friendships]

        if not friend_ids:
            return {"activities": []}

        activities = db.query(models.FriendActivity).filter(
            models.FriendActivity.user_id.in_(friend_ids)
        ).order_by(models.FriendActivity.created_at.desc()).limit(limit).all()

        result = []
        for activity in activities:
            kudos_count = db.query(models.Kudos).filter(
                models.Kudos.activity_id == activity.id
            ).count()

            user_gave_kudos = db.query(models.Kudos).filter(
                and_(
                    models.Kudos.activity_id == activity.id,
                    models.Kudos.user_id == current_user.id
                )
            ).first() is not None

            result.append({
                "id": activity.id,
                "user": {
                    "id": activity.user.id,
                    "username": activity.user.username,
                    "first_name": activity.user.first_name or "",
                    "last_name": activity.user.last_name or "",
                    "picture_url": activity.user.picture_url or ""
                },
                "activity_type": activity.activity_type,
                "title": activity.title,
                "description": activity.description or "",
                "icon": activity.icon or "Trophy",
                "metadata": json.loads(activity.activity_data) if activity.activity_data else {},
                "kudos_count": kudos_count,
                "user_gave_kudos": user_gave_kudos,
                "created_at": activity.created_at.isoformat() + "Z"
            })

        return {"activities": result}

    except Exception as e:
        logger.error(f"Error fetching friend activity feed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/give_kudos")
async def give_kudos(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        activity_id = payload.get("activity_id")
        reaction_type = payload.get("reaction_type", "👏")

        if not activity_id:
            raise HTTPException(status_code=400, detail="activity_id is required")

        existing = db.query(models.Kudos).filter(
            and_(
                models.Kudos.activity_id == activity_id,
                models.Kudos.user_id == current_user.id
            )
        ).first()

        if existing:
            db.delete(existing)
            db.commit()
            return {"status": "removed", "message": "Kudos removed"}
        else:
            kudos = models.Kudos(
                activity_id=activity_id,
                user_id=current_user.id,
                reaction_type=reaction_type
            )
            db.add(kudos)
            db.commit()
            return {"status": "added", "message": "Kudos given"}

    except Exception as e:
        logger.error(f"Error giving kudos: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create_activity")
async def create_activity(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        activity = models.FriendActivity(
            user_id=current_user.id,
            activity_type=payload.get("activity_type"),
            title=payload.get("title"),
            description=payload.get("description", ""),
            icon=payload.get("icon", "Trophy"),
            activity_data=json.dumps(payload.get("metadata", {}))
        )

        db.add(activity)
        db.commit()

        return {"status": "success", "activity_id": activity.id}

    except Exception as e:
        logger.error(f"Error creating activity: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/leaderboard")
async def get_leaderboard(
    category: str = Query("global", pattern="^(global|friends|subject|archetype)$"),
    metric: str = Query("total_hours", pattern="^(total_hours|accuracy|streak|lessons)$"),
    period: str = Query("all_time", pattern="^(weekly|monthly|all_time)$"),
    subject: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        if category == "friends":
            friendships = db.query(models.Friendship).filter(
                models.Friendship.user_id == current_user.id
            ).all()
            user_ids = [f.friend_id for f in friendships] + [current_user.id]
        else:
            user_ids = None

        query = db.query(models.UserStats, models.User).join(
            models.User, models.UserStats.user_id == models.User.id
        )

        if user_ids:
            query = query.filter(models.UserStats.user_id.in_(user_ids))

        if metric == "total_hours":
            query = query.order_by(models.UserStats.total_hours.desc())
            score_field = "total_hours"
        elif metric == "accuracy":
            query = query.order_by(models.UserStats.accuracy_percentage.desc())
            score_field = "accuracy_percentage"
        elif metric == "streak":
            query = query.order_by(models.UserStats.day_streak.desc())
            score_field = "day_streak"
        else:
            query = query.order_by(models.UserStats.total_lessons.desc())
            score_field = "total_lessons"

        results = query.limit(limit).all()

        leaderboard = []
        for rank, (stats, user) in enumerate(results, start=1):
            score = getattr(stats, score_field)
            leaderboard.append({
                "rank": rank,
                "user_id": user.id,
                "username": user.username,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "picture_url": user.picture_url or "",
                "score": round(score, 1) if isinstance(score, float) else score,
                "metric": metric,
                "is_current_user": user.id == current_user.id
            })

        current_user_rank = next((item for item in leaderboard if item["is_current_user"]), None)

        return {
            "leaderboard": leaderboard,
            "current_user_rank": current_user_rank,
            "category": category,
            "metric": metric,
            "period": period
        }

    except Exception as e:
        logger.error(f"Error fetching leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create_quiz_battle")
async def create_quiz_battle(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        opponent_id = payload.get("opponent_id")
        subject = payload.get("subject")
        difficulty = payload.get("difficulty", "intermediate")
        question_count = payload.get("question_count", 10)
        time_limit = payload.get("time_limit_seconds", 300)

        if not opponent_id or not subject:
            raise HTTPException(status_code=400, detail="opponent_id and subject are required")

        friendship = db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == opponent_id
            )
        ).first()

        if not friendship:
            raise HTTPException(status_code=400, detail="Can only battle with friends")

        battle = models.QuizBattle(
            challenger_id=current_user.id,
            opponent_id=opponent_id,
            subject=subject,
            difficulty=difficulty,
            question_count=question_count,
            time_limit_seconds=time_limit,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )

        db.add(battle)
        db.commit()
        db.refresh(battle)

        logger.info(f"Battle created: ID={battle.id}")

        battle_notification = models.Notification(
            user_id=opponent_id,
            title="Quiz Battle Challenge",
            message=f"{current_user.username} has challenged you to a quiz battle on {subject}!",
            notification_type="battle_challenge",
            is_read=False
        )
        db.add(battle_notification)
        db.commit()

        battle_data = {
            "id": battle.id,
            "subject": battle.subject,
            "difficulty": battle.difficulty,
            "question_count": battle.question_count,
            "time_limit_seconds": battle.time_limit_seconds,
            "challenger": {
                "id": current_user.id,
                "username": current_user.username,
                "first_name": current_user.first_name or "",
                "last_name": current_user.last_name or "",
                "picture_url": current_user.picture_url or ""
            },
            "is_challenger": False
        }

        notification_sent = await notify_battle_challenge(opponent_id, battle_data)

        if notification_sent:
            logger.info(f"Notification sent to opponent {opponent_id}")
        else:
            logger.warning(f"Opponent {opponent_id} not connected to WebSocket - notification not sent")

        logger.info(f"Active WebSocket connections: {list(manager.active_connections.keys())}")

        return {
            "status": "success",
            "battle_id": battle.id,
            "message": "Quiz battle created",
            "notification_sent": notification_sent,
            "opponent_connected": notification_sent
        }

    except Exception as e:
        logger.error(f"Error creating battle: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quiz_battles")
async def get_quiz_battles(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    status: str = Query("active", pattern="^(pending|active|completed|all)$")
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        query = db.query(models.QuizBattle).filter(
            (models.QuizBattle.challenger_id == current_user.id) |
            (models.QuizBattle.opponent_id == current_user.id)
        )

        if status != "all":
            query = query.filter(models.QuizBattle.status == status)

        battles = query.order_by(models.QuizBattle.created_at.desc()).all()

        result = []
        for battle in battles:
            is_challenger = battle.challenger_id == current_user.id
            opponent = battle.opponent if is_challenger else battle.challenger

            result.append({
                "id": battle.id,
                "opponent": {
                    "id": opponent.id,
                    "username": opponent.username,
                    "first_name": opponent.first_name or "",
                    "last_name": opponent.last_name or "",
                    "picture_url": opponent.picture_url or ""
                },
                "subject": battle.subject,
                "difficulty": battle.difficulty,
                "status": battle.status,
                "question_count": battle.question_count,
                "time_limit_seconds": battle.time_limit_seconds,
                "your_score": battle.challenger_score if is_challenger else battle.opponent_score,
                "opponent_score": battle.opponent_score if is_challenger else battle.challenger_score,
                "your_completed": battle.challenger_completed if is_challenger else battle.opponent_completed,
                "opponent_completed": battle.opponent_completed if is_challenger else battle.challenger_completed,
                "is_challenger": is_challenger,
                "created_at": battle.created_at.isoformat() + "Z",
                "expires_at": battle.expires_at.isoformat() + "Z" if battle.expires_at else None
            })

        return {"battles": result}

    except Exception as e:
        logger.error(f"Error fetching quiz battles: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete_quiz_battle")
async def complete_quiz_battle(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        battle_id = payload.get("battle_id")
        score = payload.get("score")
        answers = payload.get("answers", [])

        if not battle_id or score is None:
            raise HTTPException(status_code=400, detail="battle_id and score are required")

        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()

        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        is_challenger = battle.challenger_id == current_user.id
        if is_challenger:
            battle.challenger_score = score
            battle.challenger_completed = True
            battle.challenger_answers = json.dumps(answers)
        else:
            battle.opponent_score = score
            battle.opponent_completed = True
            battle.opponent_answers = json.dumps(answers)

        opponent_id = battle.opponent_id if is_challenger else battle.challenger_id

        if battle.challenger_completed and battle.opponent_completed:
            battle.status = "completed"
            battle.completed_at = datetime.now(timezone.utc)

            winner_id = battle.challenger_id if battle.challenger_score > battle.opponent_score else battle.opponent_id
            winner = battle.challenger if winner_id == battle.challenger_id else battle.opponent
            loser = battle.opponent if winner_id == battle.challenger_id else battle.challenger

            winner_score = battle.challenger_score if winner_id == battle.challenger_id else battle.opponent_score
            loser_score = battle.opponent_score if winner_id == battle.challenger_id else battle.challenger_score

            activity = models.FriendActivity(
                user_id=winner_id,
                activity_type="quiz_battle_won",
                title="Won Quiz Battle!",
                description=f"Defeated {loser.username} in {battle.subject}",
                icon="Swords",
                activity_data=json.dumps({
                    "winner_score": winner_score,
                    "loser_score": loser_score,
                    "subject": battle.subject
                })
            )
            db.add(activity)

            total_questions = battle.question_count or 10
            winner_percentage = round((winner_score / total_questions) * 100) if total_questions > 0 else 0
            loser_percentage = round((loser_score / total_questions) * 100) if total_questions > 0 else 0

            winner_notification = models.Notification(
                user_id=winner_id,
                title="Battle Victory",
                message=f"You won the quiz battle against {loser.username}! Score: {winner_score}/{total_questions} ({winner_percentage}%)",
                notification_type="battle_won"
            )
            db.add(winner_notification)

            loser_notification = models.Notification(
                user_id=loser.id,
                title="Battle Complete",
                message=f"Good effort! You scored {loser_score}/{total_questions} ({loser_percentage}%) against {winner.username}. Practice and challenge them again!",
                notification_type="battle_lost"
            )
            db.add(loser_notification)
        elif battle.status == "pending":
            battle.status = "active"
            battle.started_at = datetime.now(timezone.utc)

        db.commit()

        await manager.send_personal_message({
            "type": "battle_opponent_completed",
            "battle_id": battle.id,
            "opponent_completed": True
        }, opponent_id)

        if battle.challenger_completed and battle.opponent_completed:
            await notify_battle_completed(
                [battle.challenger_id, battle.opponent_id],
                battle.id,
                battle.challenger_id if battle.challenger_score > battle.opponent_score else battle.opponent_id
            )

        return {
            "status": "success",
            "battle_status": battle.status,
            "message": "Score submitted",
            "both_completed": battle.challenger_completed and battle.opponent_completed
        }

    except Exception as e:
        logger.error(f"Error completing quiz battle: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create_challenge")
async def create_challenge(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        challenge = models.Challenge(
            creator_id=current_user.id,
            title=payload.get("title"),
            description=payload.get("description", ""),
            challenge_type=payload.get("challenge_type"),
            subject=payload.get("subject"),
            target_metric=payload.get("target_metric"),
            target_value=payload.get("target_value"),
            time_limit_minutes=payload.get("time_limit_minutes"),
            starts_at=datetime.now(timezone.utc),
            ends_at=datetime.now(timezone.utc) + timedelta(minutes=payload.get("time_limit_minutes", 60))
        )

        db.add(challenge)
        db.commit()

        return {
            "status": "success",
            "challenge_id": challenge.id
        }

    except Exception as e:
        logger.error(f"Error creating challenge: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/challenges")
async def get_challenges(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    filter_type: str = Query("active", pattern="^(active|completed|my_challenges|all)$")
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        query = db.query(models.Challenge)

        if filter_type == "my_challenges":
            query = query.filter(models.Challenge.creator_id == current_user.id)
        elif filter_type != "all":
            query = query.filter(models.Challenge.status == filter_type)

        challenges = query.order_by(models.Challenge.created_at.desc()).all()

        result = []
        for challenge in challenges:
            participation = db.query(models.ChallengeParticipation).filter(
                and_(
                    models.ChallengeParticipation.challenge_id == challenge.id,
                    models.ChallengeParticipation.user_id == current_user.id
                )
            ).first()

            result.append({
                "id": challenge.id,
                "creator": {
                    "id": challenge.creator.id,
                    "username": challenge.creator.username,
                    "first_name": challenge.creator.first_name or "",
                    "last_name": challenge.creator.last_name or ""
                },
                "title": challenge.title,
                "description": challenge.description or "",
                "challenge_type": challenge.challenge_type,
                "subject": challenge.subject or "",
                "target_metric": challenge.target_metric,
                "target_value": challenge.target_value,
                "time_limit_minutes": challenge.time_limit_minutes,
                "status": challenge.status,
                "participant_count": challenge.participant_count,
                "is_participating": participation is not None,
                "user_progress": participation.progress if participation else 0,
                "user_completed": participation.completed if participation else False,
                "created_at": challenge.created_at.isoformat() + "Z",
                "ends_at": challenge.ends_at.isoformat() + "Z" if challenge.ends_at else None
            })

        return {"challenges": result}

    except Exception as e:
        logger.error(f"Error fetching challenges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/join_challenge")
async def join_challenge(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        challenge_id = payload.get("challenge_id")
        if not challenge_id:
            raise HTTPException(status_code=400, detail="challenge_id is required")

        existing = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="Already participating in this challenge")

        participation = models.ChallengeParticipation(
            challenge_id=challenge_id,
            user_id=current_user.id
        )

        db.add(participation)

        challenge = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
        if challenge:
            challenge.participant_count += 1
            if challenge.creator_id != current_user.id:
                join_notification = models.Notification(
                    user_id=challenge.creator_id,
                    title="Challenge Joined",
                    message=f"{current_user.username} joined your challenge '{challenge.title}'.",
                    notification_type="challenge_joined",
                    is_read=False
                )
                db.add(join_notification)

        db.commit()

        return {"status": "success", "message": "Joined challenge"}

    except Exception as e:
        logger.error(f"Error joining challenge: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quiz_battle/{battle_id}")
async def get_quiz_battle_detail(
    battle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()

        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        if battle.challenger_id != current_user.id and battle.opponent_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this battle")

        questions = db.query(models.BattleQuestion).filter(
            models.BattleQuestion.battle_id == battle_id
        ).all()

        question_list = []
        for q in questions:
            question_list.append({
                "id": q.id,
                "question": q.question,
                "options": json.loads(q.options),
                "correct_answer": q.correct_answer,
                "explanation": q.explanation
            })

        is_challenger = battle.challenger_id == current_user.id

        try:
            opponent_id = battle.opponent_id if is_challenger else battle.challenger_id
            opponent = db.query(models.User).filter(models.User.id == opponent_id).first()
            if not opponent:
                raise HTTPException(status_code=404, detail="Opponent not found")
        except Exception as e:
            logger.error(f"Error getting opponent: {str(e)}")
            raise HTTPException(status_code=500, detail="Error loading battle opponent")

        battle_data = {
            "id": battle.id,
            "subject": battle.subject,
            "difficulty": battle.difficulty,
            "status": battle.status,
            "question_count": battle.question_count,
            "time_limit_seconds": battle.time_limit_seconds,
            "your_score": battle.challenger_score if is_challenger else battle.opponent_score,
            "opponent_score": battle.opponent_score if is_challenger else battle.challenger_score,
            "your_completed": battle.challenger_completed if is_challenger else battle.opponent_completed,
            "opponent_completed": battle.opponent_completed if is_challenger else battle.challenger_completed,
            "is_challenger": is_challenger,
            "opponent": {
                "id": opponent.id,
                "username": opponent.username,
                "first_name": opponent.first_name or "",
                "last_name": opponent.last_name or "",
                "picture_url": opponent.picture_url or ""
            }
        }

        if battle.challenger_completed and battle.opponent_completed:
            try:
                your_answers_raw = battle.challenger_answers if is_challenger else battle.opponent_answers
                opponent_answers_raw = battle.opponent_answers if is_challenger else battle.challenger_answers
                battle_data["your_answers"] = json.loads(your_answers_raw) if your_answers_raw else []
                battle_data["opponent_answers"] = json.loads(opponent_answers_raw) if opponent_answers_raw else []
            except Exception:
                pass

        return {
            "battle": battle_data,
            "questions": question_list
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting battle detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate_battle_questions")
async def generate_battle_questions(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        battle_id = payload.get("battle_id")
        subject = payload.get("subject")
        difficulty = payload.get("difficulty", "intermediate")
        question_count = payload.get("question_count", 10)

        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()

        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        if battle.challenger_id != current_user.id and battle.opponent_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        existing = db.query(models.BattleQuestion).filter(
            models.BattleQuestion.battle_id == battle_id
        ).first()

        if existing:
            questions = db.query(models.BattleQuestion).filter(
                models.BattleQuestion.battle_id == battle_id
            ).all()

            return {
                "questions": [{
                    "id": q.id,
                    "question": q.question,
                    "options": json.loads(q.options),
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation
                } for q in questions]
            }

        difficulty_map = {
            "beginner": "easy, suitable for beginners",
            "intermediate": "moderate difficulty",
            "advanced": "challenging, advanced level"
        }

        prompt = f"""Generate exactly {question_count} multiple choice questions about {subject}.
Difficulty level: {difficulty_map.get(difficulty, 'moderate')}.

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Brief explanation of the correct answer"
  }}
]

Requirements:
- Each question must have exactly 4 options
- correct_answer must be 0, 1, 2, or 3 (index of the correct option)
- Questions should be clear and unambiguous
- Explanations should be concise (1-2 sentences)
- Make questions engaging and educational
- Return ONLY the JSON array, no additional text"""

        content = call_ai(prompt, max_tokens=4000, temperature=0.7)

        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        questions_data = json.loads(content)

        for q_data in questions_data:
            options = q_data["options"]
            correct_index = q_data["correct_answer"]
            correct_answer_text = options[correct_index]
            random.shuffle(options)
            new_correct_index = options.index(correct_answer_text)
            q_data["options"] = options
            q_data["correct_answer"] = new_correct_index

        saved_questions = []
        for q_data in questions_data:
            battle_question = models.BattleQuestion(
                battle_id=battle_id,
                question=q_data["question"],
                options=json.dumps(q_data["options"]),
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation", "")
            )
            db.add(battle_question)
            db.flush()

            saved_questions.append({
                "id": battle_question.id,
                "question": battle_question.question,
                "options": q_data["options"],
                "correct_answer": battle_question.correct_answer,
                "explanation": battle_question.explanation
            })

        if battle.status == "pending":
            battle.status = "active"
            battle.started_at = datetime.now(timezone.utc)

        db.commit()

        return {"questions": saved_questions}

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating battle questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/challenge/{challenge_id}")
async def get_challenge_detail(
    challenge_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        challenge = db.query(models.Challenge).filter(
            models.Challenge.id == challenge_id
        ).first()

        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        participation = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()

        if not participation:
            raise HTTPException(status_code=403, detail="Not participating in this challenge")

        questions = db.query(models.ChallengeQuestion).filter(
            models.ChallengeQuestion.challenge_id == challenge_id
        ).all()

        question_list = []
        for q in questions:
            question_list.append({
                "id": q.id,
                "question": q.question,
                "options": json.loads(q.options),
                "correct_answer": q.correct_answer,
                "explanation": q.explanation
            })

        return {
            "challenge": {
                "id": challenge.id,
                "title": challenge.title,
                "description": challenge.description,
                "challenge_type": challenge.challenge_type,
                "subject": challenge.subject,
                "target_metric": challenge.target_metric,
                "target_value": challenge.target_value,
                "time_limit_minutes": challenge.time_limit_minutes,
                "status": challenge.status,
                "progress": participation.progress,
                "completed": participation.completed
            },
            "questions": question_list
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting challenge detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate_challenge_questions")
async def generate_challenge_questions(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        challenge_id = payload.get("challenge_id")
        subject = payload.get("subject", "General Knowledge")
        challenge_type = payload.get("challenge_type", "speed")
        question_count = payload.get("question_count", 10)

        challenge = db.query(models.Challenge).filter(
            models.Challenge.id == challenge_id
        ).first()

        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        participation = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()

        if not participation:
            raise HTTPException(status_code=403, detail="Not participating in this challenge")

        existing = db.query(models.ChallengeQuestion).filter(
            models.ChallengeQuestion.challenge_id == challenge_id
        ).first()

        if existing:
            questions = db.query(models.ChallengeQuestion).filter(
                models.ChallengeQuestion.challenge_id == challenge_id
            ).all()

            return {
                "questions": [{
                    "id": q.id,
                    "question": q.question,
                    "options": json.loads(q.options),
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation
                } for q in questions]
            }

        type_descriptions = {
            "speed": "fast-paced questions that can be answered quickly",
            "accuracy": "precise questions requiring careful consideration",
            "topic_mastery": "comprehensive questions testing deep understanding",
            "streak": "progressively challenging questions"
        }

        prompt = f"""Generate exactly {question_count} multiple choice questions about {subject}.
Challenge type: {challenge_type} - {type_descriptions.get(challenge_type, '')}.

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Brief explanation of the correct answer"
  }}
]

Requirements:
- Each question must have exactly 4 options
- correct_answer must be 0, 1, 2, or 3 (index of the correct option)
- Questions should be clear and educational
- Explanations should be concise (1-2 sentences)
- Return ONLY the JSON array, no additional text"""

        content = call_ai(prompt, max_tokens=4000, temperature=0.7)

        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        questions_data = json.loads(content)

        for q_data in questions_data:
            options = q_data["options"]
            correct_index = q_data["correct_answer"]
            correct_answer_text = options[correct_index]
            random.shuffle(options)
            new_correct_index = options.index(correct_answer_text)
            q_data["options"] = options
            q_data["correct_answer"] = new_correct_index

        saved_questions = []
        for q_data in questions_data:
            challenge_question = models.ChallengeQuestion(
                challenge_id=challenge_id,
                question=q_data["question"],
                options=json.dumps(q_data["options"]),
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation", "")
            )
            db.add(challenge_question)
            db.flush()

            saved_questions.append({
                "id": challenge_question.id,
                "question": challenge_question.question,
                "options": q_data["options"],
                "correct_answer": challenge_question.correct_answer,
                "explanation": challenge_question.explanation
            })

        db.commit()

        return {"questions": saved_questions}

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating challenge questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update_challenge_progress")
async def update_challenge_progress(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        challenge_id = payload.get("challenge_id")
        questions_answered = payload.get("questions_answered", 0)
        accuracy_percentage = payload.get("accuracy_percentage", 0)
        answers = payload.get("answers", [])

        challenge = db.query(models.Challenge).filter(
            models.Challenge.id == challenge_id
        ).first()

        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        participation = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()

        if not participation:
            raise HTTPException(status_code=404, detail="Participation not found")

        for answer_data in answers:
            battle_answer = models.ChallengeAnswer(
                challenge_id=challenge_id,
                user_id=current_user.id,
                question_id=answer_data["question_id"],
                selected_answer=answer_data["selected_answer"],
                is_correct=answer_data["is_correct"]
            )
            db.add(battle_answer)

        progress = 0
        score = questions_answered if challenge.target_metric == "questions_answered" else accuracy_percentage

        if challenge.target_metric == "questions_answered":
            progress = min((questions_answered / challenge.target_value) * 100, 100)
            participation.score = questions_answered
        elif challenge.target_metric == "accuracy_percentage":
            progress = min((accuracy_percentage / challenge.target_value) * 100, 100)
            participation.score = accuracy_percentage

        participation.progress = progress

        if progress >= 100:
            participation.completed = True
            participation.completed_at = datetime.now(timezone.utc)

            activity = models.FriendActivity(
                user_id=current_user.id,
                activity_type="challenge_completed",
                title=f"Completed Challenge: {challenge.title}",
                description=f"Achieved {progress:.1f}% progress",
                icon="trophy",
                activity_data=json.dumps({
                    "challenge_id": challenge.id,
                    "score": float(score),
                    "progress": float(progress)
                })
            )
            db.add(activity)

            notification = models.Notification(
                user_id=current_user.id,
                title="Challenge Completed",
                message=f"Congratulations! You've completed the challenge '{challenge.title}' with {progress:.0f}% progress!",
                notification_type="challenge_completed",
                is_read=False
            )
            db.add(notification)

            if challenge.creator_id != current_user.id:
                creator_notification = models.Notification(
                    user_id=challenge.creator_id,
                    title="Challenge Completed",
                    message=f"{current_user.username} completed your challenge '{challenge.title}'.",
                    notification_type="challenge_completed",
                    is_read=False
                )
                db.add(creator_notification)

        db.commit()

        return {
            "message": "Progress updated successfully",
            "progress": progress,
            "completed": participation.completed
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating challenge progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/share_content")
async def share_content(
    share_data: ShareContentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Sharing content for user {current_user.id}")

        if share_data.content_type == "note":
            content = db.query(models.Note).filter(
                models.Note.id == share_data.content_id,
                models.Note.user_id == current_user.id
            ).first()
            if not content:
                raise HTTPException(status_code=404, detail="Note not found or not owned by user")
        elif share_data.content_type == "chat":
            content = db.query(models.ChatSession).filter(
                models.ChatSession.id == share_data.content_id,
                models.ChatSession.user_id == current_user.id
            ).first()
            if not content:
                raise HTTPException(status_code=404, detail="Chat not found or not owned by user")
        else:
            raise HTTPException(status_code=400, detail="Invalid content type")

        shared_records = []
        for friend_id in share_data.friend_ids:
            friendship = db.query(models.Friendship).filter(
                and_(
                    or_(
                        and_(
                            models.Friendship.user_id == current_user.id,
                            models.Friendship.friend_id == friend_id
                        ),
                        and_(
                            models.Friendship.user_id == friend_id,
                            models.Friendship.friend_id == current_user.id
                        )
                    ),
                    models.Friendship.status == "active"
                )
            ).first()

            if not friendship:
                logger.warning(f"User {friend_id} is not a friend of {current_user.id}")
                continue

            existing_share = db.query(models.SharedContent).filter(
                models.SharedContent.owner_id == current_user.id,
                models.SharedContent.shared_with_id == friend_id,
                models.SharedContent.content_type == share_data.content_type,
                models.SharedContent.content_id == share_data.content_id
            ).first()

            if existing_share:
                existing_share.permission = share_data.permission
                existing_share.message = share_data.message
                existing_share.shared_at = datetime.now(timezone.utc)
                shared_records.append(existing_share)
                logger.info(f"Updated existing share for friend {friend_id}")
            else:
                shared_content = models.SharedContent(
                    owner_id=current_user.id,
                    shared_with_id=friend_id,
                    content_type=share_data.content_type,
                    content_id=share_data.content_id,
                    permission=share_data.permission,
                    message=share_data.message,
                    shared_at=datetime.now(timezone.utc)
                )
                db.add(shared_content)
                shared_records.append(shared_content)
                logger.info(f"Created new share for friend {friend_id}")

                content_title = content.title if hasattr(content, "title") else share_data.content_type
                share_notification = models.Notification(
                    user_id=friend_id,
                    title="New Shared Content",
                    message=f"{current_user.username} shared a {share_data.content_type} with you: {content_title}",
                    notification_type="content_shared",
                    is_read=False
                )
                db.add(share_notification)

        db.commit()

        return {
            "success": True,
            "message": f"Content shared with {len(shared_records)} friend(s)",
            "shared_count": len(shared_records)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sharing content: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shared_with_me")
def get_shared_with_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Starting shared_with_me endpoint for user: {current_user.id}")

        shared_items = db.query(models.SharedContent).filter(
            models.SharedContent.shared_with_id == current_user.id
        ).order_by(models.SharedContent.shared_at.desc()).all()

        logger.info(f"Found {len(shared_items)} shared items for user {current_user.id}")

        result = []
        for item in shared_items:
            owner = db.query(models.User).filter(models.User.id == item.owner_id).first()
            if not owner:
                logger.warning(f"Owner not found for shared item {item.id}")
                continue

            title = "Untitled"
            content_exists = False

            if item.content_type == "note":
                note = db.query(models.Note).filter(models.Note.id == item.content_id).first()
                if note:
                    title = note.title or "Untitled Note"
                    content_exists = True
                else:
                    title = "Deleted Note"
            elif item.content_type == "chat":
                chat = db.query(models.ChatSession).filter(models.ChatSession.id == item.content_id).first()
                if chat:
                    title = chat.title or "Untitled Chat"
                    content_exists = True
                else:
                    title = "Deleted Chat"

            if content_exists:
                result.append({
                    "id": item.id,
                    "content_type": item.content_type,
                    "content_id": item.content_id,
                    "title": title,
                    "permission": item.permission,
                    "message": item.message,
                    "shared_at": item.shared_at.isoformat() + "Z" if item.shared_at else None,
                    "shared_by": {
                        "id": owner.id,
                        "username": owner.username,
                        "email": owner.email,
                        "first_name": owner.first_name or "",
                        "last_name": owner.last_name or "",
                        "picture_url": owner.picture_url or ""
                    }
                })

        logger.info(f"Returning {len(result)} valid shared items")
        return {"shared_items": result}

    except Exception as e:
        logger.error(f"Error getting shared content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug_friendships")
def debug_friendships(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        friendships = db.query(models.Friendship).filter(
            models.Friendship.user_id == current_user.id
        ).all()

        reverse_friendships = db.query(models.Friendship).filter(
            models.Friendship.friend_id == current_user.id
        ).all()

        result = {
            "user": {
                "id": current_user.id,
                "username": current_user.username
            },
            "friendships": [
                {
                    "id": f.id,
                    "user_id": f.user_id,
                    "friend_id": f.friend_id,
                    "status": f.status,
                    "created_at": f.created_at.isoformat() + "Z"
                }
                for f in friendships
            ],
            "reverse_friendships": [
                {
                    "id": f.id,
                    "user_id": f.user_id,
                    "friend_id": f.friend_id,
                    "status": f.status,
                    "created_at": f.created_at.isoformat() + "Z"
                }
                for f in reverse_friendships
            ],
            "total_friendships": len(friendships) + len(reverse_friendships)
        }

        return result

    except Exception as e:
        return {"error": str(e)}

@router.get("/shared/{content_type}/{content_id}")
def get_shared_content(
    content_type: str,
    content_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Accessing shared content: {content_type} {content_id} for user: {current_user.id}")

        shared = db.query(models.SharedContent).filter(
            models.SharedContent.content_type == content_type,
            models.SharedContent.content_id == content_id,
            models.SharedContent.shared_with_id == current_user.id
        ).first()

        if content_type == "note":
            content = db.query(models.Note).filter(models.Note.id == content_id).first()
            if not content:
                raise HTTPException(status_code=404, detail="Note not found")

            is_owner = content.user_id == current_user.id
            if not is_owner and not shared:
                raise HTTPException(status_code=403, detail="No access to this note")

            owner = db.query(models.User).filter(models.User.id == content.user_id).first()

            return {
                "content_type": "note",
                "content_id": content.id,
                "title": content.title,
                "content": content.content,
                "created_at": content.created_at.isoformat() + "Z",
                "updated_at": content.updated_at.isoformat() + "Z",
                "permission": shared.permission if shared else "owner",
                "is_owner": is_owner,
                "owner": {
                    "id": owner.id,
                    "username": owner.username,
                    "first_name": owner.first_name or "",
                    "last_name": owner.last_name or "",
                    "picture_url": owner.picture_url or ""
                }
            }

        elif content_type == "chat":
            content = db.query(models.ChatSession).filter(models.ChatSession.id == content_id).first()
            if not content:
                raise HTTPException(status_code=404, detail="Chat not found")

            is_owner = content.user_id == current_user.id
            if not is_owner and not shared:
                raise HTTPException(status_code=403, detail="No access to this chat")

            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == content_id
            ).order_by(models.ChatMessage.timestamp.asc()).all()

            owner = db.query(models.User).filter(models.User.id == content.user_id).first()

            return {
                "content_type": "chat",
                "content_id": content.id,
                "title": content.title,
                "created_at": content.created_at.isoformat() + "Z",
                "updated_at": content.updated_at.isoformat() + "Z",
                "permission": shared.permission if shared else "owner",
                "is_owner": is_owner,
                "owner": {
                    "id": owner.id,
                    "username": owner.username,
                    "first_name": owner.first_name or "",
                    "last_name": owner.last_name or "",
                    "picture_url": owner.picture_url or ""
                },
                "messages": [
                    {
                        "user_message": msg.user_message,
                        "ai_response": msg.ai_response,
                        "timestamp": msg.timestamp.isoformat() + "Z"
                    }
                    for msg in messages
                ]
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid content type")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shared content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug_shared_content")
def debug_shared_content(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        shared_items = db.query(models.SharedContent).filter(
            models.SharedContent.shared_with_id == current_user.id
        ).all()

        owned_shares = db.query(models.SharedContent).filter(
            models.SharedContent.owner_id == current_user.id
        ).all()

        return {
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email
            },
            "received_shares": [
                {
                    "id": item.id,
                    "owner_id": item.owner_id,
                    "shared_with_id": item.shared_with_id,
                    "content_type": item.content_type,
                    "content_id": item.content_id,
                    "permission": item.permission,
                    "message": item.message,
                    "shared_at": item.shared_at.isoformat() + "Z" if item.shared_at else None
                }
                for item in shared_items
            ],
            "sent_shares": [
                {
                    "id": item.id,
                    "owner_id": item.owner_id,
                    "shared_with_id": item.shared_with_id,
                    "content_type": item.content_type,
                    "content_id": item.content_id,
                    "permission": item.permission,
                    "message": item.message
                }
                for item in owned_shares
            ],
            "total_received": len(shared_items),
            "total_sent": len(owned_shares)
        }

    except Exception as e:
        return {"error": str(e)}

@router.delete("/remove_shared_access/{share_id}")
def remove_shared_access(
    share_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"User {current_user.id} attempting to remove shared access {share_id}")

        shared = db.query(models.SharedContent).filter(
            models.SharedContent.id == share_id
        ).first()

        if not shared:
            logger.error(f"Shared content not found: {share_id}")
            raise HTTPException(status_code=404, detail="Shared content not found")

        can_remove = (shared.shared_with_id == current_user.id) or (shared.owner_id == current_user.id)

        if not can_remove:
            logger.warning(f"User {current_user.id} not authorized to remove share {share_id}")
            raise HTTPException(status_code=403, detail="Not authorized to remove this shared content")

        logger.info(f"Removing shared access: share_id={share_id}, owner={shared.owner_id}, recipient={shared.shared_with_id}")

        db.delete(shared)
        db.commit()

        return {
            "success": True,
            "message": "Access removed successfully",
            "removed_share_id": share_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing shared access: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/update_shared_note/{note_id}")
def update_shared_note(
    note_id: int,
    note_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        user = get_user_by_email(db, user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        note = db.query(models.Note).filter(models.Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        if note.user_id != user.id:
            shared = db.query(models.SharedContent).filter(
                models.SharedContent.content_type == "note",
                models.SharedContent.content_id == note_id,
                models.SharedContent.shared_with_id == user.id,
                models.SharedContent.permission == "edit"
            ).first()

            if not shared:
                raise HTTPException(status_code=403, detail="No edit permission for this note")

        if "content" in note_data:
            note.content = note_data["content"]
        if "title" in note_data:
            note.title = note_data["title"]

        note.updated_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "success": True,
            "message": "Note updated successfully",
            "note": {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "updated_at": note.updated_at.isoformat() + "Z"
            }
        }

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shared note: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/accept_quiz_battle")
async def accept_quiz_battle(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        battle_id = payload.get("battle_id")
        if not battle_id:
            raise HTTPException(status_code=400, detail="battle_id is required")

        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()

        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        if battle.opponent_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        if battle.status != "pending":
            raise HTTPException(status_code=400, detail=f"Battle is {battle.status}")

        battle.status = "active"
        battle.started_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(battle)

        logger.info(f"Battle {battle_id} accepted by user {current_user.id}")

        challenger_name = battle.challenger.first_name or battle.challenger.username
        opponent_name = current_user.first_name or current_user.username

        notification = models.Notification(
            user_id=battle.challenger_id,
            title="Battle Accepted",
            message=f"{opponent_name} accepted your quiz battle challenge. It's on!",
            notification_type="battle_accepted",
            is_read=False
        )
        db.add(notification)

        start_notification = models.Notification(
            user_id=current_user.id,
            title="Battle Started",
            message=f"You're now in a live quiz battle against {challenger_name}. Good luck!",
            notification_type="battle_started",
            is_read=False
        )
        db.add(start_notification)
        db.commit()

        await notify_battle_accepted(battle.challenger_id, battle.id)
        await notify_battle_started([battle.challenger_id, battle.opponent_id], battle.id)

        return {
            "status": "success",
            "message": "Battle accepted!",
            "battle_id": battle.id,
            "redirect_to": f"/quiz-battle/{battle.id}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting battle: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/decline_quiz_battle")
async def decline_quiz_battle(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        battle_id = payload.get("battle_id")
        if not battle_id:
            raise HTTPException(status_code=400, detail="battle_id is required")

        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()

        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        if battle.opponent_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        if battle.status != "pending":
            raise HTTPException(status_code=400, detail=f"Battle is {battle.status}")

        battle.status = "expired"
        battle.completed_at = datetime.now(timezone.utc)

        db.commit()

        logger.info(f"Battle {battle_id} declined by user {current_user.id}")

        opponent_name = f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else current_user.username
        decline_notification = models.Notification(
            user_id=battle.challenger_id,
            title="Battle Declined",
            message=f"{opponent_name} declined your quiz battle challenge.",
            notification_type="battle_declined",
            is_read=False
        )
        db.add(decline_notification)
        db.commit()

        await notify_battle_declined(battle.challenger_id, battle.id, opponent_name)

        return {
            "status": "success",
            "message": "Battle declined",
            "battle_id": battle.id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error declining battle: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit_battle_answer")
async def submit_battle_answer(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        battle_id = payload.get("battle_id")
        question_index = payload.get("question_index")
        is_correct = payload.get("is_correct")

        if battle_id is None or question_index is None or is_correct is None:
            raise HTTPException(status_code=400, detail="Missing required fields")

        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()

        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        is_challenger = battle.challenger_id == current_user.id
        opponent_id = battle.opponent_id if is_challenger else battle.challenger_id

        logger.info(f"Sending answer notification to opponent {opponent_id}: Battle {battle_id}, Q{question_index}, Correct: {is_correct}")
        logger.info(f"Active WebSocket connections: {list(manager.active_connections.keys())}")

        success = await manager.send_personal_message({
            "type": "battle_answer_submitted",
            "battle_id": battle_id,
            "question_index": question_index,
            "is_correct": is_correct,
            "is_opponent": True
        }, opponent_id)

        if success:
            logger.info(f"Answer notification delivered to opponent {opponent_id}")
        else:
            logger.warning(f"Failed to deliver notification - opponent {opponent_id} not connected")

        return {
            "status": "success",
            "message": "Answer submitted"
        }

    except Exception as e:
        logger.error(f"Error submitting answer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create_solo_quiz")
async def create_solo_quiz(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        subject = payload.get("subject")
        difficulty = payload.get("difficulty", "intermediate")
        question_count = payload.get("question_count", 10)

        quiz = models.SoloQuiz(
            user_id=current_user.id,
            subject=subject,
            difficulty=difficulty,
            question_count=question_count,
            time_limit_seconds=300
        )

        db.add(quiz)
        db.commit()
        db.refresh(quiz)

        questions = await _generate_quiz_questions(subject, difficulty, question_count)

        for q_data in questions:
            question = models.SoloQuizQuestion(
                quiz_id=quiz.id,
                question=q_data["question"],
                options=json.dumps(q_data["options"]),
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation", "")
            )
            db.add(question)

        db.commit()

        try:
            from tutor import chroma_store
            if chroma_store.available():
                chroma_store.write_episode(
                    user_id=str(current_user.id),
                    summary=(
                        f"Quiz created: \"{subject}\" on {subject}. "
                        f"{question_count} questions, difficulty: {difficulty}."
                    ),
                    metadata={
                        "source": "quiz_created",
                        "topic": (subject or "")[:100],
                        "title": (subject or "")[:100],
                        "question_count": question_count,
                        "difficulty": difficulty,
                        "quiz_id": str(quiz.id),
                    },
                )
        except Exception as chroma_err:
            logger.warning(f"Chroma write failed on solo quiz create: {chroma_err}")

        return {
            "status": "success",
            "quiz_id": quiz.id
        }

    except Exception as e:
        logger.error(f"Error creating solo quiz: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/solo_quiz/{quiz_id}")
async def get_solo_quiz(
    quiz_id: int,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        quiz = db.query(models.SoloQuiz).filter(
            models.SoloQuiz.id == quiz_id,
            models.SoloQuiz.user_id == current_user.id
        ).first()

        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        questions = db.query(models.SoloQuizQuestion).filter(
            models.SoloQuizQuestion.quiz_id == quiz_id
        ).all()

        return {
            "quiz": {
                "id": quiz.id,
                "subject": quiz.subject,
                "difficulty": quiz.difficulty,
                "question_count": quiz.question_count,
                "time_limit_seconds": quiz.time_limit_seconds
            },
            "questions": [{
                "id": q.id,
                "question": q.question,
                "options": json.loads(q.options),
                "correct_answer": q.correct_answer,
                "explanation": q.explanation
            } for q in questions]
        }

    except Exception as e:
        logger.error(f"Error getting solo quiz: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete_solo_quiz")
async def complete_solo_quiz(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        quiz_id = payload.get("quiz_id")
        score = payload.get("score")
        answers = payload.get("answers", [])

        quiz = db.query(models.SoloQuiz).filter(
            models.SoloQuiz.id == quiz_id,
            models.SoloQuiz.user_id == current_user.id
        ).first()

        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        logger.info(f"Quiz completion - User: {current_user.id}, Score: {score}%")

        quiz.score = score
        quiz.completed = True
        quiz.status = "completed"
        quiz.answers = json.dumps(answers)
        quiz.completed_at = datetime.now(timezone.utc)

        db.commit()
        logger.info("Quiz saved successfully")

        try:
            from activity_logger import log_activity
            log_activity(
                db=db,
                user_id=current_user.id,
                activity_type="solo_quiz",
                details={
                    "quiz_id": quiz_id,
                    "subject": quiz.subject,
                    "score": score,
                    "difficulty": quiz.difficulty,
                    "question_count": quiz.question_count
                }
            )
            logger.info(f"Logged solo_quiz activity for user {current_user.id}")
        except Exception as log_error:
            logger.warning(f"Failed to log activity: {log_error}")

        try:
            from tutor import chroma_store
            if chroma_store.available():
                correct_count = round((score / 100) * quiz.question_count) if score is not None else 0
                chroma_store.write_episode(
                    user_id=str(current_user.id),
                    summary=(
                        f"Quiz completed: \"{quiz.subject}\" — scored {score:.1f}% "
                        f"({correct_count}/{quiz.question_count} correct)."
                    ),
                    metadata={
                        "source": "quiz_completed",
                        "topic": (quiz.subject or "")[:100],
                        "title": (quiz.subject or "")[:100],
                        "score": str(round(score, 1)),
                        "correct": str(correct_count),
                        "total": str(quiz.question_count),
                        "difficulty": quiz.difficulty,
                        "quiz_id": str(quiz_id),
                    },
                )
                chroma_store.write_quiz_result(
                    user_id=str(current_user.id),
                    topic=quiz.subject or "",
                    score=score,
                    correct=correct_count,
                    total=quiz.question_count,
                    metadata={"quiz_id": str(quiz_id), "difficulty": quiz.difficulty},
                )
        except Exception as chroma_err:
            logger.warning(f"Chroma write failed on solo quiz complete: {chroma_err}")

        try:
            from agents.agent_api import get_user_kg
            user_kg = get_user_kg()
            if user_kg and answers:
                for answer in answers:
                    question_text = answer.get("question", "")
                    is_correct = answer.get("is_correct", False)
                    concept = question_text[:50].strip() if question_text else f"Quiz_{quiz.topic}"

                    await user_kg.record_concept_interaction(
                        user_id=current_user.id,
                        concept=concept,
                        correct=is_correct,
                        source="quiz",
                        difficulty=0.3 if quiz.difficulty == "easy" else 0.5 if quiz.difficulty == "medium" else 0.7
                    )
                logger.info(f"KG: Recorded {len(answers)} quiz interactions for user {current_user.id}")
        except ImportError as import_error:
            logger.warning(f"Agent API module not available: {import_error}")
        except Exception as kg_error:
            logger.warning(f"Failed to record KG quiz interactions: {kg_error}")

        from gamification_system import award_points, calculate_solo_quiz_points

        points_result = award_points(db, current_user.id, "solo_quiz", {
            "difficulty": quiz.difficulty,
            "question_count": quiz.question_count,
            "score_percentage": score
        })

        quiz_points = calculate_solo_quiz_points(quiz.difficulty, quiz.question_count, score)

        db.commit()
        logger.info(f"Awarded {points_result['points_earned']} points for solo quiz")

        logger.info(f"Checking notification conditions - Score: {score}")
        notification = None

        if score < 50:
            logger.info(f"Creating poor performance notification (score {score} < 50)")
            notification = models.Notification(
                user_id=current_user.id,
                title="Quiz Performance Alert",
                message=f"Your recent quiz score was {score}%. Review the material and try again to improve!",
                notification_type="quiz_poor_performance"
            )
            db.add(notification)
            db.commit()
            logger.info(f"Created poor performance notification for user {current_user.id}")
        elif score >= 90:
            logger.info(f"Creating excellent performance notification (score {score} >= 90)")
            notification = models.Notification(
                user_id=current_user.id,
                title="Excellent Work!",
                message=f"Amazing! You scored {score}% on your quiz. You earned {points_result['points_earned']} points!",
                notification_type="quiz_excellent"
            )
            db.add(notification)
            db.commit()
            logger.info(f"Created excellent performance notification for user {current_user.id}")
        else:
            logger.info(f"No notification created - score {score} is between 50-89")

        response = {
            "status": "success",
            "message": "Quiz completed",
            "points_earned": points_result["points_earned"],
            "total_points": points_result["total_points"],
            "level": points_result["level"],
            "points_breakdown": quiz_points
        }

        if notification:
            response["notification"] = {
                "title": notification.title,
                "message": notification.message,
                "notification_type": notification.notification_type
            }

        return response

    except Exception as e:
        logger.error(f"Error completing solo quiz: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/websocket-connections")
async def debug_websocket_connections(username: str = Depends(verify_token)):
    return {
        "active_connections": list(manager.active_connections.keys()),
        "total_connections": len(manager.active_connections),
        "requesting_user": username
    }

async def _generate_quiz_questions(subject: str, difficulty: str, count: int):
    prompt = f"""Generate {count} multiple choice questions about {subject} at {difficulty} level.

For each question provide:
- A clear question
- 4 answer options with FULL ANSWER TEXT (not just "A", "B", "C", "D")
- The index of the correct answer (0-3)
- A brief explanation of the correct answer

IMPORTANT: Return ONLY a valid JSON array, no markdown formatting, no code blocks, no extra text.
CRITICAL: Each option MUST contain the FULL ANSWER TEXT, not just letter labels.
Use this exact structure:
[{{"question": "...", "options": ["First option with full answer text", "Second option with full answer text", "Third option with full answer text", "Fourth option with full answer text"], "correct_answer": 0, "explanation": "..."}}]"""

    content = call_ai(prompt, max_tokens=3000, temperature=0.7)

    start = content.find("[")
    end = content.rfind("]")
    if start != -1 and end != -1 and end > start:
        content = content[start:end + 1]
    else:
        content = re.sub(r"^```(?:json)?\s*\n?", "", content.strip())
        content = re.sub(r"\n?```\s*$", "", content).strip()

    logger.info(f"Cleaned content: {content[:200]}...")
    questions = json.loads(content)

    if not isinstance(questions, list) or len(questions) == 0:
        raise ValueError("AI returned empty or invalid questions list")

    return questions

@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    user_id = None
    db = None

    try:
        logger.info("WebSocket connection attempt")

        if not token:
            logger.error("No token provided")
            await websocket.close(code=1008, reason="No token")
            return

        db = next(get_db())

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")

            if not username:
                logger.error("No username in token")
                await websocket.close(code=1008, reason="Invalid token")
                return

            logger.info(f"Token verified for: {username}")

            user = get_user_by_username(db, username) or get_user_by_email(db, username)
            if not user:
                logger.error(f"User not found: {username}")
                await websocket.close(code=1008, reason="User not found")
                return

            user_id = user.id
            logger.info(f"User {user_id} authenticated successfully")

        except JWTError as e:
            logger.error(f"JWT Error: {str(e)}")
            await websocket.close(code=1008, reason="Invalid token")
            return
        except Exception as e:
            logger.error(f"Auth error: {str(e)}")
            await websocket.close(code=1011, reason="Auth error")
            return

        await websocket.accept()
        logger.info(f"WebSocket accepted for user {user_id}")

        if db:
            db.close()
            db = None
            logger.info(f"Database connection closed for user {user_id}")

        manager.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected (Total: {len(manager.active_connections)})")

        await websocket.send_json({
            "type": "connected",
            "message": "Connected to battle system",
            "user_id": user_id
        })

        while True:
            try:
                data = await websocket.receive_json()

                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    logger.debug(f"Ping from user {user_id}")

            except WebSocketDisconnect:
                logger.info(f"User {user_id} disconnected")
                break
            except Exception as e:
                logger.error(f"Error in WebSocket loop: {str(e)}")
                break

    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=1011, reason="Error")
        except Exception:
            pass

    finally:
        if user_id and user_id in manager.active_connections:
            del manager.active_connections[user_id]
            logger.info(f"User {user_id} cleaned up")

        if db:
            try:
                db.close()
                logger.info("Database connection closed in cleanup")
            except Exception:
                pass
