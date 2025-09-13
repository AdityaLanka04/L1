import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './profile.css';

const Profile = () => {
  const [userName, setUserName] = useState('');
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    age: '',
    fieldOfStudy: '',
    learningStyle: '',
    difficultyLevel: 'intermediate',
    learningPace: 'moderate',
    preferredSubjects: [],
    timeZone: '',
    preferredSessionLength: '',
    bestStudyTimes: []
  });
  
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [saveTimer, setSaveTimer] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const navigate = useNavigate();

  const fieldsOfStudy = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Engineering', 'Medicine', 'Business', 'Economics', 'Psychology',
    'Literature', 'History', 'Philosophy', 'Art', 'Languages'
  ];

  const learningStyles = [
    'Visual', 'Auditory', 'Kinesthetic', 'Reading/Writing', 'Mixed'
  ];

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'Geography', 'Literature', 'Psychology', 'Economics',
    'Business', 'Art', 'Languages', 'Engineering'
  ];

  const timeZones = [
    { value: 'EST', label: 'Eastern (EST)' },
    { value: 'CST', label: 'Central (CST)' },
    { value: 'MST', label: 'Mountain (MST)' },
    { value: 'PST', label: 'Pacific (PST)' },
    { value: 'GMT', label: 'Greenwich (GMT)' },
    { value: 'CET', label: 'Central European (CET)' }
  ];

  const sessionLengths = [
    '15 minutes', '30 minutes', '45 minutes', '1 hour', '1.5 hours', '2 hours'
  ];

  const studyTimes = [
    'Early Morning', 'Morning', 'Afternoon', 'Evening', 'Night'
  ];

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
    if (dataLoaded) {
      calculateProfileCompletion();
      
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      
      const newTimer = setTimeout(() => {
        if (userName && (profileData.firstName || profileData.lastName || profileData.email)) {
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
        
        setProfileData(prev => ({
          ...prev,
          ...data,
          preferredSubjects: Array.isArray(data.preferredSubjects) ? data.preferredSubjects : [],
          bestStudyTimes: Array.isArray(data.bestStudyTimes) ? data.bestStudyTimes : []
        }));
        
        setDataLoaded(true);
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        console.error('Failed to load profile:', response.statusText);
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setDataLoaded(true);
    }
  };

  const calculateProfileCompletion = () => {
    const essentialFields = [
      'firstName', 'lastName', 'email', 'fieldOfStudy', 'learningStyle'
    ];
    
    const additionalFields = [
      'age', 'difficultyLevel', 'learningPace', 'timeZone', 'preferredSessionLength'
    ];
    
    const arrayFields = [
      'preferredSubjects', 'bestStudyTimes'
    ];
    
    let completed = 0;
    const totalWeight = essentialFields.length * 2 + additionalFields.length + arrayFields.length;
    
    essentialFields.forEach(field => {
      if (profileData[field] && profileData[field].toString().trim() !== '') {
        completed += 2;
      }
    });
    
    additionalFields.forEach(field => {
      if (profileData[field] && profileData[field].toString().trim() !== '') {
        completed += 1;
      }
    });
    
    arrayFields.forEach(field => {
      if (profileData[field] && Array.isArray(profileData[field]) && profileData[field].length > 0) {
        completed += 1;
      }
    });
    
    const percentage = Math.min(100, Math.round((completed / totalWeight) * 100));
    setProfileCompletion(percentage);
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayToggle = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
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
        age: profileData.age || null,
        fieldOfStudy: profileData.fieldOfStudy || '',
        learningStyle: profileData.learningStyle || '',
        preferredSubjects: profileData.preferredSubjects || [],
        difficultyLevel: profileData.difficultyLevel || 'intermediate',
        learningPace: profileData.learningPace || 'moderate',
        timeZone: profileData.timeZone || '',
        preferredSessionLength: profileData.preferredSessionLength || '',
        bestStudyTimes: profileData.bestStudyTimes || []
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
        
        localStorage.setItem('userProfile', JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          fieldOfStudy: profileData.fieldOfStudy,
          learningStyle: profileData.learningStyle,
          difficultyLevel: profileData.difficultyLevel,
          learningPace: profileData.learningPace
        }));
      }
    } catch (error) {
      console.error('Error auto-saving profile:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleManualSave = async () => {
    setLoading(true);
    try {
      await autoSaveProfile();
      alert('Profile saved successfully!');
    } catch (error) {
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigate('/dashboard');
  };

  const getProfileStatus = () => {
    if (profileCompletion < 30) {
      return { status: 'Getting Started', color: '#ff9800', message: 'Complete your basic information to get personalized AI responses' };
    } else if (profileCompletion < 70) {
      return { status: 'In Progress', color: '#D7B38C', message: 'Great progress! Add more details for better personalization' };
    } else {
      return { status: 'Complete', color: '#4caf50', message: 'Excellent! Your profile enables full AI personalization' };
    }
  };

  const profileStatus = getProfileStatus();

  if (!dataLoaded) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div style={{ textAlign: 'center', padding: '50px', color: '#D7B38C' }}>
            Loading your profile...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-progress">
        <div 
          className="progress-bar" 
          style={{ width: `${profileCompletion}%`, backgroundColor: profileStatus.color }}
        ></div>
      </div>

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

        <div className="profile-status">
          <div className="status-indicator" style={{ backgroundColor: profileStatus.color }}>
            {profileCompletion}% Complete - {profileStatus.status}
          </div>
          <div className="status-message">{profileStatus.message}</div>
        </div>

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

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Age</label>
                <input
                  type="number"
                  className="form-input"
                  value={profileData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  placeholder="Your age"
                  min="13"
                  max="100"
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

            <div className="form-group">
              <label className="form-label required-field">Learning Style</label>
              <select
                className="form-select"
                value={profileData.learningStyle}
                onChange={(e) => handleInputChange('learningStyle', e.target.value)}
              >
                <option value="">Select your style</option>
                {learningStyles.map(style => (
                  <option key={style} value={style}>{style}</option>
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

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Session Length</label>
                <select
                  className="form-select"
                  value={profileData.preferredSessionLength}
                  onChange={(e) => handleInputChange('preferredSessionLength', e.target.value)}
                >
                  <option value="">Select session length</option>
                  {sessionLengths.map(length => (
                    <option key={length} value={length}>{length}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Time Zone</label>
                <select
                  className="form-select"
                  value={profileData.timeZone}
                  onChange={(e) => handleInputChange('timeZone', e.target.value)}
                >
                  <option value="">Select timezone</option>
                  {timeZones.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-section">
            <h3 className="section-title">Preferred Subjects</h3>
            <div className="checkbox-grid">
              {subjects.map(subject => (
                <label 
                  key={subject} 
                  className={`checkbox-item ${profileData.preferredSubjects.includes(subject) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={profileData.preferredSubjects.includes(subject)}
                    onChange={() => handleArrayToggle('preferredSubjects', subject)}
                  />
                  <span>{subject}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="profile-section">
            <h3 className="section-title">Best Study Times</h3>
            <div className="checkbox-grid">
              {studyTimes.map(time => (
                <label 
                  key={time} 
                  className={`checkbox-item ${profileData.bestStudyTimes.includes(time) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={profileData.bestStudyTimes.includes(time)}
                    onChange={() => handleArrayToggle('bestStudyTimes', time)}
                  />
                  <span>{time}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="save-section">
          <div className="save-status">
            <div className="auto-save-info">
              <div className="auto-save-icon">AUTO</div>
              <div className="auto-save-text">
                <div className="auto-save-title">Auto-save Enabled</div>
                <div className="auto-save-subtitle">Changes saved automatically</div>
              </div>
            </div>
            
            {lastSaved && (
              <div className="last-saved-info">
                Last saved at {lastSaved}
              </div>
            )}
          </div>

          <button
            className={`manual-save-btn ${loading ? 'loading' : ''}`}
            onClick={handleManualSave}
            disabled={loading || autoSaving}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;