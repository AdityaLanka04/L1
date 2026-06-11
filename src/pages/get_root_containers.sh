#!/bin/bash

pages=(
"Dashboard.js"
"KnowledgeMap.js"
"SlideExplorer.js"
"Weaknesses.js"
"Social.js"
"Games.js"
"Leaderboards.js"
"FriendsDashboard.js"
"Analytics.js"
"Challenges.js"
"NotesHub.js"
"NotesDashboard.js"
"ContextHub.js"
"Atlas.js"
"Vault.js"
"SoloQuiz.js"
"SoloQuizSession.js"
"LearningPathDetail.js"
"WeaknessTips.js"
"WeaknessPractice.js"
"StudyInsights.js"
"LearningReviewHub.js"
"AdminAnalytics.js"
"AdminApiUsage.js"
"CustomizeDashboard.js"
"ContextFileAnalysis.js"
"ChallengeSession.js"
"QuizBattleSession.js"
"profile.js"
"ProfileNew.js"
"AudioVideoNotes.js"
"ConceptWeb.js"
"Statistics.js"
"ActivityFeed.js"
"PlaylistsPage.js"
)

echo "MISSING PAGES - ROOT CONTAINER CLASSES:"
for file in "${pages[@]}"; do
  # Find the first className in the return JSX
  root_class=$(grep -E "return \(|<div className" "$file" 2>/dev/null | head -5 | grep "className" | head -1 | sed 's/.*className=["'\''\`]\([^"'\''\`]*\).*/\1/' | head -c 50)
  echo "$file:$root_class"
done
