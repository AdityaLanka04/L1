# Quiz Battle Notification Debugging Guide

## Changes Made

### 1. Backend Changes (backend/main.py)
- **Fixed notification return value**: The `notify_battle_challenge` function now properly returns a boolean indicating success/failure
- **Added debug logging**: Enhanced logging to show active WebSocket connections when sending notifications
- **Added debug endpoint**: New `/api/debug/websocket-connections` endpoint to check active connections

### 2. Backend Changes (backend/websocket_manager.py)
- **Fixed return value**: `notify_battle_challenge` now returns the success status from `send_personal_message`

### 3. Frontend Changes (src/pages/QuizBattle.js)
- **Added polling fallback**: When WebSocket is not connected, the app polls for new battles every 10 seconds
- **Auto-detect pending battles**: When fetching battles, automatically detects new pending challenges and shows notifications
- **Better notification handling**: Shows both in-app and browser notifications for new challenges

## How to Debug

### Step 1: Check WebSocket Connection Status

In the browser console, you should see:
```
🔌 Connecting to WebSocket: wss://your-backend.com/ws?token=TOKEN_HIDDEN
✅ WebSocket Connected
```

If you see connection errors, check:
- Is the backend running?
- Is the token valid?
- Are there CORS issues?

### Step 2: Check Active Connections

Call the debug endpoint:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend.com/api/debug/websocket-connections
```

This will show:
- List of user IDs currently connected
- Total number of connections
- Your user ID

### Step 3: Test Notification Flow

1. **User A** (challenger): Open QuizBattle page
2. **User B** (opponent): Open QuizBattle page
3. Check both users are connected (see Step 2)
4. **User A**: Send a quiz challenge to User B
5. Check backend logs for:
   ```
   ⚔️ Battle created: ID=123
   📊 Active WebSocket connections: [1, 2]
   ✅ Notification sent to opponent 2
   ```

### Step 4: Check Frontend Notification

When User B receives the challenge, you should see:
```
📨 WebSocket message received: battle_challenge
Received WebSocket message: {type: 'battle_challenge', battle: {...}}
```

### Common Issues & Solutions

#### Issue 1: WebSocket Not Connecting
**Symptoms**: Console shows connection errors
**Solutions**:
- Check if backend is running
- Verify token is valid (not expired)
- Check CORS configuration
- For production, ensure WSS (not WS) is used

#### Issue 2: User Not Connected When Challenge Sent
**Symptoms**: Backend logs show "Opponent not connected to WebSocket"
**Solutions**:
- User B must have the QuizBattle page open
- User B must be logged in with valid token
- Check if User B's WebSocket connection dropped (network issues)
- **Fallback**: The polling mechanism will detect the challenge within 10 seconds

#### Issue 3: Notification Not Showing
**Symptoms**: WebSocket receives message but no popup
**Solutions**:
- Check browser console for errors
- Verify `showNotification` state is being set
- Check if `BattleNotification` component is rendering
- Grant browser notification permissions

#### Issue 4: Polling Not Working
**Symptoms**: No notifications even after 10+ seconds
**Solutions**:
- Check if `fetchBattles` is being called (console logs)
- Verify API endpoint returns pending battles
- Check if battle status is "pending"
- Verify `is_challenger` is false for opponent

## Testing Checklist

- [ ] Both users can connect to WebSocket
- [ ] Debug endpoint shows both users connected
- [ ] Challenge creates battle in database
- [ ] Backend logs show notification sent
- [ ] Frontend receives WebSocket message
- [ ] Notification popup appears
- [ ] Browser notification appears (if permitted)
- [ ] Polling works when WebSocket disconnected
- [ ] Accept/Decline buttons work
- [ ] Battle list updates after action

## Monitoring

### Backend Logs to Watch
```
✅ User {user_id} connected (Total: X)
⚔️ Battle created: ID={battle_id}
📊 Active WebSocket connections: [...]
✅ Notification sent to opponent {opponent_id}
⚠️ Opponent {opponent_id} not connected to WebSocket
```

### Frontend Console Logs
```
🔌 Connecting to WebSocket: ...
✅ WebSocket Connected
📨 WebSocket message received: battle_challenge
🔄 Polling for new battles (WebSocket not connected)
```

## Quick Fix Commands

### Restart Backend
```bash
cd backend
python main.py
```

### Check Backend Logs
```bash
# Look for WebSocket connection logs
tail -f backend.log | grep WebSocket
```

### Test WebSocket Connection
```javascript
// In browser console
const ws = new WebSocket('wss://your-backend.com/ws?token=YOUR_TOKEN');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```
