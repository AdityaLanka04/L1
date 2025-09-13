flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == session_data.set_id,
        models.FlashcardSet.user_id == user.id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    # Record the study session
    study_session = models.FlashcardStudySession(
        set_id=session_data.set_id,
        user_id=user.id,
        cards_studied=session_data.cards_studied,
        correct_answers=session_data.correct_answers,
        session_duration=session_data.session_duration
    )
    db.add(study_session)
    
    # Update flashcard set timestamp
    flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(study_session)
    
    return {
        "session_id": study_session.id,
        "accuracy": round((session_data.correct_answers / session_data.cards_studied * 100), 1) if session_data.cards_studied > 0 else 0,
        "status": "success",
        "message": "Study session recorded successfully"
    }

@app.put("/update_flashcard_set")
def update_flashcard_set(set_data: FlashcardSetUpdate, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_data.set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    flashcard_set.title = set_data.title
    flashcard_set.description = set_data.description
    flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(flashcard_set)
    
    return {
        "id": flashcard_set.id,
        "title": flashcard_set.title,
        "description": flashcard_set.description,
        "updated_at": flashcard_set.updated_at.isoformat(),
        "status": "success"
    }

@app.put("/update_flashcard")
def update_flashcard(card_data: FlashcardUpdate, db: Session = Depends(get_db)):
    flashcard = db.query(models.Flashcard).filter(
        models.Flashcard.id == card_data.flashcard_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    flashcard.question = card_data.question
    flashcard.answer = card_data.answer
    flashcard.difficulty = card_data.difficulty
    flashcard.category = card_data.category
    flashcard.updated_at = datetime.utcnow()
    
    # Update the set's timestamp too
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == flashcard.set_id
    ).first()
    if flashcard_set:
        flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(flashcard)
    
    return {
        "id": flashcard.id,
        "question": flashcard.question,
        "answer": flashcard.answer,
        "difficulty": flashcard.difficulty,
        "category": flashcard.category,
        "updated_at": flashcard.updated_at.isoformat(),
        "status": "success"
    }

@app.delete("/delete_flashcard/{flashcard_id}")
def delete_flashcard(flashcard_id: int, db: Session = Depends(get_db)):
    flashcard = db.query(models.Flashcard).filter(
        models.Flashcard.id == flashcard_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    set_id = flashcard.set_id
    db.delete(flashcard)
    
    # Update the set's timestamp
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if flashcard_set:
        flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Flashcard deleted successfully"}

@app.delete("/delete_flashcard_set/{set_id}")
def delete_flashcard_set(set_id: int, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    # Delete all flashcards in the set
    db.query(models.Flashcard).filter(models.Flashcard.set_id == set_id).delete()
    
    # Delete all study sessions for this set
    db.query(models.FlashcardStudySession).filter(models.FlashcardStudySession.set_id == set_id).delete()
    
    # Delete the set itself
    db.delete(flashcard_set)
    db.commit()
    
    return {"message": "Flashcard set and all associated data deleted successfully"}

@app.post("/mark_flashcard_reviewed")
def mark_flashcard_reviewed(
    flashcard_id: int = Form(...),
    correct: bool = Form(...),
    db: Session = Depends(get_db)
):
    flashcard = db.query(models.Flashcard).filter(
        models.Flashcard.id == flashcard_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    # Update flashcard review stats
    flashcard.times_reviewed += 1
    flashcard.last_reviewed = datetime.utcnow()
    
    if correct:
        flashcard.correct_count += 1
    
    # Calculate new accuracy
    accuracy = (flashcard.correct_count / flashcard.times_reviewed * 100) if flashcard.times_reviewed > 0 else 0
    
    db.commit()
    
    return {
        "flashcard_id": flashcard_id,
        "times_reviewed": flashcard.times_reviewed,
        "correct_count": flashcard.correct_count,
        "accuracy": round(accuracy, 1),
        "last_reviewed": flashcard.last_reviewed.isoformat(),
        "status": "success"
    }

@app.get("/get_flashcard_statistics")
def get_flashcard_statistics(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Total sets and cards
    total_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    total_cards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    # Study sessions
    total_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id
    ).count()
    
    # Total study time
    total_time_result = db.query(models.FlashcardStudySession.session_duration).filter(
        models.FlashcardStudySession.user_id == user.id
    ).all()
    total_study_time = sum(duration[0] for duration in total_time_result)
    
    # Overall accuracy
    all_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id
    ).all()
    
    total_cards_studied = sum(session.cards_studied for session in all_sessions)
    total_correct = sum(session.correct_answers for session in all_sessions)
    overall_accuracy = (total_correct / total_cards_studied * 100) if total_cards_studied > 0 else 0
    
    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id,
        models.FlashcardStudySession.session_date >= week_ago
    ).count()
    
    # Most studied sets
    most_studied_sets = db.query(
        models.FlashcardSet.title,
        func.count(models.FlashcardStudySession.id).label('session_count')
    ).join(models.FlashcardStudySession).filter(
        models.FlashcardSet.user_id == user.id
    ).group_by(models.FlashcardSet.id).order_by(
        func.count(models.FlashcardStudySession.id).desc()
    ).limit(5).all()
    
    return {
        "total_sets": total_sets,
        "total_cards": total_cards,
        "total_study_sessions": total_sessions,
        "total_study_time_minutes": total_study_time,
        "overall_accuracy": round(overall_accuracy, 1),
        "recent_sessions_week": recent_sessions,
        "most_studied_sets": [
            {"title": title, "session_count": count}
            for title, count in most_studied_sets
        ],
        "average_session_time": round(total_study_time / total_sessions, 1) if total_sessions > 0 else 0
    }

# ==================== AI FLASHCARD GENERATION ====================

@app.post("/generate_flashcards_advanced/")
async def generate_flashcards_advanced(
    user_id: str = Form(...),
    generation_type: str = Form("topic"),
    topic: str = Form(None),
    chat_data: str = Form(None),
    note_content: str = Form(None),
    difficulty_level: str = Form("medium"),
    card_count: int = Form(10),
    save_to_set: bool = Form(True),
    set_title: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        llm = Ollama(model="llama3")
        
        # Build content based on generation type
        content_source = ""
        source_type = generation_type
        source_description = ""
        
        if generation_type == "topic" and topic:
            content_source = f"Topic: {topic}"
            source_description = f"Generated from topic: {topic}"
            
        elif generation_type == "chat_history" and chat_data:
            try:
                chat_messages = json.loads(chat_data)
                conversation_content = []
                for msg in chat_messages[:30]:
                    conversation_content.append(f"Q: {msg.get('user_message', '')}")
                    conversation_content.append(f"A: {msg.get('ai_response', '')}")
                content_source = "\n".join(conversation_content)
                source_description = f"Generated from {len(chat_messages)} chat messages"
            except json.JSONDecodeError:
                content_source = "Invalid chat data"
                
        elif generation_type == "notes" and note_content:
            content_source = note_content[:2000]
            source_description = f"Generated from study notes"
            
        elif generation_type == "mixed":
            sources = []
            if topic:
                sources.append(f"Topic: {topic}")
            if chat_data:
                try:
                    chat_messages = json.loads(chat_data)
                    conversation_content = []
                    for msg in chat_messages[:15]:
                        conversation_content.append(f"Q: {msg.get('user_message', '')}")
                        conversation_content.append(f"A: {msg.get('ai_response', '')}")
                    sources.append("Chat History:\n" + "\n".join(conversation_content))
                except:
                    pass
            if note_content:
                sources.append(f"Notes:\n{note_content[:1000]}")
            
            content_source = "\n\n---\n\n".join(sources)
            source_description = f"Generated from multiple sources"
        
        if not content_source or content_source.strip() == "":
            return {
                "flashcards": [
                    {
                        "question": "Error: No content provided",
                        "answer": "Please provide topic, chat history, or notes to generate flashcards"
                    }
                ]
            }
        
        # Build AI prompt based on difficulty and content
        difficulty_instruction = {
            "easy": "Create simple recall questions with straightforward answers.",
            "medium": "Create questions that test understanding and application of concepts.",
            "hard": "Create challenging questions that require critical thinking and analysis.",
            "mixed": "Create a mix of easy, medium, and hard questions."
        }.get(difficulty_level, "Create questions appropriate for the content.")
        
        prompt = f"""You are an expert educational content creator. Generate exactly {card_count} high-quality flashcards based on the following content.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}
Learning Style: {user.learning_style or 'mixed'} learner

Requirements:
- Create comprehensive study notes in markdown format
- Use proper headers (# ## ###) for organization
- Bold important concepts and definitions
- Use bullet points for key information
- Include examples where relevant
- Structure content for easy review and studying
- Focus on educational value and clarity

Chat Conversations:
{conversation_data[:4000]}

Create a well-structured study note document with:
1. Clear title
2. Main topics as headers
3. Key concepts in bold
4. Important definitions highlighted
5. Examples and explanations
6. Summary sections

Format the response as JSON with 'title' and 'content' fields:"""

        elif import_mode == "exam_prep":
            prompt = f"""You are an expert exam preparation specialist. Transform the following chat conversations into a comprehensive exam preparation guide.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}
Learning Style: {user.learning_style or 'mixed'} learner

Create an exam-focused study guide with:

1. **Executive Summary** - Key topics overview
2. **Learning Objectives** - What the student should master
3. **Core Concepts** - Main topics broken down systematically
4. **Key Definitions** - Important terms and their meanings
5. **Study Strategies** - How to approach each topic
6. **Practice Questions** - Self-assessment opportunities
7. **Quick Review Checklist** - Final exam preparation
8. **Time Management** - Suggested study schedule

Use markdown formatting with:
- # for main sections
- ## for subsections
- ### for detailed topics
- **bold** for key terms
- *italic* for emphasis
- > blockquotes for important notes
- - bullet points for lists
- 1. numbered lists for procedures

Chat Conversations:
{conversation_data[:4000]}

Format as JSON with 'title' and 'content' fields:"""

        else:  # full transcript
            prompt = f"""Convert the following chat conversations into a well-formatted transcript document for {user.first_name or 'Student'}.

Create a clean, readable transcript with:
- Clear headers for each session
- Proper formatting for questions and answers
- Timestamps where available
- Organized structure for easy reference

Chat Conversations:
{conversation_data[:4000]}

Format as JSON with 'title' and 'content' fields:"""

        response = llm.invoke(prompt)
        
        # Try to extract JSON from response
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result
            except json.JSONDecodeError:
                pass
        
        # Fallback: Generate structured content manually
        if import_mode == "summary":
            title = f"Study Notes - {len(titles)} Session(s)"
            content = generate_enhanced_summary_content(conversation_data, titles, user)
        elif import_mode == "exam_prep":
            title = f"Exam Prep Guide - {len(titles)} Session(s)"
            content = generate_enhanced_exam_prep_content(conversation_data, titles, user)
        else:
            title = f"Chat Transcript - {len(titles)} Session(s)"
            content = generate_enhanced_transcript_content(conversation_data, titles)
        
        return {
            "title": title,
            "content": content
        }
        
    except Exception as e:
        print(f"Error generating note summary: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate note summary: {str(e)}")

def generate_enhanced_summary_content(conversation_data, titles, user):
    """Generate enhanced summary content with better formatting"""
    content = f"""# Study Notes from AI Chat Sessions

**Student:** {user.first_name} {user.last_name}
**Field of Study:** {user.field_of_study or 'General'}
**Learning Style:** {user.learning_style or 'Mixed'}
**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}

---

## Overview

This document contains key concepts and explanations from {len(titles)} chat session(s). The content has been organized for optimal study and review.

### How to Use This Study Guide

1. **First Read:** Go through all sections to get an overview
2. **Deep Study:** Focus on concepts marked as important
3. **Review:** Use the summary sections for quick refreshers
4. **Practice:** Apply concepts to real-world examples

---

## Key Topics and Concepts

"""
    
    # Parse conversation data and extract key points
    messages = conversation_data.split('\n\n--- New Session ---\n\n')
    
    for i, session_content in enumerate(messages):
        if i < len(titles):
            session_title = titles[i]
        else:
            session_title = f"Session {i + 1}"
            
        content += f"### {session_title}\n\n"
        
        # Extract Q&A pairs
        qa_pairs = re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session_content, re.DOTALL)
        
        for j, (question, answer) in enumerate(qa_pairs[:5]):  # Limit to 5 Q&As per session
            content += f"#### Question {j + 1}\n\n"
            content += f"**Q:** {question.strip()}\n\n"
            
            # Extract key points from answer (first 200 words)
            answer_words = answer.strip().split()[:200]
            key_answer = " ".join(answer_words)
            
            content += f"**Key Points:**\n\n"
            content += f"{key_answer}...\n\n"
            content += f"**Study Focus:** Review and understand this concept thoroughly\n\n"
            content += "---\n\n"
    
    content += f"""## Study Recommendations

### Active Learning Techniques
- **Summarize** each concept in your own words
- **Create connections** between different topics
- **Practice application** with real-world examples
- **Teach others** to reinforce your understanding

### Review Strategy
- **Daily Review:** 15-20 minutes of concept review
- **Weekly Deep Dive:** 1-2 hours of intensive study
- **Monthly Assessment:** Test your knowledge comprehensively

### Memory Aids
- Create **flashcards** for key definitions
- Use **mind maps** to connect related concepts
- Practice **spaced repetition** for long-term retention

---

## Quick Reference Checklist

**Before Your Next Study Session:**
"""
    
    for i, title in enumerate(titles):
        content += f"- [ ] Review concepts from {title}\n"
    
    content += """- [ ] Complete practice exercises
- [ ] Review key definitions
- [ ] Test understanding with examples

**Study Progress Tracking:**
- [ ] Initial reading completed
- [ ] Deep study completed  
- [ ] Practice exercises completed
- [ ] Ready for assessment

---

*Generated by Brainwave AI Study Assistant*
"""
    
    return content

def generate_enhanced_exam_prep_content(conversation_data, titles, user):
    """Generate comprehensive exam preparation guide"""
    content = f"""# Comprehensive Exam Preparation Guide

**Student:** {user.first_name} {user.last_name}
**Subject:** {user.field_of_study or 'General Studies'}
**Preparation Date:** {datetime.now().strftime('%B %d, %Y')}
**Source:** {len(titles)} AI Chat Session(s)

---

## Executive Summary

This comprehensive exam preparation guide synthesizes key concepts from your AI chat sessions into a structured study plan. The guide is designed to maximize your exam performance through systematic review and practice.

### Quick Stats
- **Total Sessions Analyzed:** {len(titles)}
- **Estimated Study Time:** 8-12 hours
- **Recommended Study Period:** 2-3 weeks
- **Difficulty Level:** Intermediate to Advanced

---

## Learning Objectives

By the end of your study using this guide, you should be able to:

1. **Understand** core concepts from all chat sessions
2. **Apply** theoretical knowledge to practical problems
3. **Analyze** complex scenarios using learned principles
4. **Synthesize** information from multiple sources
5. **Evaluate** different approaches and solutions

---

## Study Schedule

### Week 1: Foundation Building
- **Days 1-2:** Initial reading of all concepts (2-3 hours)
- **Days 3-4:** Deep dive into challenging topics (3-4 hours)
- **Days 5-7:** Practice and application exercises (2-3 hours)

### Week 2: Intensive Review
- **Days 8-10:** Comprehensive review of all materials (4-5 hours)
- **Days 11-12:** Mock tests and self-assessment (2-3 hours)
- **Days 13-14:** Final review and weak area focus (2-3 hours)

---

## Core Concepts and Topics

"""
    
    # Process conversation data
    messages = conversation_data.split('\n\n--- New Session ---\n\n')
    
    for i, session_content in enumerate(messages):
        if i < len(titles):
            session_title = titles[i]
        else:
            session_title = f"Topic Area {i + 1}"
            
        content += f"### {session_title}\n\n"
        content += f"**Priority Level:** High\n\n"
        
        # Extract Q&A pairs and create study points
        qa_pairs = re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session_content, re.DOTALL)
        
        content += f"**Key Learning Points:**\n\n"
        
        for j, (question, answer) in enumerate(qa_pairs[:3]):  # Top 3 per session
            content += f"{j + 1}. **{question.strip()[:100]}{'...' if len(question.strip()) > 100 else ''}**\n"
            
            # Extract first sentence or key point from answer
            answer_sentences = answer.strip().split('.')
            key_point = answer_sentences[0] if answer_sentences else answer.strip()[:150]
            
            content += f"   - *Key Insight:* {key_point}...\n"
            content += f"   - *Study Method:* Review, practice, and test understanding\n\n"
        
        content += f"**Exam Focus Areas:**\n"
        content += f"- Definition and core principles\n"
        content += f"- Practical applications and examples\n"
        content += f"- Common misconceptions to avoid\n"
        content += f"- Integration with other topics\n\n"
        content += "---\n\n"
    
    return content

def generate_enhanced_transcript_content(conversation_data, titles):
    """Generate clean, well-formatted transcript"""
    content = f"""# Complete Chat Session Transcript

**Export Date:** {datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')}
**Total Sessions:** {len(titles)}
**Format:** Chronological conversation record

---

## Document Information

This transcript contains complete conversations from your AI chat sessions. Each session is clearly marked and organized chronologically for easy reference.

### Navigation Tips
- Use Ctrl+F (Cmd+F) to search for specific topics
- Each session begins with a clear header
- Questions and responses are clearly labeled
- Timestamps are included where available

---

"""
    
    # Process each session
    messages = conversation_data.split('\n\n--- New Session ---\n\n')
    
    for i, session_content in enumerate(messages):
        if i < len(titles):
            session_title = titles[i]
        else:
            session_title = f"Chat Session {i + 1}"
            
        content += f"## Session {i + 1}: {session_title}\n\n"
        content += f"**Session Overview:** Detailed conversation transcript\n\n"
        
        # Extract and format Q&A pairs
        qa_pairs = re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session_content, re.DOTALL)
        
        for j, (question, answer) in enumerate(qa_pairs):
            content += f"### Exchange {j + 1}\n\n"
            content += f"**You:**\n{question.strip()}\n\n"
            content += f"**AI Tutor:**\n{answer.strip()}\n\n"
            content += f"*Exchange completed*\n\n"
            content += "---\n\n"
        
        content += f"*End of {session_title}*\n\n"
        
        if i < len(messages) - 1:
            content += "═══════════════════════════════════════\n\n"
    
    return content

