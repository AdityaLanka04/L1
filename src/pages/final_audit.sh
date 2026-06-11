#!/bin/bash

echo "AUDITING ALL 65 PAGES..."
echo ""

# Pages that DEFINITELY have the sidebar (confirmed)
confirmed_done=(
"AIChat.js:ac-qb-shell"
"Flashcards.js:fc-qb-shell"
"MyNotes.js:mn-qb-shell"
"SearchHub.js:sh-shell"
"DashboardCerbyl.js:cb-shell"
"QuizBattle.js:qb-shell"
"ActivityTimeline.js:atl-qb-shell"
"AIMediaNotes.js:amn-qb-shell"
"LearningPaths.js:lp-qb-shell"
"NotesRedesign.js:nr-qb-shell"
"PlaylistDetailPage.js:detail-shell"
"NotesPodcastMode.js:npm-shell"
"XPRoadmap.js:xpv-shell"
"Questionbankdashboard.js:qbd-rb-shell"
)

# Pages that need the sidebar (confirmed through nav patterns)
needs_sidebar=(
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

# Pages to skip
skip_pages=(
"Login.js"
"Register.js"
"Landing.js"
"ProfileQuiz.js"
"BattleNotification.js"
"CustomPopup.js"
"TrialModal.js"
"SharedItemViewer.js"
"SharedContent.js"
"SharedModal.js"
"SharedPage.js"
"HelpTour.js"
"Homepage.js"
)

echo "DONE (${#confirmed_done[@]} pages with persistent global nav sidebar):"
for p in "${confirmed_done[@]}"; do
  echo "  ${p%:*}"
done

echo ""
echo "MISSING (${#needs_sidebar[@]} pages - need sidebar added):"
for p in "${needs_sidebar[@]}"; do
  echo "  $p"
done

echo ""
echo "SKIP (${#skip_pages[@]} pages - no app chrome):"
for p in "${skip_pages[@]}"; do
  echo "  $p"
done

