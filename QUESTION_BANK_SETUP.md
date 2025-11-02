# Question Bank - Sophisticated AI-Powered Learning System

## Overview
Complete Question Bank system with AI agents, ML-based adaptive difficulty, and sophisticated question generation from PDFs, custom content, and learning sessions.

## Architecture

### Backend Components

#### 1. **question_bank_agents.py** - Core AI Agents
Sophisticated agents handling different aspects of question management:

**DifficultyClassifierAgent**
- Analyzes questions using Bloom's taxonomy
- Classifies difficulty (easy, medium, hard)
- Estimates time to complete
- Identifies prerequisite concepts
- Keyword-based fallback analysis

**PDFProcessorAgent**
- Extracts text from PDFs using PyPDF2
- Fallback OCR processing for scanned documents
- Analyzes document structure and extracts metadata
- Identifies topics, concepts, and learning objectives

**QuestionGeneratorAgent**
- Generates high-quality exam-style questions
- Supports multiple question types:
  - Multiple choice
  - True/False
  - Short answer
  - Fill in the blank
- Respects difficulty distribution
- Validates generated questions for quality
- Generates similar questions for practice variations

**AdaptiveDifficultyAgent**
- Analyzes user performance history
- Recommends difficulty levels
- Tracks accuracy by difficulty
- Suggests question distribution based on performance
- Real-time difficulty adjustment

**PerformanceAnalyzer**
- Calculates comprehensive metrics
- Identifies strengths and weaknesses
- Rates performance on scale
- Tracks performance by topic and difficulty

**MLPerformancePredictor**
- Predicts success probability on questions
- Weighs multiple factors:
  - Recent accuracy (30%)
  - Topic familiarity (20%)
  - Question difficulty (20%)
  - Available time (15%)
  - Current streak (15%)
- Recommends weak areas for focused practice

### Database Models
Located in `question_bank_models.py`:

**QuestionSet**
- Stores question collections
- Tracks source (PDF, custom, chat, slides)
- Records attempts and best scores
- Links to User model

