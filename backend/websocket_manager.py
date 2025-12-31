# websocket_manager.py
# WebSocket Connection Manager for Quiz Battles

from fastapi import WebSocket
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    
    def __init__(self):
        # Store active connections: {user_id: websocket}
        self.active_connections: Dict[int, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept and store a new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f" User {user_id} connected to WebSocket (Total: {len(self.active_connections)})")
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"🔌 User {user_id} disconnected from WebSocket (Total: {len(self.active_connections)})")
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to a specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                logger.info(f"📤 Sent message to user {user_id}: {message.get('type')}")
                return True
            except Exception as e:
                logger.error(f" Error sending message to user {user_id}: {str(e)}")
                # Remove dead connection
                if user_id in self.active_connections:
                    del self.active_connections[user_id]
                return False
        else:
            logger.warning(f" User {user_id} not connected to WebSocket")
            return False
    
    async def broadcast(self, message: dict, user_ids: List[int]):
        """Send a message to multiple users"""
        success_count = 0
        for user_id in user_ids:
            if await self.send_personal_message(message, user_id):
                success_count += 1
        return success_count

# Global connection manager instance
manager = ConnectionManager()

# ==================== NOTIFICATION FUNCTIONS ====================

async def notify_battle_challenge(opponent_id: int, battle_data: dict):
    """Notify user about a new battle challenge"""
    message = {
        "type": "battle_challenge",
        "battle": battle_data
    }
    success = await manager.send_personal_message(message, opponent_id)
    logger.info(f"📬 Battle challenge notification sent to user {opponent_id}: {success}")
    return success

async def notify_battle_accepted(challenger_id: int, battle_id: int, accepter_name: str = "Your opponent"):
    """Notify challenger that their battle was accepted"""
    message = {
        "type": "battle_accepted",
        "battle_id": battle_id,
        "opponent_name": accepter_name
    }
    await manager.send_personal_message(message, challenger_id)
    logger.info(f" Battle accepted notification sent to challenger {challenger_id}")

async def notify_battle_declined(challenger_id: int, battle_id: int, decliner_name: str = "Your opponent"):
    """Notify challenger that their battle was declined"""
    message = {
        "type": "battle_declined",
        "battle_id": battle_id,
        "opponent_name": decliner_name
    }
    await manager.send_personal_message(message, challenger_id)
    logger.info(f" Battle declined notification sent to challenger {challenger_id}")

async def notify_battle_started(user_ids: List[int], battle_id: int):
    """Notify both users that the battle has started"""
    message = {
        "type": "battle_started",
        "battle_id": battle_id
    }
    sent_count = await manager.broadcast(message, user_ids)
    logger.info(f" Battle started notification sent to {sent_count}/{len(user_ids)} users")

async def notify_battle_completed(user_ids: List[int], battle_id: int, winner_id: int = None):
    """Notify both users that the battle is complete"""
    message = {
        "type": "battle_completed",
        "battle_id": battle_id,
        "winner_id": winner_id
    }
    sent_count = await manager.broadcast(message, user_ids)
    logger.info(f"🏁 Battle completed notification sent to {sent_count}/{len(user_ids)} users")

