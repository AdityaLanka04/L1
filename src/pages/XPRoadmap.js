import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Award, Star, Zap, Target, Crown, Flame, 
  BookOpen, Brain, Sparkles, Rocket, Medal, Gift,
  TrendingUp, CheckCircle, Lock, ChevronRight,
  MessageCircle, FileText, Layers, Clock
, Menu} from 'lucide-react';
import './XPRoadmap.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Main XP Milestones
const MILESTONES = [
  { id: 1, xp: 0, title: 'Welcome Aboard', description: 'Start your learning journey', icon: 'rocket', tier: 'bronze', reward: 'Welcome Badge' },
  { id: 2, xp: 10, title: 'First Steps', description: 'Earn your first 10 XP', icon: 'star', tier: 'bronze', reward: 'Beginner Title' },
  { id: 3, xp: 25, title: 'Quick Learner', description: 'Reach 25 XP', icon: 'zap', tier: 'bronze', reward: '5 Bonus XP' },
  { id: 4, xp: 50, title: 'Getting Started', description: 'Accumulate 50 XP', icon: 'target', tier: 'bronze', reward: 'Starter Pack' },
  { id: 5, xp: 100, title: 'Century Club', description: 'Reach 100 XP', icon: 'trophy', tier: 'bronze', reward: 'Bronze Badge' },
  { id: 6, xp: 150, title: 'Consistent Learner', description: 'Earn 150 XP', icon: 'check-circle', tier: 'bronze', reward: 'Consistency Badge' },
  { id: 7, xp: 200, title: 'Knowledge Seeker', description: 'Achieve 200 XP', icon: 'book-open', tier: 'bronze', reward: '15 Bonus XP' },
  { id: 8, xp: 250, title: 'Quarter Master', description: 'Reach 250 XP', icon: 'award', tier: 'bronze', reward: 'Quarter Badge' },
  { id: 9, xp: 300, title: 'Rising Star', description: 'Hit 300 XP', icon: 'sparkles', tier: 'bronze', reward: '20 Bonus XP' },
  { id: 10, xp: 400, title: 'Progress Maker', description: 'Reach 400 XP', icon: 'trending-up', tier: 'bronze', reward: '25 Bonus XP' },
  { id: 11, xp: 500, title: 'Bronze Master', description: 'Complete Bronze tier', icon: 'medal', tier: 'bronze', reward: 'Bronze Crown' },
  
  { id: 12, xp: 600, title: 'Silver Initiate', description: 'Enter Silver tier', icon: 'star', tier: 'silver', reward: 'Silver Badge' },
  { id: 13, xp: 700, title: 'Lucky Seven', description: 'Achieve 700 XP', icon: 'sparkles', tier: 'silver', reward: '35 Bonus XP' },
  { id: 14, xp: 800, title: 'Octo Achievement', description: 'Hit 800 XP', icon: 'award', tier: 'silver', reward: '40 Bonus XP' },
  { id: 15, xp: 1000, title: 'Millennium Master', description: 'Reach 1000 XP!', icon: 'crown', tier: 'silver', reward: 'Millennium Crown' },
  { id: 16, xp: 1200, title: 'Dozen Hundreds', description: 'Achieve 1200 XP', icon: 'trophy', tier: 'silver', reward: 'Collector Badge' },
  { id: 17, xp: 1500, title: 'Silver Legend', description: 'Complete Silver tier', icon: 'crown', tier: 'silver', reward: 'Silver Crown' },
  
  { id: 18, xp: 1600, title: 'Golden Touch', description: 'Enter Gold tier', icon: 'sparkles', tier: 'gold', reward: 'Gold Badge' },
  { id: 19, xp: 1800, title: 'Master Student', description: 'Hit 1800 XP', icon: 'book-open', tier: 'gold', reward: '85 Bonus XP' },
  { id: 20, xp: 2000, title: 'Double Millennium', description: 'Reach 2000 XP!', icon: 'crown', tier: 'gold', reward: 'Double Crown' },
  { id: 21, xp: 2500, title: 'Quarter Master Gold', description: 'Achieve 2500 XP', icon: 'medal', tier: 'gold', reward: 'Quarter Gold Badge' },
  { id: 22, xp: 3000, title: 'Gold Legend', description: 'Complete Gold tier', icon: 'crown', tier: 'gold', reward: 'Gold Crown' },
  
  { id: 23, xp: 3500, title: 'Platinum Entry', description: 'Enter Platinum tier', icon: 'star', tier: 'platinum', reward: 'Platinum Badge' },
  { id: 24, xp: 4000, title: 'Quad Millennium', description: 'Achieve 4000 XP!', icon: 'crown', tier: 'platinum', reward: 'Quad Crown' },
  { id: 25, xp: 4500, title: 'Platinum Mastery', description: 'Reach 4500 XP', icon: 'brain', tier: 'platinum', reward: '210 Bonus XP' },
  { id: 26, xp: 5000, title: 'Platinum Legend', description: 'Complete Platinum', icon: 'crown', tier: 'platinum', reward: 'Platinum Crown' },
  
  { id: 27, xp: 6000, title: 'Diamond Entry', description: 'Enter Diamond tier', icon: 'star', tier: 'diamond', reward: 'Diamond Badge' },
  { id: 28, xp: 7000, title: 'Seven Thousand', description: 'Achieve 7000 XP!', icon: 'crown', tier: 'diamond', reward: 'Seven K Crown' },
  { id: 29, xp: 7500, title: 'Diamond Master', description: 'Complete Diamond', icon: 'crown', tier: 'diamond', reward: 'Diamond Crown' },
  
  { id: 30, xp: 8000, title: 'Mythic Entry', description: 'Enter Mythic tier', icon: 'star', tier: 'mythic', reward: 'Mythic Badge' },
  { id: 31, xp: 9000, title: 'Nine Thousand', description: 'Achieve 9000 XP!', icon: 'crown', tier: 'mythic', reward: 'Nine K Crown' },
  { id: 32, xp: 10000, title: 'Mythic Master', description: 'Complete Mythic', icon: 'crown', tier: 'mythic', reward: 'Mythic Crown' },
  
  { id: 33, xp: 12000, title: 'Legendary Entry', description: 'Enter Legendary tier', icon: 'crown', tier: 'legendary', reward: 'Legendary Badge' },
  { id: 34, xp: 15000, title: 'Fifteen Thousand', description: 'Achieve 15000 XP!', icon: 'crown', tier: 'legendary', reward: 'Fifteen K Crown' },
  { id: 35, xp: 20000, title: 'Twenty Thousand', description: 'Achieve 20000 XP!', icon: 'crown', tier: 'legendary', reward: 'Twenty K Crown' },
  { id: 36, xp: 25000, title: 'Quarter Century', description: 'Reach 25000 XP', icon: 'trophy', tier: 'legendary', reward: '5000 Bonus XP' },
  { id: 37, xp: 30000, title: 'Thirty Thousand', description: 'Hit 30000 XP', icon: 'crown', tier: 'legendary', reward: 'Thirty K Crown' },
  { id: 38, xp: 40000, title: 'Forty Thousand', description: 'Hit 40000 XP', icon: 'star', tier: 'legendary', reward: '8000 Bonus XP' },
  { id: 39, xp: 50000, title: 'Fifty Thousand', description: 'Achieve 50000 XP!', icon: 'crown', tier: 'legendary', reward: 'Fifty K Crown' },
  { id: 40, xp: 100000, title: 'ULTIMATE LEGEND', description: 'Achieve 100000 XP!!!', icon: 'crown', tier: 'legendary', reward: 'ULTIMATE CROWN' },
];