**Question**
- Individual questions with full details
- Cognitive level (Bloom's taxonomy)
- Estimated completion time
- Topic tagging
- Multiple choice options storage
- Explanation and answer key

**QuestionSession**
- Records each practice session
- Stores detailed results
- Tracks scoring and timing
- Links user performance to questions

**UploadedDocument**
- Manages uploaded PDFs and content
- Stores extracted text and metadata
- Preserves document type and structure

**UserPerformanceMetrics**
- Aggregate performance data
- ML model inputs and outputs
- Long-term tracking

### Frontend Component

**QuestionBank.js** - Main Component
- 4-tab interface matching Dashboard styling
- Minimalistic design with sharp corners
- Responsive grid layout

**Tab 1: My Sets**
- Displays all question sets in card grid
- Shows title, description, source, question count
- Displays best score and attempts
- Practice button for each set
- Delete functionality with confirmation

**Tab 2: From PDF**
- Drag-and-drop PDF upload zone
- Document analysis display
- Generation settings:
  - Set title input
  - Question count slider (5-50)
  - Difficulty distribution controls
  - Question type selection
- Generate button with loading state

**Tab 3: Custom Content**
- Textarea for content input
- Same generation settings as PDF tab
- Supports paste content directly
- Real-time content validation

**Tab 4: Chats/Slides** (Framework ready)
- UI for selecting chat sessions
- UI for selecting uploaded slides
- Backend integration coming soon

### Study Mode Features

**Practice Interface**
- Full-screen question display
- Progress bar with visual tracking
- Question navigation (prev/next)
- Multiple question types rendering
- Radio buttons, checkboxes, text inputs
- Difficulty badges with color coding

**Answer Submission**
- Immediate scoring calculation
- Detailed result feedback
- Explanation for each answer
- Performance analysis with recommendations
- Next steps based on adaptive algorithm

**Similar Question Generation**
- Generate practice variations of any question
- Adjustable difficulty level
- Same concept, different wording/numbers
- Add to current set for extended practice

## API Endpoints

### Question Set Management
```
GET  /qb/get_question_sets?userId=
     Returns all question sets for user

GET  /qb/get_question_set/{id}?userId=
     Returns questions in specific set

POST /qb/generate_from_pdf
     Generates questions from content
     
DELETE /qb/delete_question_set/{id}?userId=
       Removes question set
```

### PDF & Document Handling
```
POST /qb/upload_pdf?userId=
     Uploads PDF and analyzes structure
     
GET  /qb/get_uploaded_documents?userId=
     Lists user's uploaded documents
```

### Question Generation
```
POST /qb/generate_similar_question
     Creates variation of existing question
```

### Answer & Scoring
```
POST /qb/submit_answers
     Submits answers and calculates score
     
GET  /qb/get_adaptive_recommendations?userId=
     Returns difficulty recommendations
```

## CSS Styling

**QuestionBank.css** - Minimalistic Dashboard Style
- Sharp corners (4px border-radius)
- Clean color scheme matching Dashboard
- Variables for theming:
  - Primary accent: var(--accent, #D7B38C)
  - Background panels: var(--panel, #16181d)
  - Border colors: var(--border, #2a2f37)
  - Text colors: var(--text-primary, #EAECEF)

**Features**
- Smooth transitions and animations
- Responsive grid layout
- Glassmorphism effects minimal
- Proper spacing and typography
- Custom input styling
- Color-coded difficulty badges
- Progress bars with gradient
- Modal dialogs for similar question generation

## ML Features

### Adaptive Learning
- Performance-based difficulty progression
- Streak tracking (consecutive correct/wrong answers)
- Session-based recommendations
- Historical data analysis (10 latest sessions)

### Question Difficulty Classification
- Bloom's taxonomy mapping
- Cognitive complexity analysis
- Prerequisite identification
- Time estimation
- Keyword-based confidence scoring

### Performance Prediction
- Success probability calculation
- Feature weighting system
- Topic familiarity assessment
- Fatigue factor consideration

## Data Flow

1. **Question Generation**
   - User uploads PDF or enters content
   - PDFProcessorAgent extracts and analyzes
   - QuestionGeneratorAgent creates questions
   - DifficultyClassifierAgent classifies each
   - Questions stored in database

2. **Practice Session**
   - User selects question set
   - Questions loaded and displayed
   - User answers stored in state
   - Answers submitted to backend
   - Scoring calculation with PerformanceAnalyzer
   - AdaptiveDifficultyAgent provides recommendations

3. **Similar Question Generation**
   - User selects question from set
   - QuestionGeneratorAgent creates variation
   - Same concept, different difficulty possible
   - Added to current question set

## Setup & Dependencies

### Backend Requirements
```
FastAPI
SQLAlchemy
Pydantic
Groq API
PyPDF2
Pytesseract (for OCR)
NumPy & SciPy (for ML calculations)
```

### Frontend Requirements
```
React 18+
lucide-react (icons)
CSS with CSS Grid & Flexbox
```

## Configuration

### API Parameters
- Uses `userId` (username or email) for user identification
- Backend handles lookup from either field
- Query parameters properly URL encoded

### Difficulty Levels
- **Easy**: 50% accuracy threshold, 2 correct streak
- **Medium**: Standard starting difficulty
- **Hard**: 85% accuracy threshold for recommendation

### ML Weights
- Recent accuracy: 35%
- Topic familiarity: 25%
- Time factor: 10%
- Session length: 15%
- Difficulty progression: 15%

## Key Features Summary

✅ PDF upload with document analysis
✅ Custom content input for question generation
✅ AI-powered question generation with proper distribution
✅ Similar question generation for practice variations
✅ Full practice mode with progress tracking
✅ Adaptive difficulty based on ML analysis
✅ Multiple question types support
✅ Comprehensive scoring and feedback
✅ Dashboard-style minimalistic UI
✅ Mobile responsive design
✅ Real-time performance metrics
✅ Bloom's taxonomy-based classification

## Performance Optimization

- Async question generation
- Efficient database queries with indexing
- Lazy loading of question sets
- Caching of user preferences
- Optimized PDF processing with page limits

## Error Handling

- User not found responses
- Invalid file format handling
- Graceful fallbacks for parsing failures
- Transaction rollback on errors
- Detailed error logging
- User-friendly error messages