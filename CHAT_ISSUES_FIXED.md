# Chat Issues - Root Cause Analysis & Fixes

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **PostgreSQL Function Used with SQLite** ✅ FIXED
**Problem:** The `sync_sequences()` function uses `to_regclass()` which is PostgreSQL-specific, but was being called even with SQLite.

**Error:**
```
ERROR: Error generating AI response: (sqlite3.OperationalError) no such function: to_regclass
```

**Root Cause:** The check `if "postgres" not in DATABASE_URL` returns early, but if DATABASE_URL is empty or None, it still tries to execute PostgreSQL commands.

**Fix Applied:** Enhanced the check and added proper error handling:
```python
def sync_sequences():
    """Sync PostgreSQL sequences - ONLY runs on PostgreSQL databases"""
    if not DATABASE_URL or "postgres" not in DATABASE_URL.lower():
        logger.info("Skipping sequence sync (not using PostgreSQL)")
        return
    
    try:
        # ... PostgreSQL-specific code with error handling
    except Exception as e:
        logger.error(f"Error syncing sequences: {e}")
        # Don't crash the app
```

---

### 2. **AI Response Caching Without Conversation Context** ⚠️ MAJOR ISSUE
**Problem:** The AI response cache uses ONLY the prompt as the cache key, ignoring:
- Conversation history
- User emotional state
- Previous messages in the session
- User's specific request to NOT talk about academics

**Why Responses Repeat:**
```python
# In ai_utils.py - UnifiedAIClient.generate()
cached_response = self.cache_manager.get_ai_response(prompt, temperature, max_tokens)
```

The cache key is: `f"ai_{hash(prompt)}_{temperature}_{max_tokens}"`

This means:
- User says "i am depressed" → AI responds with academic advice → **CACHED**
- User says "CAN WE NOT TALK ABOUT ACADEMICS" → Same prompt structure → **RETURNS CACHED RESPONSE**
- User says "i said dont talk about academics" → Still cached → **SAME RESPONSE AGAIN**

**The cache doesn't know:**
- This is a follow-up message
- The user explicitly rejected the previous response
- The conversation context has changed

---

### 3. **Conversation History Not Properly Integrated** ⚠️ CRITICAL
**Problem:** While conversation history is loaded, it's not being used to:
1. Detect when user is rejecting AI's approach
2. Understand emotional/personal topics vs academic topics
3. Adapt the response based on previous exchanges

**Evidence from logs:**
```
INFO: Switched to TUTORING mode
```

The AI is stuck in "TUTORING mode" and keeps trying to relate everything to academics, even when the user explicitly says they're depressed and don't want to talk about academics.

---

### 4. **Personality System Not Respecting User Boundaries** ⚠️ CRITICAL
**Problem:** The AI personality system has these issues:

**In `ai_personality.py`:**
```python
def build_natural_prompt(...):
    # Builds prompts but doesn't check for:
    # - User explicitly rejecting previous approach
    # - Emotional/personal topics
    # - Non-academic conversations
```

**In `ai_chat_agent.py`:**
```python
class ConversationMode(Enum):
    TUTORING = "tutoring"
    SOCRATIC = "socratic"
    # ... all academic modes
```

**Missing:** A mode for personal/emotional support that explicitly avoids academics.

---

## 🔧 REQUIRED FIXES

### Fix 1: ✅ PostgreSQL Function (COMPLETED)
Already applied - added proper checks and error handling.

### Fix 2: Disable Caching for Conversational Contexts
**Location:** `backend/ai_utils.py`

**Current Code:**
```python
def generate(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.7) -> str:
    # Check cache first
    if self.cache_manager:
        cached_response = self.cache_manager.get_ai_response(prompt, temperature, max_tokens)
        if cached_response:
            return cached_response
```

**Needed Fix:**
```python
def generate(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.7, 
             use_cache: bool = True, cache_context: str = None) -> str:
    """
    Args:
        use_cache: Set to False for conversational contexts
        cache_context: Additional context for cache key (e.g., conversation_id)
    """
    # Only use cache for non-conversational queries
    if self.cache_manager and use_cache:
        # Include conversation context in cache key
        cache_key_context = f"{cache_context}_{prompt}" if cache_context else prompt
        cached_response = self.cache_manager.get_ai_response(
            cache_key_context, temperature, max_tokens
        )
        if cached_response:
            return cached_response
```

### Fix 3: Add Conversation Context Detection
**Location:** `backend/agents/chat_agent.py` or create new `backend/conversation_context_detector.py`

