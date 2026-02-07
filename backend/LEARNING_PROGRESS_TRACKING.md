# Learning Progress Tracking System

## Overview

The Learning Progress Tracking system automatically maps all study activities to learning path nodes and updates progress intelligently using AI. This ensures that every topic you study contributes to your learning roadmap progress.

## Features

### 🤖 AI-Powered Content Analysis
- Uses Gemini AI to analyze study content
- Intelligently matches content to relevant learning path nodes
- Provides confidence scores and reasoning for each match
- Falls back to keyword matching when AI is unavailable

### 📊 Automatic Progress Updates
- Tracks progress across all study activities:
  - **Notes**: Creating or editing notes
  - **Flashcards**: Creating flashcard sets or studying
  - **Quizzes**: Taking quizzes and practice tests
  - **AI Chat**: Learning through AI conversations
  - **Slides**: Uploading and analyzing presentation slides
  - **Media**: Watching videos or listening to audio with transcripts
  - **Practice**: Completing practice exercises

### 🎯 Smart Progress Calculation
- Progress contribution based on:
  - Activity type (quizzes worth more than chat)
  - Content length and depth
  - Performance scores (quiz results, etc.)
  - Confidence of topic matching
- Prevents over-crediting (max 35% per activity)
- Scales progress by AI confidence scores

### 📈 Non-Linear Progress
- You don't have to complete nodes in order
- Progress is tracked independently for each node
- Multiple activities can contribute to the same node
- Nodes unlock based on prerequisites, not order

## API Endpoints

### 1. Track Activity (Automatic)
```http
POST /api/learning-progress/track-activity
```

**Request:**
```json
{
  "activity_type": "note",
  "content": "Supervised learning is a type of machine learning...",
  "title": "Introduction to Supervised Learning",
  "metadata": {
    "note_id": 123
  }
}
```

**Response:**
```json
{
  "success": true,
  "matched_nodes": 2,
  "updated_nodes": 2,
  "updates": [
    {
      "node_title": "Supervised Learning Basics",
      "path_title": "Machine Learning Fundamentals",
      "progress_delta": 12,
      "new_progress": 45,
      "status": "in_progress"
    }
  ],
  "message": "Updated progress for 2 learning path nodes"
}
```

### 2. Analyze Content (Preview)
```http
POST /api/learning-progress/analyze-content
```

Preview which nodes content would map to without updating progress.

**Request:**
```json
{
  "content": "Neural networks consist of layers of interconnected nodes...",
  "content_type": "note",
  "title": "Neural Network Architecture"
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "node_id": "abc-123",
      "path_id": "path-456",
      "node_title": "Neural Networks and Deep Learning",
      "path_title": "Machine Learning Fundamentals",
      "confidence": 85,
      "progress_contribution": 15,
      "reasoning": "Content covers neural network architecture which is core to this node"
    }
  ],
  "count": 1
}
```

### 3. Manual Progress Update
```http
POST /api/learning-progress/manual-progress-update
```

Manually update progress for a specific node.

**Parameters:**
- `node_id`: Node ID
- `path_id`: Path ID
- `progress_delta`: Progress to add (0-100)
- `activity_type`: Type of activity (default: "manual")

### 4. Get Node Progress
```http
GET /api/learning-progress/node-progress/{node_id}
```

Get detailed progress for a specific node.

**Response:**
```json
{
  "node_id": "abc-123",
  "progress_pct": 45,
  "status": "in_progress",
  "activities_completed": [
    {
      "type": "note",
      "timestamp": "2024-01-15T10:30:00Z",
      "progress_delta": 12
    }
  ],
  "xp_earned": 25,
  "time_spent_minutes": 45,
  "started_at": "2024-01-10T08:00:00Z",
  "last_accessed": "2024-01-15T10:30:00Z"
}
```

### 5. Get Path Progress Summary
```http
GET /api/learning-progress/path-progress/{path_id}
```

Get overall progress summary for an entire learning path.

## Integration Hooks

### Automatic Integration

The system provides hooks that can be called from any part of your application:

```python
from backend.learning_progress_hooks import (
    track_note_activity,
    track_flashcard_activity,
    track_quiz_activity,
    track_chat_activity,
    track_slide_activity,
    track_media_activity,
    track_practice_activity
)

# Example: Track note creation
await track_note_activity(
    db=db,
    user_id=user_id,
    note_title="Machine Learning Basics",
    note_content="Content of the note...",
    note_id=123
)

# Example: Track quiz completion
await track_quiz_activity(
    db=db,
    user_id=user_id,
    quiz_title="ML Quiz 1",
    questions=questions_list,
    score=85.5
)
```