// Activity-based achievements (interspersed with XP milestones)
const ACTIVITY_ACHIEVEMENTS = [
  // AI Chat Achievements
  { id: 'chat_5', type: 'ai_chat', target: 5, current: 0, title: 'Curious Mind', description: 'Ask AI 5 questions', icon: 'message-circle', reward: '10 XP Bonus' },
  { id: 'chat_10', type: 'ai_chat', target: 10, current: 0, title: 'Question Master', description: 'Ask AI 10 questions', icon: 'message-circle', reward: '20 XP Bonus' },
  { id: 'chat_25', type: 'ai_chat', target: 25, current: 0, title: 'AI Enthusiast', description: 'Ask AI 25 questions', icon: 'message-circle', reward: '50 XP Bonus' },
  { id: 'chat_50', type: 'ai_chat', target: 50, current: 0, title: 'AI Scholar', description: 'Ask AI 50 questions', icon: 'message-circle', reward: '100 XP Bonus' },
  { id: 'chat_100', type: 'ai_chat', target: 100, current: 0, title: 'AI Expert', description: 'Ask AI 100 questions', icon: 'message-circle', reward: '200 XP Bonus' },
  
  // Flashcard Achievements
  { id: 'flash_5', type: 'flashcards', target: 5, current: 0, title: 'Card Creator', description: 'Create 5 flashcard sets', icon: 'layers', reward: '25 XP Bonus' },
  { id: 'flash_10', type: 'flashcards', target: 10, current: 0, title: 'Memory Builder', description: 'Create 10 flashcard sets', icon: 'layers', reward: '50 XP Bonus' },
  { id: 'flash_20', type: 'flashcards', target: 20, current: 0, title: 'Flashcard Master', description: 'Create 20 flashcard sets', icon: 'layers', reward: '100 XP Bonus' },
  { id: 'flash_review_50', type: 'flashcard_reviews', target: 50, current: 0, title: 'Review Rookie', description: 'Review 50 flashcards', icon: 'layers', reward: '30 XP Bonus' },
  { id: 'flash_review_100', type: 'flashcard_reviews', target: 100, current: 0, title: 'Review Champion', description: 'Review 100 flashcards', icon: 'layers', reward: '60 XP Bonus' },
  
  // Notes Achievements
  { id: 'notes_3', type: 'notes', target: 3, current: 0, title: 'Note Taker', description: 'Create 3 notes', icon: 'file-text', reward: '15 XP Bonus' },
  { id: 'notes_10', type: 'notes', target: 10, current: 0, title: 'Documenter', description: 'Create 10 notes', icon: 'file-text', reward: '50 XP Bonus' },
  { id: 'notes_25', type: 'notes', target: 25, current: 0, title: 'Knowledge Keeper', description: 'Create 25 notes', icon: 'file-text', reward: '125 XP Bonus' },
  { id: 'notes_50', type: 'notes', target: 50, current: 0, title: 'Master Archivist', description: 'Create 50 notes', icon: 'file-text', reward: '250 XP Bonus' },
  
  // Quiz Achievements
  { id: 'quiz_3', type: 'quizzes', target: 3, current: 0, title: 'Quiz Starter', description: 'Complete 3 quizzes', icon: 'target', reward: '20 XP Bonus' },
  { id: 'quiz_10', type: 'quizzes', target: 10, current: 0, title: 'Quiz Enthusiast', description: 'Complete 10 quizzes', icon: 'target', reward: '75 XP Bonus' },
  { id: 'quiz_25', type: 'quizzes', target: 25, current: 0, title: 'Quiz Master', description: 'Complete 25 quizzes', icon: 'target', reward: '200 XP Bonus' },
  { id: 'quiz_perfect', type: 'quiz_perfect', target: 5, current: 0, title: 'Perfectionist', description: 'Get 100% on 5 quizzes', icon: 'trophy', reward: '150 XP Bonus' },
  
  // Streak Achievements
  { id: 'streak_3', type: 'streak', target: 3, current: 0, title: '3-Day Streak', description: 'Study for 3 days in a row', icon: 'flame', reward: '30 XP Bonus' },
  { id: 'streak_7', type: 'streak', target: 7, current: 0, title: 'Week Warrior', description: 'Study for 7 days in a row', icon: 'flame', reward: '70 XP Bonus' },
  { id: 'streak_14', type: 'streak', target: 14, current: 0, title: 'Two Week Champion', description: 'Study for 14 days in a row', icon: 'flame', reward: '150 XP Bonus' },
  { id: 'streak_30', type: 'streak', target: 30, current: 0, title: 'Monthly Master', description: 'Study for 30 days in a row', icon: 'flame', reward: '300 XP Bonus' },
  
  // Study Time Achievements
  { id: 'study_60', type: 'study_time', target: 60, current: 0, title: 'Hour Scholar', description: 'Study for 1 hour total', icon: 'clock', reward: '25 XP Bonus' },
  { id: 'study_300', type: 'study_time', target: 300, current: 0, title: '5 Hour Grind', description: 'Study for 5 hours total', icon: 'clock', reward: '100 XP Bonus' },
  { id: 'study_600', type: 'study_time', target: 600, current: 0, title: '10 Hour Dedication', description: 'Study for 10 hours total', icon: 'clock', reward: '200 XP Bonus' },
  { id: 'study_1200', type: 'study_time', target: 1200, current: 0, title: '20 Hour Master', description: 'Study for 20 hours total', icon: 'clock', reward: '400 XP Bonus' },
];

