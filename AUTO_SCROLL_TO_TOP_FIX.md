# Auto-Scroll to Top Fix

## Problem
When sending a message in AI Chat, the page doesn't scroll to show the new question. User has to manually scroll down to see their question and the AI's response.

## Solution
Added automatic scroll to top when user sends a message.

## Changes Made

### File: `src/pages/AIChat.js`

**Before**:
```javascript
// Add user message to UI immediately
setMessages(prev => [...prev, userMessage]);

// Set loading state
setLoading(true);
```

**After**:
```javascript
// Add user message to UI immediately
setMessages(prev => [...prev, userMessage]);

// Scroll to top to show the new question
setTimeout(() => {
  scrollToTop();
}, 100);

// Set loading state
setLoading(true);
```

## How It Works

1. User types message and hits send
2. Message is added to the chat
3. **NEW**: Page automatically scrolls to top (100ms delay for smooth animation)
4. User sees their question at the top
5. AI response appears below it

## Testing

1. Open AI Chat
2. Type a message
3. Hit send
4. **Expected**: Page scrolls to top automatically, showing your question
5. **Expected**: AI response appears below your question

## Benefits

✅ No more manual scrolling  
✅ Always see your question immediately  
✅ Better UX - questions and answers stay visible  
✅ Smooth scroll animation (100ms delay)

## Status

✅ **FIXED** - Auto-scroll to top implemented

## Files Modified

- `src/pages/AIChat.js` - Added scrollToTop() call after message sent
