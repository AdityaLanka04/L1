# Flashcard Seeding Guide

## Quick Start

Run this command in your terminal (from the backend directory):

```bash
./run_seed_flashcards.sh
```

Or with a specific user ID:

```bash
./run_seed_flashcards.sh 2
```

Or run directly with Python:

```bash
python seed_flashcards.py --user-id 1
```

## What This Does

1. **Creates 100 unique flashcards** covering:
   - 25 Computer Science cards (algorithms, data structures, APIs, Docker, etc.)
   - 20 Mathematics cards (calculus, algebra, geometry, theorems)
   - 20 Science cards (physics, biology, chemistry)
   - 15 History cards (major events, figures, periods)
   - 20 Geography & General Knowledge cards

2. **Automatically shows in UI** - The flashcards will appear in:
   - Flashcards page (`/flashcards`)
   - Your flashcard history
   - Available for study sessions
   - Visible in the "My Sets" section

## How It Shows Up in UI

After running the script:

1. **Go to Flashcards page** in your app
2. **Look for**: "Comprehensive Study Collection - 100 Cards"
3. **Click on it** to start studying
4. **All 100 cards** will be ready to review

## Troubleshooting

### If flashcards don't show up:

1. **Check the user ID**: Make sure you're logged in as the same user
   ```bash
   python seed_flashcards.py --user-id YOUR_USER_ID
   ```

2. **Refresh the page**: Sometimes you need to refresh the flashcards page

3. **Check the database**: The script will show you available users if the ID doesn't exist

### If you get "no such table" error:

The script now automatically creates tables, but if you still have issues:
```bash
python migration.py
```

## What Gets Created

**Flashcard Set:**
- Title: "Comprehensive Study Collection - 100 Cards"
- Description: "A diverse collection of 100 flashcards covering Computer Science, Mathematics, Science, History, and Geography"
- Source Type: "seeded"
- User ID: The one you specify (default: 1)

**Each Flashcard Has:**
- Question
- Answer
- Category (Computer Science, Mathematics, Physics, Biology, Chemistry, History, Geography, etc.)
- Difficulty (easy, medium, hard)
- Ready for spaced repetition learning

## API Endpoint Used

The UI fetches flashcards from:
```
GET /api/get_flashcard_history?user_id={user_id}&limit=50
```

This endpoint returns all flashcard sets for a user, including the newly seeded set.

## Customization

To modify the flashcards, edit `seed_flashcards.py` and change the `FLASHCARD_DATA` array.

Each card follows this format:
```python
{
    "q": "Question text?",
    "a": "Answer text",
    "category": "Category Name",
    "difficulty": "easy|medium|hard"
}
```
