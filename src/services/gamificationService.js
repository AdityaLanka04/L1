import { API_URL } from '../config';

class GamificationService {
  async trackActivity(userName, activityType, metadata = {}) {
    if (!userName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/track_gamification_activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          activity_type: activityType,
          metadata: metadata
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Gamification: +${data.points_earned} pts for ${activityType}`);
        return data;
      }
    } catch (error) {
      console.error('Gamification tracking error:', error);
    }
  }

  async trackAIChat(userName) {
    return this.trackActivity(userName, 'ai_chat', {});
  }

  async trackStudySession(userName, minutes) {
    return this.trackActivity(userName, 'study_time', { minutes: minutes });
  }

  async trackNoteCreated(userName) {
    return this.trackActivity(userName, 'note_created', {});
  }

  async trackFlashcardSet(userName, cardCount) {
    return this.trackActivity(userName, 'flashcard_set', { card_count: cardCount });
  }

  async trackQuizCompleted(userName, score, totalQuestions) {
    const scorePercentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    return this.trackActivity(userName, 'quiz_completed', { 
      score: score, 
      total_questions: totalQuestions,
      score_percentage: scorePercentage
    });
  }

  async trackQuestionAnswered(userName, correct) {
    return this.trackActivity(userName, 'question_answered', { correct: correct });
  }

  async trackStudyTime(userName, minutes) {
    return this.trackActivity(userName, 'study_time', { minutes: minutes });
  }

  async trackBattleResult(userName, result) {
    return this.trackActivity(userName, 'battle_result', { result: result });
  }
}

const gamificationServiceInstance = new GamificationService();
export default gamificationServiceInstance;
