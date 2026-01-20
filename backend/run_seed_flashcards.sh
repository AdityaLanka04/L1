#!/bin/bash

# Script to seed 100 flashcards into the database
# Usage: ./run_seed_flashcards.sh [user_id]

USER_ID=${1:-1}

echo "============================================================"
echo "🚀 SEEDING 100 FLASHCARDS"
echo "============================================================"
echo "User ID: $USER_ID"
echo ""

# Activate conda environment if needed (uncomment and modify if you have a specific env)
# conda activate your_env_name

# Run the seeding script
python seed_flashcards.py --user-id $USER_ID

echo ""
echo "============================================================"
echo "✅ Done! Check your flashcards UI to see the new cards"
echo "============================================================"