# ==================== DEBUG AND TESTING ENDPOINTS ====================

@app.get("/test_ollama")
def test_ollama():
    try:
        llm = Ollama(model="llama3")
        response = llm.invoke("Say hello!")
        return {"status": "success", "response": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/debug/users")
async def debug_users(db: Session = Depends(get_db)):
    try:
        users = db.query(models.User).all()
        return {
            "user_count": len(users),
            "users": [
                {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                    "username": user.username,
                    "google_user": user.google_user
                } for user in users
            ]
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/create-test-user")
async def create_test_user(db: Session = Depends(get_db)):
    try:
        existing_user = get_user_by_username(db, 'testuser')
        if existing_user:
            return {"message": "Test user already exists", "username": "testuser", "password": "testpass"}
        
        hashed_password = get_password_hash('testpass')
        test_user = models.User(
            first_name='Test',
            last_name='User',
            email='testuser@example.com',
            username='testuser',
            hashed_password=hashed_password,
            age=25,
            field_of_study='Computer Science',
            learning_style='Visual',
            school_university='Test University',
            google_user=False
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        user_stats = models.UserStats(user_id=test_user.id)
        db.add(user_stats)
        db.commit()
        
        return {
            "message": "Test user created successfully", 
            "username": "testuser", 
            "password": "testpass",
            "profile": {
                "first_name": "Test",
                "last_name": "User",
                "email": "testuser@example.com",
                "age": 25,
                "field_of_study": "Computer Science",
                "learning_style": "Visual",
                "school_university": "Test University"
            },
            "instructions": "You can now login with these credentials"
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/reset-db")
async def reset_database(db: Session = Depends(get_db)):
    try:
        db.query(models.ChatMessage).delete()
        db.query(models.ChatSession).delete()
        db.query(models.Activity).delete()
        db.query(models.Note).delete()
        db.query(models.UserStats).delete()
        
        # Delete flashcard data
        db.query(models.FlashcardStudySession).delete()
        db.query(models.Flashcard).delete()
        db.query(models.FlashcardSet).delete()
        
        # Delete RAG data
        try:
            db.query(models.ConversationMemory).delete()
            db.query(models.TopicKnowledgeBase).delete()
        except:
            pass
        
        db.query(models.User).delete()
        
        db.commit()
        
        return {"message": "Database tables cleared successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/tables")
async def debug_tables(db: Session = Depends(get_db)):
    try:
        result = {
            "tables": {
                "users": db.query(models.User).count(),
                "chat_sessions": db.query(models.ChatSession).count(),
                "chat_messages": db.query(models.ChatMessage).count(),
                "activities": db.query(models.Activity).count(),
                "notes": db.query(models.Note).count(),
                "user_stats": db.query(models.UserStats).count(),
                "flashcard_sets": db.query(models.FlashcardSet).count(),
                "flashcards": db.query(models.Flashcard).count(),
                "flashcard_study_sessions": db.query(models.FlashcardStudySession).count()
            }
        }
        
        # Add RAG tables if available
        try:
            result["tables"]["conversation_memory"] = db.query(models.ConversationMemory).count()
            result["tables"]["topic_knowledge_base"] = db.query(models.TopicKnowledgeBase).count()
        except:
            result["tables"]["conversation_memory"] = "table not found"
            result["tables"]["topic_knowledge_base"] = "table not found"
        
        return result
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/test-auth")
async def debug_test_auth(username: str, password: str, db: Session = Depends(get_db)):
    user = authenticate_user(db, username, password)
    return {
        "username": username,
        "password_provided": bool(password),
        "authentication_result": bool(user),
        "user_data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "google_user": user.google_user
        } if user else None
    }

@app.get("/debug/ollama")
def debug_ollama():
    try:
        import requests
        
        # Test direct Ollama API connection
        try:
            response = requests.get("http://localhost:11434/api/version", timeout=5)
            if response.status_code == 200:
                ollama_status = "connected"
                ollama_version = response.json()
            else:
                ollama_status = f"error_status_{response.status_code}"
                ollama_version = None
        except requests.exceptions.ConnectionError:
            ollama_status = "connection_refused"
            ollama_version = None
        except requests.exceptions.Timeout:
            ollama_status = "timeout"
            ollama_version = None
        except Exception as e:
            ollama_status = f"error_{str(e)}"
            ollama_version = None
        
        # Test langchain Ollama
        try:
            from langchain_community.llms import Ollama
            llm = Ollama(model="llama3")
            test_response = llm.invoke("Say 'test successful'")
            langchain_status = "working"
            langchain_response = test_response[:100] + "..." if len(test_response) > 100 else test_response
        except Exception as e:
            langchain_status = f"error_{str(e)}"
            langchain_response = None
        
        return {
            "ollama_api": {
                "status": ollama_status,
                "version": ollama_version
            },
            "langchain_ollama": {
                "status": langchain_status,
                "test_response": langchain_response
            },
            "recommendations": [
                "Check if Ollama is running: 'ollama serve'",
                "Verify llama3 model is installed: 'ollama list'",
                "Install llama3 if missing: 'ollama pull llama3'",
                "Check port 11434 is available: 'lsof -i :11434'"
            ]
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "status": "debug_failed"
        }

@app.get("/test_simple_ollama")
def test_simple_ollama():
    try:
        from langchain_community.llms import Ollama
        llm = Ollama(model="llama3")
        response = llm.invoke("Just say hello")
        return {
            "status": "success",
            "response": response,
            "message": "Ollama is working correctly"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Ollama is not working properly"
        }

# ==================== MAIN APPLICATION ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)'various subjects'}
Difficulty Level: {difficulty_level}
Instructions: {difficulty_instruction}

Content Source:
{content_source}

Requirements:
- Create exactly {card_count} flashcards
- Focus on key concepts, definitions, processes, and applications
- Make questions clear and specific
- Provide complete, accurate answers
- Vary question types (definitions, explanations, applications, comparisons)
- Include the difficulty level for each card

Format your response as a JSON array:
[
  {{
    "question": "What is...",
    "answer": "The answer is...",
    "difficulty": "easy|medium|hard",
    "category": "concept|definition|application|process"
  }}
]

Generate {card_count} educational flashcards in JSON format:"""

        response = llm.invoke(prompt)
        print(f"AI Response for flashcards: {response[:200]}...")
        
        # Parse JSON response
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            try:
                flashcards_data = json.loads(json_str)
                
                valid_flashcards = []
                for i, card in enumerate(flashcards_data[:card_count]):
                    if isinstance(card, dict) and 'question' in card and 'answer' in card:
                        valid_flashcards.append({
                            'question': str(card['question']).strip(),
                            'answer': str(card['answer']).strip(),
                            'difficulty': str(card.get('difficulty', difficulty_level)).strip(),
                            'category': str(card.get('category', 'general')).strip()
                        })
                
                if len(valid_flashcards) > 0:
                    # Save to database if requested
                    if save_to_set:
                        # Create flashcard set
                        if not set_title:
                            if generation_type == "topic" and topic:
                                set_title = f"Flashcards: {topic}"
                            elif generation_type == "chat_history":
                                set_title = f"Chat Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                            elif generation_type == "notes":
                                set_title = f"Note Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                            else:
                                set_title = f"Generated Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                        
                        flashcard_set = models.FlashcardSet(
                            user_id=user.id,
                            title=set_title,
                            description=source_description,
                            source_type=source_type
                        )
                        db.add(flashcard_set)
                        db.commit()
                        db.refresh(flashcard_set)
                        
                        # Add flashcards to set
                        saved_cards = []
                        for card_data in valid_flashcards:
                            flashcard = models.Flashcard(
                                set_id=flashcard_set.id,
                                question=card_data['question'],
                                answer=card_data['answer'],
                                difficulty=card_data['difficulty'],
                                category=card_data['category']
                            )
                            db.add(flashcard)
                            saved_cards.append(flashcard)
                        
                        db.commit()
                        
                        return {
                            "flashcards": valid_flashcards,
                            "saved_to_set": True,
                            "set_id": flashcard_set.id,
                            "set_title": set_title,
                            "cards_saved": len(saved_cards),
                            "status": "success"
                        }
                    else:
                        return {
                            "flashcards": valid_flashcards,
                            "saved_to_set": False,
                            "status": "success"
                        }
                
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                print(f"Attempted to parse: {json_str[:300]}...")
        
        # Fallback response
        fallback_source = topic or "this content"
        return {
            "flashcards": [
                {
                    "question": f"What is a key concept from {fallback_source}?",
                    "answer": "This is a fundamental concept that requires further study. Please try generating again or provide more specific content.",
                    "difficulty": difficulty_level,
                    "category": "general"
                },
                {
                    "question": f"How would you apply knowledge about {fallback_source}?",
                    "answer": "Consider practical applications and real-world examples of this concept.",
                    "difficulty": difficulty_level,
                    "category": "application"
                }
            ],
            "saved_to_set": False,
            "status": "fallback"
        }
        
    except Exception as e:
        print(f"Error in generate_flashcards_advanced: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "flashcards": [
                {
                    "question": f"Error generating flashcards",
                    "answer": f"There was an error: {str(e)}. Please try again with different content.",
                    "difficulty": "medium",
                    "category": "error"
                }
            ],
            "saved_to_set": False,
            "status": "error"
        }

@app.post("/generate_flashcards/")
async def generate_flashcards(
    user_id: str = Form(...),
    topic: str = Form(None),
    generation_type: str = Form("topic"),
    chat_data: str = Form(None),
    db: Session = Depends(get_db)
):
    """Generate flashcards from topic or chat history - Original endpoint for compatibility"""
    try:
        # Use the new advanced endpoint internally
        return await generate_flashcards_advanced(
            user_id=user_id,
            generation_type=generation_type,
            topic=topic,
            chat_data=chat_data,
            note_content=None,
            difficulty_level="medium",
            card_count=10,
            save_to_set=False,
            set_title=None,
            db=db
        )
        
    except Exception as e:
        print(f"Error in generate_flashcards: {str(e)}")
        return {
            "flashcards": [
                {
                    "question": f"What would you like to learn about {topic or 'this topic'}?",
                    "answer": "Please try again or ask specific questions about this topic in the AI chat first."
                }
            ]
        }

# ==================== ENHANCED FEATURES ====================

@app.post("/rate_response")
def rate_ai_response(
    user_id: str = Form(...),
    message_id: int = Form(...),
    rating: int = Form(...),
    feedback_text: str = Form(None),
    improvement_suggestion: str = Form(None),
    db: Session = Depends(get_db)
):
    if not ENHANCED_FEATURES_AVAILABLE:
        return {"status": "error", "message": "Enhanced features not available"}
    
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        global_ai = GlobalAILearningSystem(db)
        success = global_ai.process_user_feedback(
            user.id, message_id, rating, feedback_text, improvement_suggestion
        )
        
        if success:
            return {
                "status": "success",
                "message": "Feedback recorded and AI learning updated",
                "global_impact": True
            }
        else:
            return {"status": "error", "message": "Could not process feedback"}
    
    except Exception as e:
        print(f"Error processing feedback: {str(e)}")
        return {"status": "error", "message": "Error processing feedback"}

@app.get("/ai_metrics")
def get_ai_metrics(db: Session = Depends(get_db)):
    if not ENHANCED_FEATURES_AVAILABLE:
        return {
            "daily_metrics": {"total_interactions": 0, "successful_interactions": 0, "average_rating": 0.0},
            "overall_metrics": {"total_feedback_received": 0, "knowledge_base_entries": 0, "average_user_rating": 0.0},
            "learning_status": {"is_learning": False, "improvement_rate": 0.0}
        }
    
    try:
        today = datetime.now().date()
        today_metrics = db.query(models.AILearningMetrics).filter(
            models.AILearningMetrics.date >= datetime.combine(today, datetime.min.time())
        ).first()
        
        total_feedback = db.query(models.UserFeedback).count()
        knowledge_entries = db.query(models.GlobalKnowledgeBase).filter(
            models.GlobalKnowledgeBase.is_active == True
        ).count()
        
        avg_rating_result = db.query(models.UserFeedback.rating).filter(
            models.UserFeedback.rating.isnot(None)
        ).all()
        avg_rating = sum(r[0] for r in avg_rating_result) / len(avg_rating_result) if avg_rating_result else 0.0
        
        return {
            "daily_metrics": {
                "total_interactions": today_metrics.total_interactions if today_metrics else 0,
                "successful_interactions": today_metrics.successful_interactions if today_metrics else 0,
                "average_rating": today_metrics.average_response_rating if today_metrics else 0.0
            },
            "overall_metrics": {
                "total_feedback_received": total_feedback,
                "knowledge_base_entries": knowledge_entries,
                "average_user_rating": round(avg_rating, 2)
            },
            "learning_status": {
                "is_learning": True,
                "improvement_rate": 85.0
            }
        }
    
    except Exception as e:
        print(f"Error getting AI metrics: {str(e)}")
        return {"error": "Could not retrieve AI metrics"}

@app.get("/conversation_starters")
def get_conversation_starters(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        suggestions = []
        
        if user.field_of_study:
            field = user.field_of_study
            suggestions.extend([
                f"What's a fundamental concept in {field}?",
                f"Can you explain a {field} concept that many students find confusing?",
                f"What are some real-world applications of {field}?"
            ])
        
        suggestions.extend([
            "What's something fascinating I probably don't know?",
            "Can you explain a concept using a simple analogy?",
            "Help me understand something that seems counterintuitive",
            "What's a common misconception in my field of study?",
            "Can you give me a challenging problem to solve?",
            "What's the most important thing to know about my subject?"
        ])
        
        import random
        random.shuffle(suggestions)
        return {"suggestions": suggestions[:8]}
        
    except Exception as e:
        print(f"Error getting conversation starters: {str(e)}")
        return {"suggestions": ["What would you like to learn today?"]}

@app.get("/personalization_insights")
def get_personalization_insights(user_id: str = Query(...), db: Session = Depends(get_db)):
    if not ENHANCED_FEATURES_AVAILABLE:
        return {
            "personalization_confidence": 0.0,
            "learning_style": {"primary": "balanced"},
            "migration_status": "not_run"
        }
    
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            profile = db.query(models.UserPersonalityProfile).filter(
                models.UserPersonalityProfile.user_id == user.id
            ).first()
            
            topic_masteries = db.query(models.TopicMastery).filter(
                models.TopicMastery.user_id == user.id
            ).order_by(models.TopicMastery.mastery_level.desc()).limit(10).all()
            
            insights = {
                "personalization_confidence": profile.profile_confidence if profile else 0.0,
                "learning_style": {
                    "primary": "Visual" if profile and profile.visual_learner_score > 0.6 else "balanced",
                    "visual_score": profile.visual_learner_score if profile else 0.5,
                    "auditory_score": profile.auditory_learner_score if profile else 0.5,
                    "kinesthetic_score": profile.kinesthetic_learner_score if profile else 0.5,
                    "reading_score": profile.reading_learner_score if profile else 0.5
                },
                "topic_expertise": [
                    {
                        "topic": mastery.topic_name.replace('_', ' ').title(),
                        "mastery_level": mastery.mastery_level,
                        "times_studied": mastery.times_studied
                    }
                    for mastery in topic_masteries
                ],
                "migration_status": "completed"
            }
            
            return insights
            
        except Exception as table_error:
            return {
                "personalization_confidence": 0.0,
                "learning_style": {"primary": "balanced"},
                "migration_status": "not_run"
            }
        
    except Exception as e:
        print(f"Error getting personalization insights: {str(e)}")
        return {
            "personalization_confidence": 0.0,
            "error": "Could not retrieve personalization data"
        }

@app.get("/system_status")
def get_system_status(db: Session = Depends(get_db)):
    status = {
        "basic_features": True,
        "enhanced_features": ENHANCED_FEATURES_AVAILABLE,
        "rag_features": get_rag_system(db) is not None,
        "database_tables": {}
    }
    
    # Check basic tables
    try:
        status["database_tables"]["users"] = db.query(models.User).count()
        status["database_tables"]["chat_sessions"] = db.query(models.ChatSession).count()
        status["database_tables"]["chat_messages"] = db.query(models.ChatMessage).count()
        status["database_tables"]["activities"] = db.query(models.Activity).count()
        status["database_tables"]["notes"] = db.query(models.Note).count()
        status["database_tables"]["user_stats"] = db.query(models.UserStats).count()
        status["database_tables"]["flashcard_sets"] = db.query(models.FlashcardSet).count()
        status["database_tables"]["flashcards"] = db.query(models.Flashcard).count()
        status["database_tables"]["flashcard_study_sessions"] = db.query(models.FlashcardStudySession).count()
    except Exception as e:
        status["basic_tables_error"] = str(e)
    
    # Check enhanced tables if available
    if ENHANCED_FEATURES_AVAILABLE:
        try:
            status["database_tables"]["global_knowledge_base"] = db.query(models.GlobalKnowledgeBase).count()
            status["database_tables"]["user_feedback"] = db.query(models.UserFeedback).count()
            status["database_tables"]["ai_learning_metrics"] = db.query(models.AILearningMetrics).count()
            status["migration_status"] = "completed"
        except Exception as e:
            status["migration_status"] = "tables_missing"
            status["enhanced_tables_error"] = str(e)
    else:
        status["migration_status"] = "not_run"
        status["recommendation"] = "Run 'python migration.py' to enable enhanced features"
    
    # Check RAG tables
    try:
        status["database_tables"]["conversation_memory"] = db.query(models.ConversationMemory).count()
        status["database_tables"]["topic_knowledge_base"] = db.query(models.TopicKnowledgeBase).count()
        status["rag_status"] = "enabled"
    except Exception as e:
        status["rag_status"] = "disabled"
        status["rag_error"] = str(e)
    
    return status

# ==================== NOTE SUMMARY GENERATION ====================

@app.post("/generate_note_summary/")
async def generate_note_summary(
    user_id: str = Form(...),
    conversation_data: str = Form(...),
    session_titles: str = Form(...),
    import_mode: str = Form("summary"),
    db: Session = Depends(get_db)
):
    """Generate AI-enhanced note summaries from chat conversations"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        llm = Ollama(model="llama3")
        
        # Parse session titles
        try:
            titles = json.loads(session_titles)
        except:
            titles = ["Chat Session"]
        
        # Build prompt based on import mode
        if import_mode == "summary":
            prompt = f"""You are an expert educational content creator. Convert the following chat conversations into well-structured study notes.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or                 context_str += f"You asked: \"{msg.user_message}\"\n"
                context_str += f"I explained: \"{msg.ai_response[:200]}{'...' if len(msg.ai_response) > 200 else ''}\"\n"
                context_str += "---\n"
            
            context_str += f"\nIMPORTANT: Build upon this conversation history. Reference relevant previous discussions.\n"
            context_str += f"If the current question relates to previous topics, acknowledge the connection.\n"
            context_str += "=== END MEMORY ===\n\n"
        
        # Get RAG system and try to enhance the prompt
        rag_system = get_rag_system(db)
        rag_used = False
        
        # Build enhanced AI prompt
        if ai_response_data and ENHANCED_FEATURES_AVAILABLE:
            # Use enhanced prompt with full context
            ai_prompt = ai_response_data['enhanced_prompt']
            print(f"Using enhanced prompt (length: {len(ai_prompt)} chars)")
        elif rag_system:
            # Use RAG-enhanced prompt
            try:
                base_prompt = f"""You are Dr. Alexandra Chen, an expert AI tutor with persistent memory across ALL conversations with {user.first_name or 'this student'}. You have deep expertise in {user.field_of_study or 'various subjects'} and understand {user.learning_style or 'mixed'} learning approaches.

STUDENT PROFILE:
- Name: {user.first_name or 'Student'}  
- Field: {user.field_of_study or 'Interdisciplinary Studies'}
- Learning Style: {user.learning_style or 'Adaptive'} learner
- Academic Level: {user.school_university or 'General Education'}
- Age Group: {f"{user.age} years old" if user.age else "Student"}

CONVERSATION MEMORY:
{context_str}

CURRENT QUESTION: {question}

RESPONSE GUIDELINES:
1. MEMORY: Reference relevant previous conversations - build upon what we've discussed
2. CONTEXT: If this is a follow-up (like "where are the equations?"), acknowledge the previous context explicitly  
3. PERSONALIZATION: Adapt explanation style to their learning preference ({user.learning_style or 'mixed'} learner)
4. FIELD-SPECIFIC: Include examples relevant to {user.field_of_study or 'their studies'}
5. COMPLETENESS: If they asked for specific things (equations, examples, steps), provide them clearly
6. ENGAGEMENT: Use encouraging tone and check understanding

CRITICAL: You have perfect memory of all our conversations. Always acknowledge continuity and build upon previous discussions.

Generate a comprehensive, personalized response:"""

                ai_prompt = rag_system.get_enhanced_prompt(
                    user_question=question,
                    user_id=user.id,
                    base_prompt=base_prompt,
                    max_context_length=2000
                )
                rag_used = True
                print(f"Using RAG-enhanced prompt with conversation history")
            except Exception as rag_error:
                print(f"RAG enhancement failed: {rag_error}")
                ai_prompt = base_prompt
        else:
            # Enhanced AI prompt with better context awareness
            ai_prompt = f"""You are Dr. Alexandra Chen, an expert AI tutor with persistent memory across ALL conversations with {user.first_name or 'this student'}. You have deep expertise in {user.field_of_study or 'various subjects'} and understand {user.learning_style or 'mixed'} learning approaches.

STUDENT PROFILE:
- Name: {user.first_name or 'Student'}  
- Field: {user.field_of_study or 'Interdisciplinary Studies'}
- Learning Style: {user.learning_style or 'Adaptive'} learner
- Academic Level: {user.school_university or 'General Education'}
- Age Group: {f"{user.age} years old" if user.age else "Student"}

CONVERSATION MEMORY:
{context_str}

CURRENT QUESTION: {question}

RESPONSE GUIDELINES:
1. MEMORY: Reference relevant previous conversations - build upon what we've discussed
2. CONTEXT: If this is a follow-up (like "where are the equations?"), acknowledge the previous context explicitly  
3. PERSONALIZATION: Adapt explanation style to their learning preference ({user.learning_style or 'mixed'} learner)
4. FIELD-SPECIFIC: Include examples relevant to {user.field_of_study or 'their studies'}
5. COMPLETENESS: If they asked for specific things (equations, examples, steps), provide them clearly
6. ENGAGEMENT: Use encouraging tone and check understanding

CRITICAL: You have perfect memory of all our conversations. Always acknowledge continuity and build upon previous discussions.

Generate a comprehensive, personalized response:"""

        print(f"Using enhanced prompt (length: {len(ai_prompt)} chars)")
        
        # Enhanced error handling with better fallback
        print(f"Sending to Ollama...")
        try:
            response = llm.invoke(ai_prompt)
            print(f"Got response from Ollama (length: {len(response)} chars)")
            
            # Validate response quality
            if len(response.strip()) < 30:
                response = f"""I understand you're asking about: "{question}"

Based on your profile as a {user.learning_style or 'dedicated'} learner studying {user.field_of_study or 'various subjects'}, this is definitely worth exploring.

Let me provide a more complete response: {response}

Would you like me to elaborate on any specific aspect of this topic? I'm here to help you understand it thoroughly."""

        except Exception as llm_error:
            print(f"Ollama invoke failed: {llm_error}")
            
            # Intelligent fallback based on question type
            if any(word in question.lower() for word in ['equation', 'formula', 'calculate']):
                response = f"""I understand you're looking for mathematical help with: {question}

While I'm experiencing technical difficulties, I can tell you that this type of problem typically involves:
1. Identifying the key variables and relationships
2. Applying relevant formulas or principles
3. Working through the calculation step by step

For {user.field_of_study or 'your field'}, this concept is particularly important. Would you like me to try explaining this again once I'm back online?"""
            
            elif any(word in question.lower() for word in ['explain', 'what is', 'how does']):
                response = f"""I want to help you understand: {question}

As a {user.learning_style or 'dedicated'} learner in {user.field_of_study or 'your field'}, you're asking about an important concept. 

While I'm having some technical issues right now, this topic typically involves key principles that I'd love to explain in detail. Could you try asking again in a moment? I'll be ready to give you a comprehensive explanation tailored to your learning style."""
            
            else:
                response = f"""I'm here to help with your question: {question}

I'm experiencing some technical difficulties at the moment, but I want to make sure you get the help you need with {user.field_of_study or 'your studies'}. 

Please try asking again in a few moments, and I'll provide you with a detailed, personalized explanation suited to your {user.learning_style or 'learning'} style."""
        
        # Store conversation in RAG system for future learning
        memory_id = None
        if rag_system:
            try:
                memory_id = rag_system.store_conversation(
                    user_id=user.id,
                    session_id=chat_id_int or 0,
                    question=question,
                    answer=response
                )
                print(f"Stored conversation in RAG system (memory_id: {memory_id})")
            except Exception as rag_store_error:
                print(f"Failed to store in RAG system: {rag_store_error}")
        
        # Enhanced response analysis
        response_analysis = analyze_response_quality(question, response, user)
        
        # Store activity with enhanced features
        print(f"Storing activity...")
        try:
            activity = models.Activity(
                user_id=user.id,
                question=question,
                answer=response,
                topic=", ".join(response_analysis["topics_discussed"])
            )
            db.add(activity)
            db.commit()
            print(f"Activity stored successfully")
        except Exception as activity_error:
            print(f"Error storing activity: {activity_error}")
        
        # Update personalization if enhanced features available
        if ENHANCED_FEATURES_AVAILABLE and ai_response_data:
            try:
                personalization = PersonalizationEngine(db, user.id)
                # Analyze the user's message for learning patterns
                analysis = personalization.analyze_user_message(question)
                print(f"User message analyzed: {analysis}")
                
                # Store conversation memory for persistence
                personalization.store_conversation_memory(
                    memory_type="qa_pair",
                    content=f"Q: {question[:100]}... A: {response[:100]}...",
                    importance=0.7,
                    context=f"Chat session {chat_id_int or 'new'}"
                )
                
                print("Personalization updated successfully")
            except Exception as personalization_error:
                print(f"Personalization update failed: {personalization_error}")
        
        # Build comprehensive result with enhanced metadata
        result = {
            "answer": response,
            "ai_confidence": response_analysis["ai_confidence"],
            "misconception_detected": False,  # Could be enhanced with NLP
            "should_request_feedback": response_analysis["ai_confidence"] < 0.7 or rag_used,
            "topics_discussed": response_analysis["topics_discussed"],
            "enhanced_features_used": ENHANCED_FEATURES_AVAILABLE,
            "memory_persistent": True,
            "rag_enabled": rag_used,
            "memory_id": memory_id,
            "response_quality": {
                "has_equations": response_analysis["has_equations"],
                "has_examples": response_analysis["has_examples"], 
                "has_steps": response_analysis["has_steps"],
                "addresses_followup": response_analysis["addresses_followup"],
                "completeness_score": response_analysis["response_completeness"],
                "is_personalized": response_analysis["is_personalized"]
            },
            "learning_analytics": {
                "user_learning_style": user.learning_style,
                "field_of_study": user.field_of_study,
                "session_context": "rag_enhanced" if rag_used else "enhanced_memory"
            }
        }
        
        print(f"SUCCESS: Returning enhanced response")
        return result
        
    except Exception as e:
        print(f"ERROR in ask_ai: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        return {
            "answer": f"I apologize, but I encountered an error: {str(e)}. Please try again.",
            "ai_confidence": 0.3,
            "misconception_detected": False,
            "should_request_feedback": True,
            "topics_discussed": [],
            "enhanced_features_used": False,
            "memory_persistent": False,
            "rag_enabled": False
        }

# ==================== RAG FEEDBACK ENDPOINTS ====================

@app.post("/rag/feedback")
async def submit_rag_feedback(
    memory_id: int = Form(...),
    rating: float = Form(...),  # 0.0 to 1.0 scale
    feedback_text: str = Form(None),
    db: Session = Depends(get_db)
):
    """Submit feedback for a RAG conversation to improve future responses"""
    try:
        # Validate rating
        if not (0.0 <= rating <= 1.0):
            raise HTTPException(status_code=400, detail="Rating must be between 0.0 and 1.0")
        
        # Get RAG system
        rag_system = get_rag_system(db)
        if not rag_system:
            raise HTTPException(status_code=503, detail="RAG system not available")
        
        # Update feedback
        rag_system.update_feedback(memory_id, rating)
        
        return {
            "status": "success",
            "message": "Feedback recorded successfully",
            "memory_id": memory_id,
            "rating": rating
        }
        
    except Exception as e:
        print(f"Error submitting RAG feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")

@app.get("/rag/stats")
async def get_rag_statistics(
    user_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """Get RAG system learning statistics"""
    try:
        rag_system = get_rag_system(db)
        if not rag_system:
            return {"error": "RAG system not available"}
        
        stats = rag_system.get_learning_stats()
        
        # Add user-specific stats if user_id provided
        if user_id:
            user = get_user_by_username(db, user_id)
            if user:
                user_memories = db.query(models.ConversationMemory).filter(
                    models.ConversationMemory.user_id == user.id
                ).count()
                
                user_avg_feedback = db.query(models.ConversationMemory.user_feedback_score).filter(
                    models.ConversationMemory.user_id == user.id,
                    models.ConversationMemory.user_feedback_score.isnot(None)
                ).all()
                
                if user_avg_feedback:
                    user_avg = sum(f[0] for f in user_avg_feedback) / len(user_avg_feedback)
                else:
                    user_avg = 0.0
                
                stats['user_specific'] = {
                    'total_conversations': user_memories,
                    'average_rating': round(user_avg, 3)
                }
        
        return stats
        
    except Exception as e:
        print(f"Error getting RAG stats: {e}")
        return {"error": "Failed to retrieve statistics"}

@app.get("/rag/health")
async def rag_health_check(db: Session = Depends(get_db)):
    """Check RAG system health and status"""
    try:
        health_status = {
            "rag_available": False,
            "embedding_model": "none",
            "vector_store": "none",
            "database_status": "unknown",
            "memory_count": 0,
            "topic_count": 0,
            "errors": []
        }
        
        try:
            # Test RAG system initialization
            rag_system = get_rag_system(db)
            if rag_system:
                health_status["rag_available"] = True
                
                # Check embedding model
                if rag_system.embedding_model:
                    health_status["embedding_model"] = "sentence-transformers"
                elif hasattr(rag_system, 'tfidf_vectorizer'):
                    health_status["embedding_model"] = "tfidf"
                
                # Check vector store
                from rag_system import FAISS_AVAILABLE
                if FAISS_AVAILABLE and hasattr(rag_system, 'conversation_index'):
                    health_status["vector_store"] = "faiss"
                    health_status["vector_index_size"] = rag_system.conversation_index.ntotal
                else:
                    health_status["vector_store"] = "simple"
                    health_status["vector_index_size"] = len(rag_system.conversation_vectors)
            else:
                health_status["errors"].append("RAG system not initialized")
                
        except Exception as e:
            health_status["errors"].append(f"RAG initialization: {str(e)}")
        
        try:
            # Check database
            memory_count = db.query(models.ConversationMemory).count()
            topic_count = db.query(models.TopicKnowledgeBase).count()
            
            health_status["database_status"] = "connected"
            health_status["memory_count"] = memory_count
            health_status["topic_count"] = topic_count
            
        except Exception as e:
            health_status["errors"].append(f"Database: {str(e)}")
            health_status["database_status"] = "error"
        
        # Overall health
        health_status["overall_status"] = "healthy" if len(health_status["errors"]) == 0 else "degraded"
        
        return health_status
        
    except Exception as e:
        return {
            "overall_status": "error",
            "errors": [str(e)]
        }

# ==================== NOTES MANAGEMENT ====================

@app.post("/create_note")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    user = get_user_by_username(db, note_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    note = models.Note(
        user_id=user.id,
        title=note_data.title,
        content=note_data.content
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat()
    }

@app.get("/get_notes")
def get_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    notes = db.query(models.Note).filter(
        models.Note.user_id == user.id
    ).order_by(models.Note.updated_at.desc()).all()
    
    return [
        {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "created_at": note.created_at.isoformat(),
            "updated_at": note.updated_at.isoformat()
        }
        for note in notes
    ]

@app.put("/update_note")
def update_note(note_data: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_data.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note.title = note_data.title
    note.content = note_data.content
    note.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(note)
    
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "updated_at": note.updated_at.isoformat()
    }

@app.delete("/delete_note/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully"}

# ==================== ACTIVITY ENDPOINTS ====================

@app.get("/get_activities")
def get_activities(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    activities = db.query(models.Activity).filter(
        models.Activity.user_id == user.id
    ).order_by(models.Activity.timestamp.desc()).all()
    
    return [
        {
            "id": activity.id,
            "question": activity.question,
            "answer": activity.answer,
            "topic": activity.topic,
            "timestamp": activity.timestamp.isoformat()
        }
        for activity in activities
    ]

@app.get("/get_recent_activities")
def get_recent_activities(user_id: str = Query(...), limit: int = Query(20), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    recent_activities = db.query(models.Activity).filter(
        models.Activity.user_id == user.id
    ).order_by(models.Activity.timestamp.desc()).limit(limit).all()
    
    return [
        {
            "question": activity.question,
            "answer": activity.answer,
            "topic": activity.topic,
            "timestamp": activity.timestamp.isoformat()
        }
        for activity in recent_activities
    ]

@app.post("/update_user_stats")
def update_user_stats(
    user_id: str = Form(...),
    lessons: int = Form(None),
    hours: float = Form(None),
    streak: int = Form(None),
    accuracy: float = Form(None),
    db: Session = Depends(get_db)
):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stats = db.query(models.UserStats).filter(
        models.UserStats.user_id == user.id
    ).first()
    
    if not stats:
        stats = models.UserStats(user_id=user.id)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    
    if lessons is not None:
        stats.total_lessons = lessons
    if hours is not None:  
        stats.total_hours = hours
    if streak is not None:
        stats.day_streak = streak
    if accuracy is not None:
        stats.accuracy_percentage = accuracy
    
    db.commit()
    
    return {
        "message": "User stats updated successfully",
        "stats": {
            "lessons": stats.total_lessons,
            "hours": stats.total_hours, 
            "streak": stats.day_streak,
            "accuracy": stats.accuracy_percentage
        }
    }

# ==================== FLASHCARD MANAGEMENT ====================

@app.post("/create_flashcard_set")
def create_flashcard_set(set_data: FlashcardSetCreate, db: Session = Depends(get_db)):
    user = get_user_by_username(db, set_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_set = models.FlashcardSet(
        user_id=user.id,
        title=set_data.title,
        description=set_data.description,
        source_type=set_data.source_type,
        source_id=set_data.source_id
    )
    db.add(flashcard_set)
    db.commit()
    db.refresh(flashcard_set)
    
    return {
        "id": flashcard_set.id,
        "title": flashcard_set.title,
        "description": flashcard_set.description,
        "source_type": flashcard_set.source_type,
        "created_at": flashcard_set.created_at.isoformat(),
        "card_count": 0,
        "status": "success"
    }

@app.post("/add_flashcard_to_set")
def add_flashcard_to_set(card_data: FlashcardCreate, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == card_data.set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    flashcard = models.Flashcard(
        set_id=card_data.set_id,
        question=card_data.question,
        answer=card_data.answer,
        difficulty=card_data.difficulty,
        category=card_data.category
    )
    db.add(flashcard)
    db.commit()
    db.refresh(flashcard)
    
    return {
        "id": flashcard.id,
        "question": flashcard.question,
        "answer": flashcard.answer,
        "difficulty": flashcard.difficulty,
        "category": flashcard.category,
        "status": "success"
    }

@app.get("/get_flashcard_sets")
def get_flashcard_sets(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.updated_at.desc()).all()
    
    result = []
    for flashcard_set in flashcard_sets:
        # Count cards in each set
        card_count = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == flashcard_set.id
        ).count()
        
        result.append({
            "id": flashcard_set.id,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "source_type": flashcard_set.source_type,
            "source_id": flashcard_set.source_id,
            "card_count": card_count,
            "created_at": flashcard_set.created_at.isoformat(),
            "updated_at": flashcard_set.updated_at.isoformat()
        })
    
    return {"flashcard_sets": result}

@app.get("/get_flashcards_in_set")
def get_flashcards_in_set(set_id: int = Query(...), db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    flashcards = db.query(models.Flashcard).filter(
        models.Flashcard.set_id == set_id
    ).order_by(models.Flashcard.created_at.asc()).all()
    
    return {
        "set_id": set_id,
        "set_title": flashcard_set.title,
        "set_description": flashcard_set.description,
        "flashcards": [
            {
                "id": card.id,
                "question": card.question,
                "answer": card.answer,
                "difficulty": card.difficulty,
                "category": card.category,
                "times_reviewed": card.times_reviewed,
                "last_reviewed": card.last_reviewed.isoformat() if card.last_reviewed else None,
                "created_at": card.created_at.isoformat()
            }
            for card in flashcards
        ]
    }

@app.get("/get_flashcard_history")
def get_flashcard_history(user_id: str = Query(...), limit: int = Query(50), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all flashcard sets with their recent activity
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.updated_at.desc()).limit(limit).all()
    
    history = []
    for flashcard_set in flashcard_sets:
        # Get card count
        card_count = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == flashcard_set.id
        ).count()
        
        # Get recent study sessions for this set
        recent_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).order_by(models.FlashcardStudySession.session_date.desc()).limit(3).all()
        
        # Calculate total study time and performance
        total_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).count()
        
        total_study_time = db.query(models.FlashcardStudySession.session_duration).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).all()
        
        avg_study_time = sum(duration[0] for duration in total_study_time) / len(total_study_time) if total_study_time else 0
        
        # Calculate accuracy
        all_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).all()
        
        total_cards = sum(session.cards_studied for session in all_sessions)
        total_correct = sum(session.correct_answers for session in all_sessions)
        accuracy = (total_correct / total_cards * 100) if total_cards > 0 else 0
        
        history.append({
            "id": flashcard_set.id,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "source_type": flashcard_set.source_type,
            "source_id": flashcard_set.source_id,
            "card_count": card_count,
            "total_sessions": total_sessions,
            "avg_study_time_minutes": round(avg_study_time, 1),
            "accuracy_percentage": round(accuracy, 1),
            "created_at": flashcard_set.created_at.isoformat(),
            "updated_at": flashcard_set.updated_at.isoformat(),
            "last_studied": recent_sessions[0].session_date.isoformat() if recent_sessions else None,
            "recent_sessions": [
                {
                    "session_date": session.session_date.isoformat(),
                    "cards_studied": session.cards_studied,
                    "correct_answers": session.correct_answers,
                    "session_duration": session.session_duration,
                    "accuracy": round((session.correct_answers / session.cards_studied * 100), 1) if session.cards_studied > 0 else 0
                }
                for session in recent_sessions
            ]
        })
    
    return {
        "total_sets": len(history),
        "flashcard_history": history
    }

@app.post("/record_flashcard_study_session")
def record_flashcard_study_session(session_data: FlashcardStudySession, db: Session = Depends(get_db)):
    user = get_user_by_username(db, session_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_set = db.query(from fastapi import FastAPI, Form, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import func  # Add this import
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import uuid
import json
import re
from dotenv import load_dotenv

from langchain_community.llms import Ollama

import models
from database import SessionLocal, engine

# RAG System imports
from rag_system import (
    ConversationalRAGSystem,
    create_rag_tables,
    init_rag_system,
    get_rag_system
)

# Enhanced features import with fallback
try:
    from global_ai_learning import GlobalAILearningSystem
    from personalization_engine_backend import PersonalizationEngine
    ENHANCED_FEATURES_AVAILABLE = True
except ImportError:
    print("Enhanced AI features not available. Run migration.py to enable them.")
    ENHANCED_FEATURES_AVAILABLE = False

# Load environment variables
load_dotenv()

# Create all database tables including RAG tables
models.Base.metadata.create_all(bind=engine)
create_rag_tables(engine)

app = FastAPI(title="Brainwave Backend API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"

# ==================== STARTUP EVENT ====================

@app.on_event("startup")
async def startup_event():
    """Initialize the application with RAG capabilities"""
    try:
        # Initialize RAG system
        db = SessionLocal()
        try:
            success = init_rag_system(db)
            if success:
                print("RAG system initialized successfully")
            else:
                print("RAG system initialization failed")
        finally:
            db.close()
            
    except Exception as e:
        print(f"Error during startup: {e}")

# ==================== PYDANTIC MODELS ====================

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str
    password: str
    age: Optional[int] = None
    field_of_study: Optional[str] = None
    learning_style: Optional[str] = None
    school_university: Optional[str] = None

class GoogleAuth(BaseModel):
    token: str

class ChatSessionCreate(BaseModel):
    user_id: str
    title: str = "New Chat"

class ChatMessageSave(BaseModel):
    chat_id: int
    user_message: str
    ai_response: str
    
    class Config:
        str_strip_whitespace = True

class NoteCreate(BaseModel):
    user_id: str
    title: str = "New Note"
    content: str = ""

class NoteUpdate(BaseModel):
    note_id: int
    title: str
    content: str

class ActivityData(BaseModel):
    user_id: str
    activity_data: list

class FlashcardSetCreate(BaseModel):
    user_id: str
    title: str = "New Flashcard Set"
    description: str = ""
    source_type: str = "manual"
    source_id: Optional[int] = None

class FlashcardCreate(BaseModel):
    set_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "general"

class FlashcardSetUpdate(BaseModel):
    set_id: int
    title: str
    description: str

class FlashcardUpdate(BaseModel):
    flashcard_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "general"

class FlashcardStudySession(BaseModel):
    set_id: int
    user_id: str
    cards_studied: int
    correct_answers: int
    session_duration: int

# ==================== UTILITY FUNCTIONS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_username(db, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def authenticate_user(db, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        user = get_user_by_email(db, username)
    
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def verify_google_token(token: str):
    try:
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')
        
        return idinfo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid token: {str(e)}")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(verify_token)):
    user = get_user_by_username(db, token)
    if not user:
        user = get_user_by_email(db, token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def analyze_response_quality(question: str, response: str, user: models.User) -> Dict[str, Any]:
    """Analyze response quality and generate metadata"""
    
    question_lower = question.lower()
    response_lower = response.lower()
    
    # Detect response characteristics
    has_equations = bool(re.search(r'[=\+\-\*/\^]|\\[a-zA-Z]+|_{|}|\$.*\$', response))
    has_examples = any(phrase in response_lower for phrase in [
        'for example', 'for instance', 'such as', 'like when', 'imagine', 'consider'
    ])
    has_steps = any(phrase in response_lower for phrase in [
        'step 1', 'step 2', 'first', 'second', 'next', 'then', 'finally', 'lastly'
    ])
    has_definitions = any(phrase in response_lower for phrase in [
        'definition', 'means', 'refers to', 'is defined as', 'can be described as'
    ])
    
    # Calculate AI confidence based on response quality
    confidence = 0.7  # Base confidence
    
    # Boost confidence for comprehensive responses
    if len(response.split()) > 100: confidence += 0.1
    if has_examples: confidence += 0.1
    if has_steps and 'explain' in question_lower: confidence += 0.1
    if has_equations and any(word in question_lower for word in ['equation', 'formula', 'calculate']): confidence += 0.15
    if has_definitions and any(word in question_lower for word in ['what is', 'define', 'meaning']): confidence += 0.1
    
    # Detect if this addresses a follow-up question
    addresses_followup = any(phrase in response_lower for phrase in [
        'you asked', 'previously', 'earlier', 'before', 'as we discussed'
    ])
    
    # Detect topic areas
    topics = []
    topic_keywords = {
        "mathematics": ["math", "equation", "formula", "calculate", "algebra", "geometry", "calculus"],
        "science": ["experiment", "hypothesis", "theory", "research", "analysis", "scientific"],
        "physics": ["force", "energy", "motion", "relativity", "quantum", "particle", "wave"],
        "programming": ["code", "function", "algorithm", "programming", "software", "debug"],
        "biology": ["cell", "organism", "genetics", "evolution", "anatomy", "biology"],
        "chemistry": ["element", "compound", "reaction", "molecule", "chemical", "atom"],
        "history": ["historical", "period", "event", "timeline", "civilization", "century"],
        "literature": ["author", "novel", "poem", "literary", "character", "story"]
    }
    
    for topic, keywords in topic_keywords.items():
        if any(keyword in question_lower or keyword in response_lower for keyword in keywords):
            topics.append(topic)
    
    return {
        "ai_confidence": min(confidence, 1.0),
        "has_equations": has_equations,
        "has_examples": has_examples,
        "has_steps": has_steps,
        "has_definitions": has_definitions,
        "addresses_followup": addresses_followup,
        "topics_discussed": topics or ["general"],
        "response_completeness": min(len(response.split()) / 150, 1.0),
        "is_personalized": user.field_of_study.lower() in response_lower if user.field_of_study else False
    }

# ==================== BASIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "Brainwave Backend API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "API is running"}

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/register")
async def register(
    first_name: str = Form(...),
    last_name: str = Form(...), 
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    age: int = Form(None),
    field_of_study: str = Form(None),
    learning_style: str = Form(None),
    school_university: str = Form(None),
    db: Session = Depends(get_db)
):
    print(f"REGISTER: Attempting to register user: {username} ({first_name} {last_name})")
    
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    if get_user_by_username(db, username):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(password)
    db_user = models.User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        username=username,
        hashed_password=hashed_password,
        age=age,
        field_of_study=field_of_study,
        learning_style=learning_style,
        school_university=school_university,
        google_user=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create user stats
    user_stats = models.UserStats(user_id=db_user.id)
    db.add(user_stats)
    db.commit()
    
    print(f"REGISTER: User {username} registered successfully")
    return {"message": "User registered successfully"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    print(f"LOGIN: Login attempt for user: {form_data.username}")
    
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        print(f"LOGIN: Authentication failed for user: {form_data.username}")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    print(f"LOGIN: Login successful for user: {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/token_form")
async def login_form(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    print(f"LOGIN_FORM: Login attempt for user: {username}")
    
    user = authenticate_user(db, username, password)
    if not user:
        print(f"LOGIN_FORM: Authentication failed for user: {username}")
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token_expires = timedelta(hours=24)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    print(f"LOGIN_FORM: Login successful for user: {username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/google-auth")
def google_auth(auth_data: GoogleAuth, db: Session = Depends(get_db)):
    try:
        # Try Google's tokeninfo endpoint first
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.token}"
            response = requests.get(url)
            
            if response.status_code == 200:
                user_info = response.json()
            else:
                raise Exception("Invalid token from tokeninfo")
                
        except Exception:
            # Fallback to Google's verify_oauth2_token
            user_info = verify_google_token(auth_data.token)
        
        email = user_info.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email not found")
        
        user = get_user_by_email(db, email)
        
        if not user:
            # Create new Google user
            user = models.User(
                first_name=user_info.get('given_name', ''),
                last_name=user_info.get('family_name', ''),
                email=email,
                username=email,
                hashed_password=get_password_hash("google_oauth"),
                picture_url=user_info.get('picture', ''),
                google_user=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create user stats
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
            db.commit()
        
        access_token = create_access_token(data={"sub": user.username})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_info": {
                "email": email,
                "given_name": user_info.get('given_name'),
                "family_name": user_info.get('family_name'),
                "picture": user_info.get('picture'),
                "google_user": True
            }
        }
    except Exception as e:
        print(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/me")
async def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "username": current_user.username,
        "age": current_user.age,
        "field_of_study": current_user.field_of_study,
        "learning_style": current_user.learning_style,
        "school_university": current_user.school_university,
        "picture_url": current_user.picture_url,
        "google_user": current_user.google_user
    }

# ==================== CHAT SESSION MANAGEMENT ====================

@app.post("/create_chat_session")
def create_chat_session(session_data: ChatSessionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    chat_session = models.ChatSession(
        user_id=current_user.id,
        title=session_data.title
    )
    db.add(chat_session)
    db.commit()
    db.refresh(chat_session)
    
    return {
        "id": chat_session.id,
        "session_id": chat_session.id,
        "title": chat_session.title,
        "created_at": chat_session.created_at.isoformat(),
        "updated_at": chat_session.updated_at.isoformat(),
        "status": "success"
    }

@app.get("/get_chat_sessions")
def get_chat_sessions(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user.id
    ).order_by(models.ChatSession.updated_at.desc()).all()
    
    return {
        "sessions": [
            {
                "id": session.id,
                "title": session.title,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat()
            }
            for session in sessions
        ]
    }

@app.get("/get_chat_messages")
def get_chat_messages(chat_id: int = Query(...), db: Session = Depends(get_db)):
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == chat_id
    ).order_by(models.ChatMessage.timestamp.asc()).all()
    
    result = []
    for message in messages:
        result.append({
            "id": f"{message.id}_user",
            "type": "user",
            "content": message.user_message,
            "timestamp": message.timestamp.isoformat()
        })
        result.append({
            "id": f"{message.id}_ai",
            "type": "ai",
            "content": message.ai_response,
            "timestamp": message.timestamp.isoformat()
        })
    
    return result

@app.get("/get_chat_history/{session_id}")
async def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    try:
        session_id_int = int(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == session_id_int
    ).order_by(models.ChatMessage.timestamp.asc()).all()
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "user_message": msg.user_message,
                "ai_response": msg.ai_response,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ]
    }

@app.post("/save_chat_message")
def save_chat_message(message_data: ChatMessageSave, db: Session = Depends(get_db)):
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == message_data.chat_id
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_message = models.ChatMessage(
        chat_session_id=message_data.chat_id,
        user_message=message_data.user_message,
        ai_response=message_data.ai_response
    )
    db.add(chat_message)
    
    # Update session timestamp
    chat_session.updated_at = datetime.utcnow()
    
    # Auto-generate title for new chats
    message_count = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == message_data.chat_id
    ).count()
    
    if chat_session.title == "New Chat" and message_count == 0:
        user_message = message_data.user_message.strip()
        words = user_message.split()
        
        if len(words) <= 4:
            new_title = user_message
        else:
            new_title = " ".join(words[:4]) + "..."
        
        new_title = new_title[0].upper() + new_title[1:] if new_title else "New Chat"
        new_title = new_title[:50]
        chat_session.title = new_title
    
    db.commit()
    return {"status": "success", "message": "Message saved successfully"}

@app.post("/save_chat_message_json")
async def save_chat_message_json(request: Request, db: Session = Depends(get_db)):
    try:
        json_data = await request.json()
        print(f"Received JSON data: {json_data}")
        
        chat_id = json_data.get('chat_id')
        user_message = json_data.get('user_message')
        ai_response = json_data.get('ai_response')
        
        print(f"Extracted - chat_id: {chat_id}, user_message: {user_message[:50] if user_message else None}")
        
        if isinstance(chat_id, str):
            chat_id = int(chat_id)
        
        if not all([chat_id, user_message, ai_response]):
            raise HTTPException(status_code=400, detail=f"Missing fields - chat_id: {chat_id}, user_message: {bool(user_message)}, ai_response: {bool(ai_response)}")
        
        chat_session = db.query(models.ChatSession).filter(
            models.ChatSession.id == chat_id
        ).first()
        if not chat_session:
            raise HTTPException(status_code=404, detail=f"Chat session {chat_id} not found")
        
        chat_message = models.ChatMessage(
            chat_session_id=chat_id,
            user_message=user_message,
            ai_response=ai_response
        )
        db.add(chat_message)
        
        chat_session.updated_at = datetime.utcnow()
        
        message_count = db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == chat_id
        ).count()
        
        if chat_session.title == "New Chat" and message_count == 0:
            words = user_message.strip().split()
            new_title = " ".join(words[:4]) + ("..." if len(words) > 4 else "")
            new_title = new_title[0].upper() + new_title[1:] if new_title else "New Chat"
            chat_session.title = new_title[:50]
        
        db.commit()
        print("Message saved successfully!")
        return {"status": "success", "message": "Message saved successfully"}
        
    except Exception as e:
        print(f"Error in save_chat_message_json: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete_chat_session/{session_id}")
def delete_chat_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a chat session and all its messages"""
    try:
        chat_session = db.query(models.ChatSession).filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id  # Ensure user owns the session
        ).first()
        
        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Delete all messages in the session first (foreign key constraint)
        db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == session_id
        ).delete()
        
        # Delete the session itself
        db.delete(chat_session)
        db.commit()
        
        return {"message": "Chat session deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting chat session {session_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete chat session")

# ==================== ENHANCED AI CHAT ENDPOINT ====================
@app.post("/ask/")
async def ask_ai(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    print(f"\nDEBUG: Starting enhanced ask_ai")
    print(f"user_id: {user_id}")
    print(f"question: {question[:50]}...")
    print(f"chat_id: {chat_id}")
    
    try:
        # Convert chat_id
        chat_id_int = None
        if chat_id:
            try:
                chat_id_int = int(chat_id)
                print(f"Converted chat_id to int: {chat_id_int}")
            except ValueError:
                print(f"Could not convert chat_id to int: {chat_id}")
                pass
        
        # Get user
        print(f"Looking up user: {user_id}")
        user = get_user_by_username(db, user_id)
        if not user:
            print(f"User not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        print(f"Found user: {user.first_name} {user.last_name}")
        
        # Validate chat session
        if chat_id_int:
            print(f"Validating chat session: {chat_id_int}")
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id
            ).first()
            if not chat_session:
                print(f"Chat session not found: {chat_id_int}")
                raise HTTPException(status_code=404, detail="Chat session not found")
            print(f"Chat session validated")
        
        # Initialize enhanced AI systems if available
        ai_response_data = None
        if ENHANCED_FEATURES_AVAILABLE:
            try:
                print("Initializing enhanced AI features...")
                global_ai = GlobalAILearningSystem(db)
                personalization = PersonalizationEngine(db, user.id)
                
                # Get conversation history from ALL user's chats (not just current chat)
                print("Getting user's complete conversation history...")
                all_user_messages = db.query(models.ChatMessage).join(models.ChatSession).filter(
                    models.ChatSession.user_id == user.id
                ).order_by(models.ChatMessage.timestamp.desc()).limit(10).all()
                
                conversation_history = []
                for msg in reversed(all_user_messages):
                    conversation_history.append({
                        'user_message': msg.user_message,
                        'ai_response': msg.ai_response,
                        'timestamp': msg.timestamp
                    })
                
                # Generate enhanced response using global AI system
                print("Generating enhanced AI response...")
                ai_response_data = global_ai.generate_enhanced_response(
                    user_message=question,
                    user_id=user.id,
                    conversation_history=conversation_history
                )
                
                print(f"Enhanced response generated with confidence: {ai_response_data['ai_confidence']}")
                
            except Exception as enhanced_error:
                print(f"Enhanced features failed, falling back to basic: {enhanced_error}")
                ai_response_data = None
        
        # Initialize Ollama
        print(f"Initializing Ollama...")
        try:
            llm = Ollama(model="llama3")
            print(f"Ollama initialized successfully")
        except Exception as ollama_error:
            print(f"Ollama initialization failed: {ollama_error}")
            raise ollama_error
        
        # Enhanced conversation history retrieval
        recent_messages = db.query(models.ChatMessage).join(models.ChatSession).filter(
            models.ChatSession.user_id == user.id
        ).order_by(models.ChatMessage.timestamp.desc()).limit(8).all()  # Increased to 8 messages

        context_str = ""
        if recent_messages:
            context_str = f"\n=== CONVERSATION MEMORY (Last {len(recent_messages)} exchanges) ===\n"
            
            for i, msg in enumerate(reversed(recent_messages)):  # Chronological order
                context_str += f"Exchange {i+1}:\n"