const XPRoadmap = () => {
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState(null);
  const [activityAchievements, setActivityAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  useEffect(() => {
    fetchRoadmapData();
  }, []);

  const fetchRoadmapData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userName = localStorage.getItem('username');
      
      // Fetch gamification stats
      const statsResponse = await fetch(`${API_BASE_URL}/api/get_gamification_stats?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setUserStats(stats);
        
        // Update activity achievements with actual user data
        const updatedAchievements = ACTIVITY_ACHIEVEMENTS.map(achievement => {
          let current = 0;
          switch(achievement.type) {
            case 'ai_chat':
              current = stats.total_ai_chats || 0;
              break;
            case 'flashcards':
              current = stats.total_flashcards_created || 0;
              break;
            case 'flashcard_reviews':
              current = stats.total_flashcards_reviewed || 0;
              break;
            case 'notes':
              current = stats.total_notes_created || 0;
              break;
            case 'quizzes':
              current = stats.total_quizzes_completed || 0;
              break;
            case 'streak':
              current = stats.current_streak || 0;
              break;
            case 'study_time':
              current = stats.total_study_minutes || 0;
              break;
            case 'quiz_perfect':
              current = 0; // Would need separate tracking
              break;
          }
          return { ...achievement, current, completed: current >= achievement.target };
        });
        
        setActivityAchievements(updatedAchievements);
      }
      
    } catch (error) {
      console.error('Error fetching roadmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName) => {
    const icons = {
      'trophy': Trophy, 'award': Award, 'star': Star, 'zap': Zap,
      'target': Target, 'crown': Crown, 'flame': Flame, 'book-open': BookOpen,
      'brain': Brain, 'sparkles': Sparkles, 'rocket': Rocket, 'medal': Medal,
      'gift': Gift, 'trending-up': TrendingUp, 'check-circle': CheckCircle,
      'layers': Layers, 'clock': Clock, 'message-circle': MessageCircle,
      'file-text': FileText
    };
    return icons[iconName] || Star;
  };

  const getTierColor = (tier) => {
    const colors = {
      'bronze': '#cd7f32', 'silver': '#c0c0c0', 'gold': '#ffd700',
      'platinum': '#e5e4e2', 'diamond': '#b9f2ff', 'mythic': '#ff00ff',
      'legendary': '#ff4500'
    };
    return colors[tier] || '#888';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'ai_chat': MessageCircle,
      'notes': FileText,
      'flashcards': Layers,
      'quizzes': Target
    };
    return icons[type] || Star;
  };

  const getMilestoneStatus = (milestone) => {
    if (!userStats) return 'locked';
    if (userStats.total_points >= milestone.xp) return 'completed';
    
    const completedMilestones = MILESTONES.filter(m => userStats.total_points >= m.xp);
    const nextMilestone = MILESTONES.find(m => userStats.total_points < m.xp);
    
    if (milestone.id === nextMilestone?.id) return 'current';
    return 'locked';
  };

  const getProgressToMilestone = (milestone) => {
    if (!userStats) return 0;
    if (userStats.total_points >= milestone.xp) return 100;
    
    const previousMilestone = MILESTONES.filter(m => m.xp < milestone.xp).pop();
    const startXP = previousMilestone?.xp || 0;
    const endXP = milestone.xp;
    const currentXP = userStats.total_points;
    
    return Math.min(100, Math.max(0, ((currentXP - startXP) / (endXP - startXP)) * 100));
  };

  const handleMilestoneClick = (milestone) => {
    const status = getMilestoneStatus(milestone);
    if (status === 'completed') {
      setSelectedMilestone(milestone);
      setShowRewardModal(true);
    }
  };

  const completedCount = MILESTONES.filter(m => getMilestoneStatus(m) === 'completed').length;
  const totalCount = MILESTONES.length;
  const completionPercentage = (completedCount / totalCount) * 100;

  if (loading) {
    return (
      <div className="xp-roadmap-loading">
        <div className="loading-spinner-xp"></div>
        <p>Loading Your Journey...</p>
      </div>
    );
  }

  return (
    <div className="xp-roadmap-container">
      {/* Standardized Header */}
      <header className="xp-roadmap-header">
        <div className="xp-roadmap-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="xp-roadmap-logo" onClick={() => navigate('/search-hub')}>
            <div className="xp-roadmap-logo-img" />
            cerbyl
          </h1>
          <div className="xp-roadmap-header-divider"></div>
          <span className="xp-roadmap-subtitle">XP Roadmap</span>
        </div>
        <nav className="xp-roadmap-header-right">
          <button className="xp-roadmap-nav-btn xp-roadmap-nav-btn-accent">
            <Zap size={16} />
            <span>{userStats?.total_points || 0} XP</span>
          </button>
          <button className="xp-roadmap-nav-btn xp-roadmap-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="xp-roadmap-body">
        {/* Main Roadmap Section - Full Width */}
        <div className="xp-roadmap-main-full">
          <div className="roadmap-section-header">
            <Trophy size={24} />
            <div>
              <h2>Your XP Journey</h2>
              <p>{completedCount} of {totalCount} milestones completed ({completionPercentage.toFixed(1)}%)</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="overall-progress">
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${completionPercentage}%` }} />
            </div>
          </div>

          {/* Combined Milestones Path with Activity Achievements */}
          <div className="roadmap-path">
            {MILESTONES.map((milestone, index) => {
              const status = getMilestoneStatus(milestone);
              const progress = getProgressToMilestone(milestone);
              const IconComponent = getIconComponent(milestone.icon);
              
              // Get relevant activity achievements to show after this milestone
              const relevantAchievements = activityAchievements.filter(ach => {
                // Show achievements between milestones based on their target values
                if (index < MILESTONES.length - 1) {
                  const nextMilestone = MILESTONES[index + 1];
                  // Distribute achievements evenly
                  return ach.target <= (milestone.xp + nextMilestone.xp) / 2 && 
                         ach.target > (index > 0 ? (MILESTONES[index - 1].xp + milestone.xp) / 2 : 0);
                }
                return false;
              }).slice(0, 2); // Show max 2 achievements between milestones
              
              return (
                <React.Fragment key={milestone.id}>
                  <div className="milestone-wrapper">
                    {index > 0 && (
                      <div className={`milestone-connector ${status === 'completed' ? 'completed' : ''}`}>
                        <div className="connector-line" />
                      </div>
                    )}
                    
                    <div 
                      className={`milestone-node ${status}`}
                      onClick={() => handleMilestoneClick(milestone)}
                      style={{ borderColor: getTierColor(milestone.tier) }}
                    >
                      <div className="milestone-icon-wrapper">
                        <div 
                          className="milestone-icon"
                          style={{ 
                            backgroundColor: status === 'completed' ? getTierColor(milestone.tier) : 'transparent',
                            borderColor: getTierColor(milestone.tier)
                          }}
                        >
                          {status === 'locked' ? (
                            <Lock size={24} />
                          ) : status === 'completed' ? (
                            <CheckCircle size={24} />
                          ) : (
                            <IconComponent size={24} />
                          )}
                        </div>
                        {status === 'current' && (
                          <div className="current-indicator">
                            <Zap size={16} />
                          </div>
                        )}
                      </div>
                      
                      <div className="milestone-content">
                        <div className="milestone-header">
                          <span className="milestone-xp">{milestone.xp.toLocaleString()} XP</span>
                          <span className="milestone-tier" style={{ color: getTierColor(milestone.tier) }}>
                            {milestone.tier.toUpperCase()}
                          </span>
                        </div>
                        
                        <h3 className="milestone-title">{milestone.title}</h3>
                        <p className="milestone-description">{milestone.description}</p>
                        
                        {status === 'current' && (
                          <div className="milestone-progress">
                            <div className="progress-bar-mini">
                              <div 
                                className="progress-fill-mini" 
                                style={{ 
                                  width: `${progress}%`,
                                  backgroundColor: getTierColor(milestone.tier)
                                }}
                              />
                            </div>
                            <span className="progress-text">{progress.toFixed(0)}%</span>
                          </div>
                        )}
                        
                        <div className="milestone-reward">
                          <Gift size={16} />
                          <span>{milestone.reward}</span>
                        </div>
                        
                        {status === 'completed' && (
                          <div className="completed-badge">
                            <CheckCircle size={16} />
                            <span>COMPLETED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Activity Achievements */}
                  {relevantAchievements.map((achievement, achIndex) => {
                    const AchIconComponent = getIconComponent(achievement.icon);
                    const achProgress = Math.min(100, (achievement.current / achievement.target) * 100);
                    
                    return (
                      <div key={achievement.id} className="milestone-wrapper">
                        <div className={`milestone-connector ${achievement.completed ? 'completed' : ''}`}>
                          <div className="connector-line" />
                        </div>
                        
                        <div 
                          className={`activity-achievement-node ${achievement.completed ? 'completed' : ''}`}
                          data-type={achievement.type}
                        >
                          <div className="achievement-icon">
                            <AchIconComponent size={20} />
                          </div>
                          <div className="achievement-content">
                            <h4 className="achievement-title">{achievement.title}</h4>
                            <p className="achievement-description">{achievement.description}</p>
                            
                            <div className="achievement-progress">
                              <div className="progress-bar-mini">
                                <div 
                                  className="progress-fill-mini" 
                                  style={{ width: `${achProgress}%` }}
                                />
                              </div>
                              <span className="progress-text">{achievement.current}/{achievement.target}</span>
                            </div>
                            
                            <div className="achievement-reward">
                              <Gift size={14} />
                              <span>{achievement.reward}</span>
                            </div>
                            
                            {achievement.completed && (
                              <div className="achievement-completed-badge">
                                <CheckCircle size={14} />
                                <span>ACHIEVED</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      {/* Reward Modal */}
      {showRewardModal && selectedMilestone && (
        <div className="reward-modal-overlay" onClick={() => setShowRewardModal(false)}>
          <div className="reward-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRewardModal(false)}>×</button>
            
            <div className="reward-content">
              <div className="reward-icon-large">
                {React.createElement(getIconComponent(selectedMilestone.icon), { size: 64 })}
              </div>
              
              <h2 className="reward-title">{selectedMilestone.title}</h2>
              <p className="reward-description">{selectedMilestone.description}</p>
              
              <div className="reward-xp-badge">
                <Zap size={24} />
                <span>{selectedMilestone.xp.toLocaleString()} XP</span>
              </div>
              
              <div className="reward-tier-badge" style={{ backgroundColor: getTierColor(selectedMilestone.tier) }}>
                {selectedMilestone.tier.toUpperCase()} TIER
              </div>
              
              <div className="reward-prize">
                <Gift size={32} />
                <h3>Reward Unlocked!</h3>
                <p>{selectedMilestone.reward}</p>
              </div>
              
              <button 
                className="claim-reward-btn"
                style={{ backgroundColor: getTierColor(selectedMilestone.tier) }}
              >
                <CheckCircle size={20} />
                Milestone Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default XPRoadmap;
