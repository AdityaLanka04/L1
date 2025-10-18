import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './profile.css';

const Profile = () => {
  const [userName, setUserName] = useState('');
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    fieldOfStudy: '',
    brainwaveGoal: '',
    preferredSubjects: [],
    difficultyLevel: 'intermediate',
    learningPace: 'moderate',
    primaryArchetype: '',
    secondaryArchetype: '',
    archetypeDescription: ''
  });
  
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveTimer, setSaveTimer] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const navigate = useNavigate();

  const allSubjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'Geography', 'Literature', 'Languages', 'Art',
    'Music', 'Economics', 'Business', 'Psychology', 'Philosophy',
    'Engineering', 'Medicine', 'Law', 'Political Science', 'Sociology'
  ];

  const brainwaveGoals = {
    'exam_prep': 'Prepare for exams and tests',
    'homework_help': 'Get help with homework and assignments',
    'concept_mastery': 'Master difficult concepts',
    'skill_building': 'Build new skills and knowledge',
    'career_prep': 'Prepare for career and professional growth',
    'curiosity': 'Learn out of curiosity and interest'
  };

  const archetypeInfo = {
    Logicor: {
      icon: '🧠',
      color: '#4A90E2',
      description: 'You thrive on logical analysis and systematic problem-solving. You excel at breaking down complex concepts into manageable parts.'
    },
    Flowist: {
      icon: '🌊',
      color: '#50C878',
      description: 'You learn best through dynamic, hands-on experiences. You adapt easily and prefer learning by doing.'
    },
    Kinetiq: {
      icon: '⚡',
      color: '#FF6B6B',
      description: 'You\'re a kinesthetic learner who needs movement and physical engagement to process information effectively.'
    },
    Synth: {
      icon: '🔗',
      color: '#9B59B6',
      description: 'You naturally see connections between ideas and excel at integrating knowledge from different domains.'
    },
    Dreamweaver: {
      icon: '✨',
      color: '#F39C12',
      description: 'You think in big pictures and future possibilities. Visual and imaginative approaches resonate with you.'
    },
    Anchor: {
      icon: '⚓',
      color: '#34495E',
      description: 'You value structure, organization, and clear systems. You excel with well-defined goals and methodical approaches.'
    },
    Spark: {
      icon: '💡',
      color: '#E74C3C',
      description: 'You\'re driven by creativity and innovation. Novel ideas and expressive methods fuel your learning.'
    },
    Empathion: {
      icon: '❤️',
      color: '#E91E63',
      description: 'You connect deeply with emotional and interpersonal aspects of learning. You understand through empathy and meaning.'
    },
    Seeker: {
      icon: '🔍',
      color: '#00BCD4',
      description: 'You\'re motivated by curiosity and the joy of discovery. You love exploring new topics and expanding knowledge.'
    },
    Resonant: {
      icon: '🎵',
      color: '#8E44AD',
      description: 'You\'re highly adaptable and tune into different learning environments. You adjust your approach fluidly.'
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (!token) {
      navigate('/login');
      return;
    }

    if (username) {
      setUserName(username);
      loadUserProfile(username);
    }
  }, [navigate]);

  useEffect(() => {
    if (dataLoaded && userName) {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      
      const newTimer = setTimeout(() => {
        if (profileData.firstName || profileData.lastName || profileData.email) {
          autoSaveProfile();
        }
      }, 3000);
      
      setSaveTimer(newTimer);
      
      return () => {
        if (newTimer) {
          clearTimeout(newTimer);
        }
      };
    }
  }, [profileData, userName, dataLoaded]);

  const loadUserProfile = async (username) => {
    if (!username) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_comprehensive_profile?user_id=${username}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setProfileData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          fieldOfStudy: data.fieldOfStudy || '',
          brainwaveGoal: data.brainwaveGoal || '',
          preferredSubjects: data.preferredSubjects || [],
          difficultyLevel: data.difficultyLevel || 'intermediate',
          learningPace: data.learningPace || 'moderate',
          primaryArchetype: data.primaryArchetype || '',
          secondaryArchetype: data.secondaryArchetype || '',
          archetypeDescription: data.archetypeDescription || ''
        });
        
        setDataLoaded(true);
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setDataLoaded(true);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSubject = (subject) => {
    setProfileData(prev => ({
      ...prev,
      preferredSubjects: prev.preferredSubjects.includes(subject)
        ? prev.preferredSubjects.filter(s => s !== subject)
        : [...prev.preferredSubjects, subject]
    }));
  };

  const autoSaveProfile = async () => {
    if (autoSaving) return;
    
    setAutoSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      
      const saveData = {
        user_id: userName,
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        email: profileData.email || '',
        fieldOfStudy: profileData.fieldOfStudy || '',
        brainwaveGoal: profileData.brainwaveGoal || '',
        preferredSubjects: profileData.preferredSubjects || [],
        difficultyLevel: profileData.difficultyLevel || 'intermediate',
        learningPace: profileData.learningPace || 'moderate'
      };
      
      const response = await fetch('http://localhost:8001/update_comprehensive_profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saveData)
      });
      
      if (response.ok) {
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error auto-saving profile:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  const goBack = () => {
    navigate('/dashboard');
  };

  const retakeQuiz = () => {
    navigate('/profile-quiz');
  };

  if (!dataLoaded) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading-container">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="loading-text">Loading your profile...</div>
          </div>
        </div>
      </div>
    );
  }

  const currentArchetype = profileData.primaryArchetype ? archetypeInfo[profileData.primaryArchetype] : null;
  const secondaryArchetypeInfo = profileData.secondaryArchetype ? archetypeInfo[profileData.secondaryArchetype] : null;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-header-left">
            <h1>Learning Profile</h1>
            <p className="profile-header-subtitle">
              Personalize your AI learning experience
            </p>
          </div>
          <div className="profile-header-right">
            <div className="auto-save-indicator">
              {autoSaving && <span className="saving">Saving...</span>}
              {lastSaved && !autoSaving && (
                <span className="last-saved">Last saved: {lastSaved}</span>
              )}
            </div>
            <button className="back-to-dashboard-btn" onClick={goBack}>
              Back to Dashboard
            </button>
          </div>
        </div>

        {profileData.primaryArchetype && (
          <div className="profile-section archetype-section">
            <h3 className="section-title">Your Learning Archetype</h3>
            
            <div className="archetype-display">
              <div className="archetype-card primary-archetype">
                <div className="archetype-badge">PRIMARY</div>
                <div className="archetype-icon">{currentArchetype?.icon}</div>
                <div className="archetype-name" style={{ color: currentArchetype?.color }}>
                  {profileData.primaryArchetype}
                </div>
                <div className="archetype-description">
                  {currentArchetype?.description}
                </div>
              </div>

              {profileData.secondaryArchetype && (
                <div className="archetype-card secondary-archetype">
                  <div className="archetype-badge secondary">SECONDARY</div>
                  <div className="archetype-icon">{secondaryArchetypeInfo?.icon}</div>
                  <div className="archetype-name" style={{ color: secondaryArchetypeInfo?.color }}>
                    {profileData.secondaryArchetype}
                  </div>
                  <div className="archetype-description">
                    {secondaryArchetypeInfo?.description}
                  </div>
                </div>
              )}
            </div>

            <div className="archetype-actions">
              <button className="retake-quiz-btn" onClick={retakeQuiz}>
                Retake Assessment
              </button>
              <p className="archetype-note">
                Your AI tutor adapts its teaching style based on your archetype for personalized learning
              </p>
            </div>
          </div>
        )}

        {!profileData.primaryArchetype && (
          <div className="profile-section archetype-section">
            <h3 className="section-title">Discover Your Learning Archetype</h3>
            <p className="section-subtitle">
              Take our quick assessment to unlock personalized AI tutoring tailored to your unique learning style
            </p>
            <div className="archetype-actions">
              <button className="retake-quiz-btn" onClick={retakeQuiz}>
                Take Learning Archetype Quiz
              </button>
            </div>
          </div>
        )}

        <div className="profile-section">
          <h3 className="section-title">Personal Information</h3>
          
          <div className="profile-info-grid">
            <div className="info-item">
              <label className="info-label">First Name</label>
              <input
                type="text"
                className="form-input"
                value={profileData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter your first name"
              />
            </div>

            <div className="info-item">
              <label className="info-label">Last Name</label>
              <input
                type="text"
                className="form-input"
                value={profileData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter your last name"
              />
            </div>

            <div className="info-item full-width">
              <label className="info-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={profileData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="your.email@example.com"
              />
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h3 className="section-title">Learning Goals & Interests</h3>
          
          <div className="profile-info-grid">
            <div className="info-item">
              <label className="info-label">Main Subject</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={profileData.fieldOfStudy}
                  onChange={(e) => handleInputChange('fieldOfStudy', e.target.value)}
                >
                  <option value="">Select your main subject</option>
                  {allSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="info-item">
              <label className="info-label">Primary Goal</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={profileData.brainwaveGoal}
                  onChange={(e) => handleInputChange('brainwaveGoal', e.target.value)}
                >
                  <option value="">Select your goal</option>
                  {Object.entries(brainwaveGoals).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="info-item full-width">
              <label className="info-label">Interested Subjects</label>
              <div className="subjects-display">
                {profileData.preferredSubjects.length > 0 ? (
                  profileData.preferredSubjects.map(subject => (
                    <span key={subject} className="subject-tag">
                      {subject}
                      <button 
                        className="remove-subject-btn"
                        onClick={() => toggleSubject(subject)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="no-subjects">No subjects selected</p>
                )}
              </div>
              <div className="add-subjects-section">
                <div className="subject-selection-grid">
                  {allSubjects
                    .filter(s => !profileData.preferredSubjects.includes(s))
                    .map(subject => (
                      <button
                        key={subject}
                        className="add-subject-btn"
                        onClick={() => toggleSubject(subject)}
                      >
                        + {subject}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h3 className="section-title">Learning Preferences</h3>
          
          <div className="profile-info-grid">
            <div className="info-item">
              <label className="info-label">Difficulty Level</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={profileData.difficultyLevel}
                  onChange={(e) => handleInputChange('difficultyLevel', e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>

            <div className="info-item">
              <label className="info-label">Learning Pace</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={profileData.learningPace}
                  onChange={(e) => handleInputChange('learningPace', e.target.value)}
                >
                  <option value="slow">Slow and Steady</option>
                  <option value="moderate">Moderate</option>
                  <option value="fast">Fast-paced</option>
                  <option value="intensive">Intensive</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;