@echo off
echo ========================================
echo Starting BrainwaveAI Backend
echo ========================================
echo.

cd backend

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo.
echo Starting FastAPI server...
echo Backend will be available at http://localhost:8000
echo API docs at http://localhost:8000/docs
echo.

python main.py

pause