### Where to Add Hooks

1. **Notes API** (`notes_api_enhanced.py`):
   - After creating a note
   - After updating a note

2. **Flashcards API** (`flashcard_api_minimal.py`):
   - After creating flashcard set
   - After completing study session

3. **Quiz API** (`question_bank_enhanced.py`):
   - After completing a quiz
   - After practice session

4. **AI Chat** (`ai_chat_integration.py`):
   - After chat session ends
   - Periodically during long conversations

5. **Slides** (`comprehensive_slide_analyzer.py`):
   - After slide upload and analysis

6. **Media** (`ai_media_processor.py`):
   - After transcript generation

## Progress Calculation Logic

### Base Contributions by Activity Type
- **Practice/Project**: 25-30% (highest value)
- **Quiz**: 20%
- **Note**: 15%
- **Slide**: 12%
- **Flashcard**: 10%
- **Chat**: 8%

### Adjustments
1. **Content Length Multiplier**:
   - < 100 chars: 0.5x
   - 100-500 chars: 0.8x
   - 500-1500 chars: 1.0x
   - > 1500 chars: 1.2x

2. **Quality Score**:
   - Based on performance (quiz scores, etc.)
   - Range: 0.5 - 1.0

3. **Confidence Scaling**:
   - AI confidence score (0-100)
   - Only updates nodes with confidence >= 50
   - Progress scaled by confidence percentage

### Example Calculation
```
Activity: Quiz on Supervised Learning
Base contribution: 20%
Content length: 800 chars → 1.0x multiplier
Quiz score: 85% → 0.85 quality score
AI confidence: 90%

Final progress = 20 * 1.0 * 0.85 * 0.90 = 15.3%
```

## Node Status Lifecycle

1. **Locked**: Node not yet accessible
2. **Unlocked**: Prerequisites met, can start
3. **In Progress**: User has started (progress > 0%)
4. **Completed**: Progress reached 100%

## Evidence Tracking

Every progress update stores evidence:
```json
{
  "type": "note",
  "timestamp": "2024-01-15T10:30:00Z",
  "progress_delta": 12,
  "evidence": {
    "title": "Supervised Learning Notes",
    "content_preview": "First 200 characters...",
    "confidence": 85,
    "reasoning": "Content covers supervised learning basics"
  }
}
```

## AI Matching Algorithm

### Step 1: Collect Node Information
- Node title, description
- Tags and keywords
- Learning objectives
- Prerequisites

### Step 2: AI Analysis
Gemini AI analyzes:
- Topical overlap between content and nodes
- Depth of coverage
- Relevance to learning objectives
- Semantic similarity

### Step 3: Confidence Scoring
- 80-100: Strong match, core topic
- 60-79: Good match, related topic
- 50-59: Moderate match, tangential
- < 50: Weak match, not updated

### Step 4: Fallback (No AI)
Keyword-based matching:
- Title matches: +30 points
- Keyword matches: +10 points each
- Tag matches: +8 points each
- Description overlap: +2 points per word

## Best Practices

### 1. Create Detailed Learning Paths
- Add comprehensive tags and keywords to nodes
- Write clear descriptions
- Define specific learning objectives

### 2. Provide Context in Activities
- Use descriptive titles
- Include relevant keywords in content
- Add metadata when available

### 3. Monitor Progress
- Check node progress regularly
- Review which activities contributed
- Adjust study focus based on gaps

### 4. Quality Over Quantity
- Focus on deep understanding
- High-quality activities contribute more
- Quiz performance affects progress weight

## Troubleshooting

### No Nodes Being Updated
1. Check if user has active learning paths
2. Verify content has relevant keywords
3. Review AI confidence scores (may be too low)
4. Check if nodes have tags/keywords defined

### Progress Not Increasing
1. May have hit the 35% per-activity cap
2. Low confidence matches (< 50) don't update
3. Node may already be at 100%

### Incorrect Node Matching
1. Add more specific tags/keywords to nodes
2. Improve content titles and descriptions
3. Use manual progress update as override

## Future Enhancements

- [ ] Time-based progress decay for inactive nodes
- [ ] Prerequisite auto-unlock based on progress
- [ ] Personalized progress recommendations
- [ ] Progress prediction using ML
- [ ] Collaborative learning progress
- [ ] Spaced repetition integration
- [ ] Adaptive difficulty based on progress rate

## Support

For issues or questions:
1. Check logs for error messages
2. Verify API key is configured
3. Test with `/analyze-content` endpoint first
4. Review node tags and keywords
