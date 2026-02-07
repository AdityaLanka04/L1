# BrainwaveAI - AI-Powered Learning Platform

An intelligent learning platform with AI tutoring, adaptive learning paths, flashcards, quizzes, and comprehensive progress tracking.

## Features

- 🤖 **AI Chat Tutor** - Interactive AI assistant for learning
- 📚 **Learning Paths** - AI-generated personalized learning roadmaps
- 🎯 **Progress Tracking** - Automatic progress tracking across all activities
- 📝 **Smart Notes** - AI-enhanced note-taking with Notion-like blocks
- 🎴 **Flashcards** - Spaced repetition learning
- 📊 **Question Bank** - Custom quiz generation from PDFs, slides, and chat
- 🎮 **Gamification** - XP, levels, achievements, and leaderboards
- 📈 **Analytics** - Detailed learning insights and statistics
- 🔗 **Knowledge Graph** - Visual concept mapping with Neo4j

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+
- Redis (optional, for caching)
- Neo4j (optional, for knowledge graph)

### 1. Clone Repository

```bash
git clone <repository-url>
cd BrainwaveAI
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `backend/.env` with your API keys:

```env
# Required
SECRET_KEY=your-secret-key-here
GOOGLE_GENERATIVE_AI_KEY=your-gemini-api-key

# Database (SQLite by default)
DATABASE_URL=sqlite:///./brainwave_tutor.db

# Optional Services
REDIS_URL=redis://localhost:6379
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password

# Firebase (for authentication)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
```

### 4. Run Backend

```bash
# Make sure you're in backend folder with venv activated
python main.py
```

Backend will start on `http://localhost:8000`

### 5. Frontend Setup

Open a new terminal:

```bash
# From project root
npm install

# Start development server
npm start
```

Frontend will start on `http://localhost:3000`

## Project Structure

```
BrainwaveAI/
├── backend/
│   ├── main.py                 # FastAPI main application
│   ├── models.py               # Database models
│   ├── database.py             # Database configuration
│   ├── agents/                 # AI agents
│   │   ├── chat_agent.py
│   │   ├── learning_path_agent.py
│   │   ├── learning_progress_tracker.py
│   │   └── ...
│   ├── learning_progress_api.py    # Progress tracking endpoints
│   ├── learning_progress_hooks.py  # Activity tracking hooks
│   └── requirements.txt
├── src/
│   ├── pages/                  # React pages
│   ├── components/             # React components
│   ├── services/               # API services
│   └── utils/                  # Utilities
├── public/
└── package.json
```

## Key Features Setup

### Learning Progress Tracking

Progress tracking is **automatic** - no additional setup needed! It works by:

1. Monitoring all study activities (chat, notes, flashcards, quizzes)
2. Using AI to match content to learning path nodes
3. Automatically updating progress in real-time
4. Displaying progress bars on learning path pages

### AI Chat Integration

The AI chat automatically tracks learning progress. When you ask questions:
- Content is analyzed by AI
- Matched to relevant learning path nodes
- Progress is updated automatically
- Terminal shows detailed logs

### Knowledge Graph (Optional)

To enable the knowledge graph feature:

1. Install Neo4j Desktop or Docker
2. Configure Neo4j credentials in `.env`
3. Run initialization script:
   ```bash
   cd backend
   python initialize_existing_users_kg.py
   ```

### Redis Caching (Optional)

For improved performance:

1. Install Redis
2. Configure `REDIS_URL` in `.env`
3. Caching will be enabled automatically

## API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Common Issues

### Backend won't start
- Ensure virtual environment is activated
- Check all required environment variables are set
- Verify Python version is 3.9+

### Frontend won't connect to backend
- Ensure backend is running on port 8000
- Check `src/config/api.js` has correct API URL
- Verify CORS is enabled in backend

### Progress tracking not working
- Check terminal logs for detailed debugging info
- Ensure you have an active learning path
- Verify Gemini API key is set (or keyword matching will be used)

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
npm test
```

### Database Migrations

```bash
cd backend
python migration.py
```

## Production Deployment

### Backend

```bash
# Use production environment
export ENV=production

# Run with gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend

```bash
# Build for production
npm run build

# Serve with nginx or any static server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions, please open a GitHub issue.
