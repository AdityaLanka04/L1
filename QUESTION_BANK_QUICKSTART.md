# Question Bank System - Quick Start Guide

## 🚀 Getting Started

### Backend Setup
```powershell
cd d:\Brainwave\L1\backend
python main.py
```

Server starts on: `http://localhost:8000`

### Frontend Access
Navigate to: `http://localhost:3000/question-bank`

---

## 📚 System Features

### Tab 1: My Question Sets
**Browse and study previously created question sets**

1. View all your question sets in list format
2. Click on any set to start studying
3. Click "Delete" to remove a set
4. Sets show: title, total questions, best score, attempts

### Tab 2: From PDF
**Upload PDFs and auto-generate questions**

1. Click "Upload PDF" button
2. Select a PDF file (assignments, notes, textbooks)
3. AI analyzes the document
4. Configure generation:
   - Question count (default: 10)
   - Difficulty mix (easy/medium/hard)
   - Question types
5. AI generates similar-to-exam questions
6. Review and start studying

### Tab 3: Custom Content
**Generate questions from any text**

1. Paste content into text area
2. Set parameters:
   - Question Count
   - Difficulty Distribution
   - Question Types:
     - Multiple Choice
     - True/False
     - Short Answer
     - Fill in the Blank
3. Click "Generate Questions"
4. Questions are saved as a set
5. Start studying immediately

---

## 🎓 Study Mode

### Question Display
- Shows one question at a time
- Displays question type clearly
- Shows difficulty level
- Displays question number and total

### Answer Options
**Multiple Choice:**
- Select one option from the list
- Options clearly labeled A, B, C, D

**True/False:**
- Two button options
- Clear selection state

**Short Answer:**
- Text input field
- Type your answer

**Fill in the Blank:**
- Text input field
- Complete the sentence/statement

### Similar Question Generation
While studying any question:
1. Click "Generate Similar" button
2. Select desired difficulty (Easy/Medium/Hard)
3. Choose variation level
4. AI generates a related question
5. Use to test understanding

### Navigation
- **Previous** button - Go to previous question (disabled on first)
- **Next** button - Go to next question
- **Finish** button - End quiz and see results (appears on last question)

---

## 📊 Results Display

After completing a set:
- **Score** - Percentage correct
- **Accuracy** - Questions answered correctly
- **Time Spent** - Total time for set
- **Breakdown by Difficulty** - Performance on easy/medium/hard
- **Question Review** - See correct answers and explanations

---

## 🎯 Adaptive Learning

The system learns your patterns:
- **Tracks Performance** - Accuracy on each topic
- **Adjusts Difficulty** - Recommends harder questions if you excel
- **Suggests Topics** - Identifies weak areas
- **Predicts Success** - ML model estimates your performance

Get recommendations:
1. Complete several sets
2. System analyzes patterns
3. Recommendations appear in interface
4. Follow suggestions for optimal learning

---

## 🔑 API Reference

### Upload PDF
```
POST /qb/upload_pdf
Query: userId=<username>
Body: PDF file
```

### Generate Questions
```
POST /qb/generate_from_pdf
Body: {
  "userId": "username",
  "content": "PDF text",
  "question_count": 10,
  "question_types": ["multiple_choice", "true_false"],
  "difficulty_distribution": {"easy": 3, "medium": 5, "hard": 2},
  "set_title": "My Question Set"
}
```

### Get Question Sets
```
GET /qb/get_question_sets?userId=<username>
```

### Submit Answers
```
POST /qb/submit_answers
Body: {
  "userId": "username",
  "question_set_id": 1,
  "answers": {"q1": "A", "q2": true},
  "time_spent": 300
}
```

### Generate Similar Question
```
POST /qb/generate_similar_question
Body: {
  "user_id": "username",
  "original_question": {...},
  "difficulty": "medium",
  "variation_level": "moderate"
}
```

---

## 💡 Tips for Best Results

1. **For PDFs:** Use clear, well-formatted documents (textbooks work best)
2. **For Custom Content:** Provide context-rich content for better questions
3. **Question Types:** Mix types for comprehensive understanding
4. **Difficulty Mix:** Start with 30% easy, 50% medium, 20% hard
5. **Review Results:** Check explanations to understand mistakes
6. **Track Progress:** Complete sets regularly to enable adaptive learning
7. **Similar Questions:** Use when you want deeper understanding of topics

---

## ⚙️ System Architecture

### Frontend (React)
- `QuestionBank.js` - Main component
- `QuestionBank.css` - Styling (dashboard-consistent)
- State management with hooks
- Real-time API integration

### Backend (FastAPI)
- `question_bank.py` - API endpoints (9 total)
- `question_bank_agents.py` - AI agents (6 total)
- `question_bank_models.py` - Database models (5 total)
- `main.py` - FastAPI app initialization

### Database (SQLAlchemy)
- UploadedDocument - PDF storage
- QuestionSet - Set management
- Question - Individual questions
- QuestionSession - Study sessions
- UserPerformanceMetrics - Analytics

### AI Agents
1. **DifficultyClassifier** - Question complexity analysis
2. **PDFProcessor** - Document extraction and analysis
3. **QuestionGenerator** - Question creation
4. **AdaptiveDifficulty** - Performance-based recommendations
5. **PerformanceAnalyzer** - Session metrics calculation
6. **MLPredictor** - Success probability prediction

---

## 🐛 Troubleshooting

### "No question sets appear"
- Make sure you're logged in (username stored in localStorage)
- Check backend is running
- Try refreshing the page

### "PDF upload fails"
- Ensure PDF file is readable and not corrupted
- Try a different PDF file
- Check backend logs for OCR errors

### "AI generation times out"
- Groq API may be slow
- Try smaller question counts
- Check internet connection
- Verify API key in `.env`

### "Modal doesn't open"
- This has been fixed - try refreshing
- Clear browser cache if issue persists
- Check browser console for errors

### "Database errors"
- Backend may need restart
- Check SQLite file permissions
- Verify database path is accessible

---

## 📈 Performance Metrics

The system tracks:
- **Accuracy** - % of correct answers
- **Speed** - Average time per question
- **Consistency** - Performance across sessions
- **Mastery Level** - Beginner/Intermediate/Advanced per topic
- **Trends** - Improvement over time

Access these metrics in the Results display after each quiz.

---

## 🎨 Design Features

- **Minimalist Design** - Clean, distraction-free interface
- **Sharp Corners** - Consistent 4px border-radius
- **Dark Theme** - Easy on the eyes for long study sessions
- **Accent Colors** - #D7B38C highlights on dark background
- **Responsive** - Works on desktop and tablets
- **Smooth Animations** - Polished user experience

---

## 📞 Support

If you encounter issues:
1. Check `QUESTION_BANK_VERIFICATION.md` for system status
2. Review troubleshooting section above
3. Check backend logs for detailed errors
4. Verify all Python dependencies are installed

---

*Ready to start learning? Go to the Question Bank page and create your first question set!*