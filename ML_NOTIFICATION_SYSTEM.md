# ML-Based Proactive Notification System

## Overview
The notification system now uses machine learning to dynamically determine when and what to notify users, replacing the previous hardcoded messages.

## How It Works

### 1. **ML Scoring System**
The system analyzes multiple factors to calculate an intervention score (0-1):

- **Wrong Answers** (22% weight): Tracks recent incorrect answers
- **Topic Concentration** (13% weight): Identifies struggling topics
- **Clarification Requests** (13% weight): Detects confusion patterns
- **Inactivity Signal** (10% weight): Monitors learning gaps
- **Idle Detection** (15% weight): Real-time idle user detection
- **Weak Topics** (12% weight): Low accuracy areas (<60%)
- **Time of Day** (8% weight): Optimal learning hours
- **User Engagement** (7% weight): Historical notification response rate

### 2. **Adaptive Learning**
The system learns from user behavior:
- Tracks notification response rates
- Adjusts intervention frequency based on engagement
- Reduces notifications for users who rarely respond
- Increases proactive outreach for engaged users

### 3. **Personalized Messages**
AI generates contextual messages based on:
- User's learning patterns
- Specific struggling topics
- Recent activity history
- Time since last interaction
- User profile (name, field of study, etc.)

### 4. **Idle Detection**
Frontend tracks user activity:
- Monitors clicks, keypresses, and scrolls
- Checks for idle state every 2 minutes
- Triggers ML analysis after 3 minutes of inactivity
- Sends personalized weak-topic recommendations

## Message Types

1. **Welcome** (New users or post-quiz)
2. **Idle Check-in** (User inactive but was active)
3. **Weak Topic** (Low accuracy detected)
4. **Struggle Support** (Multiple wrong answers on same topic)
5. **Confusion Help** (Repeated clarification requests)
6. **Encouragement** (Consistent learners)

## Anti-Spam Protection
- Minimum 2-minute interval between notifications
- ML-based optimal timing calculation
- User engagement rate consideration

## Technical Implementation

### Backend
- `backend/proactive_ai_system.py`: ML engine
- `backend/main.py`: API endpoint `/api/check_proactive_message`
- Uses Gemini/Groq AI for message generation

### Frontend
- `src/pages/Dashboard.js`: Idle detection
- `src/App.js`: Login notification trigger
- `src/components/ProactiveNotification.js`: UI component (unchanged)

## Benefits
✅ Dynamic, context-aware notifications
✅ Learns from user behavior
✅ Reduces notification fatigue
✅ Improves learning outcomes
✅ Personalized intervention timing
