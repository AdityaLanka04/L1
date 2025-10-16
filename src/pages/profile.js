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
    difficultyLevel: 'intermediate',
    learningPace: 'moderate',
    primaryArchetype: '',
    secondaryArchetype: '',
    archetypeDescription: '',
    preferredSubjects: [],
    quizResponses: {
      learningEnvironment: '',
      problemSolving: '',
      newConcepts: '',
      studyPreference: '',
      challengeResponse: '',
      informationProcessing: '',
      groupWork: '',
      timeManagement: '',
      creativity: '',
      feedback: ''
    }
  });
  
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveTimer, setSaveTimer] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const navigate = useNavigate();

  const fieldsOfStudy = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Engineering', 'Medicine', 'Business', 'Economics', 'Psychology',
    'Literature', 'History', 'Philosophy', 'Art', 'Languages', 'General Studies'
  ];

  const allSubjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'Geography', 'Literature', 'Languages', 'Art',
    'Music', 'Economics', 'Business', 'Psychology', 'Philosophy',
    'Engineering', 'Medicine', 'Law', 'Political Science', 'Sociology'
  ];

  const quizQuestions = {
    learningEnvironment: {
      question: "What type of learning environment helps you focus best?",
      options: [
        { value: "structured", label: "Structured with clear guidelines" },
        { value: "flexible", label: "Flexible and adaptable" },
        { value: "collaborative", label: "Collaborative and social" },
        { value: "independent", label: "Independent and self-directed" }
      ]
    },
    problemSolving: {
      question: "When facing a complex problem, you prefer to:",
      options: [
        { value: "break_down", label: "Break it down into logical steps" },
        { value: "visualize", label: "Visualize the big picture first" },
        { value: "experiment", label: "Experiment and try different approaches" },
        { value: "discuss", label: "Discuss with others for insights" }
      ]
    },
    newConcepts: {
      question: "How do you best absorb new concepts?",
      options: [
        { value: "reading", label: "Reading detailed explanations" },
        { value: "visual", label: "Visual diagrams and charts" },
        { value: "hands_on", label: "Hands-on practice" },
        { value: "discussion", label: "Discussion and debate" }
      ]
    },
    studyPreference: {
      question: "Your ideal study session involves:",
      options: [
        { value: "solo_deep", label: "Solo deep-dive into material" },
        { value: "group_study", label: "Group study sessions" },
        { value: "mixed_activities", label: "Mixed activities and breaks" },
        { value: "project_based", label: "Project-based learning" }
      ]
    },
    challengeResponse: {
      question: "When you encounter a challenging topic:",
      options: [
        { value: "systematic", label: "Take a systematic, methodical approach" },
        { value: "creative", label: "Find creative ways to understand it" },
        { value: "seek_help", label: "Seek help and guidance" },
        { value: "persistent", label: "Keep trying until breakthrough" }
      ]
    },
    informationProcessing: {
      question: "You process information best through:",
      options: [
        { value: "logic", label: "Logical analysis" },
        { value: "patterns", label: "Pattern recognition" },
        { value: "emotion", label: "Emotional connection" },
        { value: "action", label: "Action and movement" }
      ]
    },
    groupWork: {
      question: "In group projects, you naturally:",
      options: [
        { value: "organize", label: "Organize and structure the work" },
        { value: "generate_ideas", label: "Generate creative ideas" },
        { value: "facilitate", label: "Facilitate communication" },
        { value: "execute", label: "Execute and complete tasks" }
      ]
    },
    timeManagement: {
      question: "Your approach to deadlines is:",
      options: [
        { value: "plan_ahead", label: "Plan well ahead with schedule" },
        { value: "flexible", label: "Flexible, adapt as needed" },
        { value: "steady_pace", label: "Steady consistent pace" },
        { value: "intense_bursts", label: "Intense focused bursts" }
      ]
    },
    creativity: {
      question: "When learning, you value:",
      options: [
        { value: "accuracy", label: "Accuracy and precision" },
        { value: "innovation", label: "Innovation and new ideas" },
        { value: "understanding", label: "Deep understanding" },
        { value: "application", label: "Practical application" }
      ]
    },
    feedback: {
      question: "You prefer feedback that is:",
      options: [
        { value: "detailed", label: "Detailed and analytical" },
        { value: "encouraging", label: "Encouraging and positive" },
        { value: "constructive", label: "Constructive and actionable" },
        { value: "direct", label: "Direct and to the point" }
      ]
    }
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
          difficultyLevel: data.difficultyLevel || 'intermediate',
          learningPace: data.learningPace || 'moderate',
          primaryArchetype: data.primaryArchetype || '',
          secondaryArchetype: data.secondaryArchetype || '',
          archetypeDescription: data.archetypeDescription || '',
          preferredSubjects: data.preferredSubjects || [],
          quizResponses: data.quizResponses || {
            learningEnvironment: '',
            problemSolving: '',
            newConcepts: '',
            studyPreference: '',
            challengeResponse: '',
            informationProcessing: '',
            groupWork: '',
            timeManagement: '',
            creativity: '',
            feedback: ''
          }
        });
        
        setDataLoaded(true);
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        console.error('Failed to load profile');
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

  const handleQuizResponseChange = (question, value) => {
    setProfileData(prev => ({
      ...prev,
      quizResponses: {
        ...prev.quizResponses,
        [question]: value
      }
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
        difficultyLevel: profileData.difficultyLevel || 'intermediate',
        learningPace: profileData.learningPace || 'moderate',
        preferredSubjects: profileData.preferredSubjects || [],
        quizResponses: profileData.quizResponses || {}
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
          <div style={{ textAlign: 'center', padding: '50px', color: '#D7B38C' }}>
            <div className="typing-indicator" style={{ display: 'inline-flex', gap: '8px', marginBottom: '20px' }}>
              <span style={{ width: '12px', height: '12px', background: '#D7B38C', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite' }}></span>
              <span style={{ width: '12px', height: '12px', background: '#D7B38C', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out 0.2s infinite' }}></span>
              <span style={{ width: '12px', height: '12px', background: '#D7B38C', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }}></span>
            </div>
            <div>Loading your profile...</div>
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
            <p className="section-subtitle" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Take our quick assessment to unlock personalized AI tutoring tailored to your unique learning style
            </p>
            <div className="archetype-actions">
              <button className="retake-quiz-btn" onClick={retakeQuiz}>
                Take Learning Archetype Quiz
              </button>
            </div>
          </div>
        )}

        <div className="profile-grid">
          <div className="profile-section essential">
            <h3 className="section-title">Basic Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required-field">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Enter your first name"
                />
              </div>
              <div className="form-group">
                <label className="form-label required-field">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required-field">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={profileData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="your.email@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label required-field">Field of Study</label>
              <select
                className="form-select"
                value={profileData.fieldOfStudy}
                onChange={(e) => handleInputChange('fieldOfStudy', e.target.value)}
              >
                <option value="">Select your field</option>
                {fieldsOfStudy.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="profile-section">
            <h3 className="section-title">Learning Preferences</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Difficulty Level</label>
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
              <div className="form-group">
                <label className="form-label">Learning Pace</label>
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

        <div className="profile-section">
          <h3 className="section-title">Preferred Subjects</h3>
          <p className="section-subtitle">Select subjects you're interested in learning</p>
          
          <div className="checkbox-grid">
            {allSubjects.map(subject => (
              <div
                key={subject}
                className={`checkbox-item ${profileData.preferredSubjects.includes(subject) ? 'selected' : ''}`}
                onClick={() => toggleSubject(subject)}
              >
                <input
                  type="checkbox"
                  checked={profileData.preferredSubjects.includes(subject)}
                  onChange={() => {}}
                />
                <span>{subject}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h3 className="section-title">Learning Style Preferences</h3>
          <p className="section-subtitle">Customize how the AI adapts to your learning style</p>
          
          {Object.entries(quizQuestions).map(([key, question]) => (
            <div key={key} className="form-group">
              <label className="form-label">{question.question}</label>
              <select
                className="form-select"
                value={profileData.quizResponses[key] || ''}
                onChange={(e) => handleQuizResponseChange(key, e.target.value)}
              >
                <option value="">Select your preference</option>
                {question.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default Profile;