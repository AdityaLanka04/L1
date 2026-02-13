# Flashcard System - Quick Start Guide

## What Was Fixed

### 1. Preview Mode (Flippable Cards)
**Before:** No feedback after reviewing cards  
**After:** Shows summary with known/unknown counts and personalized encouragement

### 2. Study Mode (Quiz)
**Before:** Could go back and re-answer questions, causing incorrect statistics  
**After:** Linear progression, accurate scoring, always shows correct answer

### 3. Database
**Before:** Missing `share_code` column causing errors  
**After:** Column added, flashcards generate successfully

## How to Use

### Preview Mode (Review Flashcards)
1. Go to Flashcards page
2. Select a flashcard set
3. Click "Preview" or the eye icon
4. Flip cards by clicking on them
5. Mark each card as "I know this" or "I don't know this"
6. Click EXIT at any time to see your stats, or complete all cards
7. Results screen shows:
   - How many you know
   - How many you don't know
   - Total cards reviewed (only cards you marked)
   - Personalized message
   - Special message if you didn't mark any cards
8. Choose to:
   - Review Again (restart preview)
   - Start Quiz (switch to quiz mode)
   - Exit (return to flashcards)

### Study Mode (Quiz)
1. Go to Flashcards page
2. Select a flashcard set
3. Click "Study" or the target icon
4. Answer multiple-choice questions
5. After selecting an answer:
   - Correct answer shows in green ✓
   - Wrong answer shows in red ✗
   - Click "Next Question" to continue
6. Cannot go back to previous questions
7. At the end, see your score with:
   - Number correct
   - Number incorrect
   - Total questions
   - Personalized feedback based on percentage
8. Choose to:
   - Study Again (restart quiz)
   - Back to Flashcards (exit)

## Personalized Messages

### Preview Mode
- 80%+ known: "🎉 Excellent! You know X% of these cards..."
- 50-79% known: "👍 Good progress! You know X% of these cards..."
- Below 50%: "💪 You know X% of these cards. Practice makes perfect!"

### Study Mode (Quiz)
- 100%: "🎉 Perfect score! You're a master of this topic!"
- 90-99%: "🌟 Outstanding! You got X% correct. Almost perfect!"
- 80-89%: "🎯 Excellent work! You scored X%. Keep it up!"
- 70-79%: "👍 Good job! You got X% correct. You're making progress!"
- 60-69%: "📚 Not bad! You scored X%. Review the material and try again!"
- Below 60%: "💪 You scored X%. Don't give up - practice makes perfect!"

## Technical Details

### Database Migration
The migration script has already been run. If you need to run it again:
```bash
python backend/add_share_code_column.py
```

### Files Changed
- `src/pages/Flashcards.js` - Main component logic
- `src/pages/Flashcards.css` - Results message styling
- `backend/add_share_code_column.py` - Migration script

### No Breaking Changes
All changes are backward compatible. Existing flashcard sets will continue to work.

## Troubleshooting

### "Table has no column named share_code/is_edited/edited_at" Error
Run the migration script:
```bash
python backend/migrate_flashcard_tables.py
```

### Results Not Showing
- Make sure you're clicking "I know this" or "I don't know this" for each card
- Complete all cards in the set
- Check browser console for errors

### Statistics Incorrect
- This should now be fixed
- If you still see issues, try clearing browser cache
- Make sure you're not using browser back button during quiz

### Flashcards Not Generating
- Check backend logs for errors
- Verify database migration completed
- Ensure API keys are configured (Gemini/Groq)

## Need Help?

Check these files for more details:
- `FLASHCARD_FIXES.md` - Detailed technical changes
- `DEPLOYMENT_NOTES.md` - Deployment and testing guide
- Backend logs - For API/database errors
- Browser console - For frontend errors