**Add:**
```python
class ConversationContextDetector:
    """Detects when user is rejecting AI's approach or changing topic"""
    
    REJECTION_PHRASES = [
        "can we not", "don't talk about", "stop talking about",
        "i said", "i told you", "not about", "don't want to discuss",
        "change the subject", "let's not", "enough about"
    ]
    
    EMOTIONAL_TOPICS = [
        "depressed", "sad", "anxious", "stressed", "worried",
        "upset", "angry", "frustrated", "lonely", "scared"
    ]
    
    def is_rejecting_previous_approach(self, current_message: str, 
                                      previous_response: str) -> bool:
        """Check if user is explicitly rejecting the AI's approach"""
        current_lower = current_message.lower()
        
        # Check for rejection phrases
        for phrase in self.REJECTION_PHRASES:
            if phrase in current_lower:
                return True
        
        # Check if user is repeating themselves (sign of not being heard)
        if "i said" in current_lower or "i told you" in current_lower:
            return True
        
        return False
    
    def is_emotional_personal_topic(self, message: str) -> bool:
        """Check if this is an emotional/personal topic, not academic"""
        message_lower = message.lower()
        
        for topic in self.EMOTIONAL_TOPICS:
            if topic in message_lower:
                return True
        
        return False
    
    def should_avoid_academics(self, conversation_history: List[Dict]) -> bool:
        """Check if user has explicitly asked to avoid academic topics"""
        for msg in conversation_history[-3:]:  # Check last 3 messages
            user_msg = msg.get("user_message", "").lower()
            if any(phrase in user_msg for phrase in [
                "not talk about academics",
                "don't talk about academics",
                "stop talking about academics",
                "can we not talk about academics"
            ]):
                return True
        return False
```

### Fix 4: Add Non-Academic Conversation Mode
**Location:** `backend/agents/chat_agent.py`

**Add to ConversationMode enum:**
```python
class ConversationMode(str, Enum):
    TUTORING = "tutoring"
    SOCRATIC = "socratic"
    EXPLANATION = "explanation"
    PRACTICE = "practice"
    REVIEW = "review"
    EXPLORATION = "exploration"
    DEBUGGING = "debugging"
    BRAINSTORM = "brainstorm"
    PERSONAL_SUPPORT = "personal_support"  # NEW - for emotional/personal topics
```

**Add mode prompt:**
```python
ChatMode.PERSONAL_SUPPORT: """You are a supportive, empathetic listener.

CRITICAL RULES:
- This is NOT an academic conversation
- DO NOT relate everything to learning or studying
- DO NOT suggest academic activities unless explicitly asked
- Focus on emotional support and understanding
- Be warm, human, and present
- Listen more than you teach

APPROACH:
- Acknowledge their feelings
- Ask how you can help
- Offer support without pushing academics
- Be a friend, not just a tutor
- Respect their boundaries

TONE: Warm, empathetic, supportive, human, non-academic"""
```

### Fix 5: Update Response Generator to Detect Context
**Location:** `backend/agents/chat_agent.py` - ResponseGenerator class

**Add before generating response:**
```python
def generate(self, user_input: str, mode: ChatMode, style: ResponseStyle,
             emotional_state: EmotionalState, context: Dict[str, Any],
             reasoning_chain: List[Dict] = None) -> str:
    
    # NEW: Check if user is rejecting previous approach
    detector = ConversationContextDetector()
    conversation_history = context.get("conversation_history", [])
    
    if detector.should_avoid_academics(conversation_history):
        # Override mode to personal support
        mode = ChatMode.PERSONAL_SUPPORT
        logger.info("🚨 User requested no academics - switching to PERSONAL_SUPPORT mode")
    
    elif detector.is_emotional_personal_topic(user_input):
        # This is a personal topic, not academic
        mode = ChatMode.PERSONAL_SUPPORT
        logger.info("🚨 Emotional/personal topic detected - using PERSONAL_SUPPORT mode")
    
    # ... rest of generation code
```

---

## 🎯 IMMEDIATE ACTION ITEMS

1. ✅ **Fix PostgreSQL error** - DONE
2. ⚠️ **Disable caching for chat conversations** - Prevents repeated responses
3. ⚠️ **Add conversation context detection** - Detects when user rejects approach
4. ⚠️ **Add PERSONAL_SUPPORT mode** - For non-academic conversations
5. ⚠️ **Update response generator** - Respects user boundaries

---

## 📊 TESTING CHECKLIST

After fixes are applied, test:

- [ ] User says "i am depressed" → AI responds with empathy, NO academics
- [ ] User says "can we not talk about academics" → AI switches mode immediately
- [ ] User repeats request → AI acknowledges and changes approach
- [ ] Conversation history is considered in responses
- [ ] Cache doesn't return stale responses in conversations
- [ ] PostgreSQL error is gone on SQLite databases

---

## 🔍 FILES TO MODIFY

1. ✅ `backend/main.py` - sync_sequences() - FIXED
2. ⚠️ `backend/ai_utils.py` - Add cache_context parameter
3. ⚠️ `backend/agents/chat_agent.py` - Add PERSONAL_SUPPORT mode
4. ⚠️ `backend/agents/chat_agent.py` - Add ConversationContextDetector
5. ⚠️ `backend/agents/chat_agent.py` - Update ResponseGenerator
6. ⚠️ `backend/caching/cache_manager.py` - Update cache key generation

---

## 💡 ROOT CAUSE SUMMARY

The AI keeps giving the same response because:

1. **Caching ignores conversation context** - Same prompt = same cached response
2. **No detection of user rejection** - AI doesn't know user said "stop"
3. **Stuck in TUTORING mode** - Everything becomes academic
4. **No personal/emotional support mode** - Only academic modes available
5. **Conversation history not used for adaptation** - History is loaded but not analyzed

The fix requires making the AI **conversation-aware** rather than just **prompt-aware**.
