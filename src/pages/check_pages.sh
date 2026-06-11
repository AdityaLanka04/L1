#!/bin/bash

# List of all pages
pages=(
ActivityFeed AdminAnalytics AdminApiUsage Analytics Atlas AudioVideoNotes
CanvasHub Challenges ChallengeSession ConceptWeb ContextFileAnalysis ContextHub
CustomizeDashboard CustomPopup Dashboard Vault Games Leaderboards
SoloQuiz SoloQuizReview SoloQuizSession Statistics StudyInsights
NotesHub NotesDashboard WeaknessPractice WeaknessTips FriendsDashboard
KnowledgeMap LearningPathDetail LearningPaths LearningReviewHub SlideExplorer
Weaknesses profile ProfileNew Social LearningReviewHub
)

echo "PAGES NEEDING GLOBAL NAV SIDEBAR:"
for f in "${pages[@]}"; do
  if [ -f "${f}.js" ]; then
    # Check if it has nav to other pages or global sidebar pattern
    if grep -q "navigate.*dashboard\|navigate.*flashcard\|navigate.*ai-chat\|navigate.*search\|navigate.*question\|navigate.*quiz" "${f}.js" 2>/dev/null; then
      if ! grep -q "qb-shell\|qb-sidebar\|collapsed-strip" "${f}.js" 2>/dev/null; then
        echo "  $f"
      fi
    fi
  fi
done
