import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileQuiz.css';
import { API_URL } from '../config';

const ProfileQuiz = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('welcome');
  const [subjectInput, setSubjectInput] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestedSubjects, setSuggestedSubjects] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [answers, setAnswers] = useState({
    isCollegeStudent: null,
    collegeLevel: '',
    subjects: [],
    mainSubject: '',
    brainwaveGoal: '',
    archetypeAnswers: {},
    archetypeScores: {
      Logicor: 0,
      Flowist: 0,
      Kinetiq: 0,
      Synth: 0,
      Dreamweaver: 0,
      Anchor: 0,
      Spark: 0,
      Empathion: 0,
      Seeker: 0,
      Resonant: 0
    }
  });
  const [userName, setUserName] = useState('');

  const inspirationalQuotes = [
    "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.",
    "Education is not the filling of a pail, but the lighting of a fire.",
    "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    "The beautiful thing about learning is that no one can take it away from you.",
    "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence."
  ];

  const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];

  const collegeLevels = [
    'Freshman (1st year)',
    'Sophomore (2nd year)',
    'Junior (3rd year)',
    'Senior (4th year)',
    'Graduate Student',
    'Not a college student'
  ];

  const brainwaveGoals = [
    { value: 'exam_prep', label: 'Ace my exams' },
    { value: 'homework_help', label: 'Get homework help' },
    { value: 'concept_mastery', label: 'Master difficult concepts' },
    { value: 'skill_building', label: 'Build new skills' },
    { value: 'career_prep', label: 'Prepare for my career' },
    { value: 'curiosity', label: 'Learn out of curiosity' }
  ];

  const archetypeQuestions = [
    {
      id: 1,
      question: "When you're studying for a big exam, which approach do you naturally lean toward?",
      options: [
        { text: "Create detailed outlines and break down concepts systematically", archetypes: { Logicor: 3, Anchor: 2 } },
        { text: "Jump between topics based on what feels interesting in the moment", archetypes: { Flowist: 3, Spark: 2 } },
        { text: "Walk around, use flashcards, or explain concepts out loud", archetypes: { Kinetiq: 3, Flowist: 1 } },
        { text: "Draw diagrams and mind maps connecting different ideas", archetypes: { Synth: 3, Dreamweaver: 2 } }
      ]
    },
    {
      id: 2,
      question: "Your professor assigns a group project. What role do you typically take?",
      options: [
        { text: "The organizer who creates timelines and keeps everyone on track", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "The idea generator who brings creative solutions to problems", archetypes: { Spark: 3, Dreamweaver: 2 } },
        { text: "The connector who makes sure everyone's ideas work together", archetypes: { Synth: 3, Empathion: 2 } },
        { text: "The adapter who fills gaps and handles whatever needs doing", archetypes: { Flowist: 3, Resonant: 2 } }
      ]
    },
    {
      id: 3,
      question: "When learning a new concept in class, you understand it best when:",
      options: [
        { text: "The professor shows the logical steps and formulas", archetypes: { Logicor: 3, Anchor: 1 } },
        { text: "You can physically work through examples or build something", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "You can see how it connects to real-world applications", archetypes: { Synth: 3, Seeker: 2 } },
        { text: "You grasp the overall vision and future implications", archetypes: { Dreamweaver: 3, Spark: 1 } }
      ]
    },
    {
      id: 4,
      question: "How would you describe your dorm room or study space?",
      options: [
        { text: "Very organized with everything labeled and in its place", archetypes: { Anchor: 3 } },
        { text: "Organized chaos - looks messy but you know where everything is", archetypes: { Spark: 2, Flowist: 2 } },
        { text: "Decorated with inspiration boards, quotes, and creative displays", archetypes: { Dreamweaver: 3, Spark: 1 } },
        { text: "Constantly rearranged based on your current projects or mood", archetypes: { Flowist: 3, Resonant: 2 } }
      ]
    },
    {
      id: 5,
      question: "When you hit a roadblock on an assignment, your first instinct is to:",
      options: [
        { text: "Break down the problem into smaller, manageable pieces", archetypes: { Logicor: 3, Anchor: 1 } },
        { text: "Try different approaches until something clicks", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "Step back and look for patterns or connections you missed", archetypes: { Synth: 3, Seeker: 1 } },
        { text: "Brainstorm wildly different solutions or alternatives", archetypes: { Spark: 3, Dreamweaver: 2 } }
      ]
    },
    {
      id: 6,
      question: "What motivates you most during a tough semester?",
      options: [
        { text: "Seeing clear progress toward your degree requirements", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Learning fascinating new topics that spark your curiosity", archetypes: { Seeker: 3, Spark: 2 } },
        { text: "Feeling like your work has meaning and helps others", archetypes: { Empathion: 3, Synth: 1 } },
        { text: "Achieving mastery and proving you can handle challenges", archetypes: { Logicor: 3, Kinetiq: 2 } }
      ]
    },
    {
      id: 7,
      question: "In a lecture hall, you're most likely to:",
      options: [
        { text: "Take detailed linear notes following the professor's structure", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Sketch diagrams, use colors, and add visual elements", archetypes: { Dreamweaver: 3, Spark: 2 } },
        { text: "Jot down key ideas and make connections to other classes", archetypes: { Synth: 3, Seeker: 1 } },
        { text: "Record or photograph slides to review while moving around later", archetypes: { Kinetiq: 3, Flowist: 2 } }
      ]
    },
    {
      id: 8,
      question: "When choosing electives, you prefer classes that:",
      options: [
        { text: "Build directly on your major with clear career applications", archetypes: { Anchor: 3, Logicor: 1 } },
        { text: "Explore totally different fields and expand your thinking", archetypes: { Seeker: 3, Spark: 2 } },
        { text: "Involve hands-on projects or practical skill-building", archetypes: { Kinetiq: 3, Flowist: 1 } },
        { text: "Connect multiple disciplines in innovative ways", archetypes: { Synth: 3, Dreamweaver: 2 } }
      ]
    },
    {
      id: 9,
      question: "When stressed about deadlines, you cope by:",
      options: [
        { text: "Making detailed to-do lists and checking off tasks", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Taking breaks to exercise, walk, or do something physical", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "Talking it through with friends or writing in a journal", archetypes: { Empathion: 3, Spark: 1 } },
        { text: "Adjusting your approach and being flexible with plans", archetypes: { Resonant: 3, Flowist: 2 } }
      ]
    },
    {
      id: 10,
      question: "Which study environment helps you focus best?",
      options: [
        { text: "Quiet library with minimal distractions", archetypes: { Anchor: 2, Logicor: 2 } },
        { text: "Coffee shop with background noise and movement", archetypes: { Flowist: 3, Kinetiq: 1 } },
        { text: "Nature or outdoor spaces with fresh air", archetypes: { Kinetiq: 2, Resonant: 2 } },
        { text: "Creative spaces with inspiring visuals and atmosphere", archetypes: { Spark: 3, Dreamweaver: 2 } }
      ]
    }
  ];

  const archetypeDescriptions = {
    Logicor: "You excel at breaking down complex problems into logical steps and systematic approaches. Your analytical mind naturally identifies patterns and structures, making you particularly effective at subjects requiring methodical thinking and clear reasoning.",
    Flowist: "You thrive in dynamic learning environments where you can adapt and explore freely. Your flexible approach allows you to connect ideas across different contexts naturally, making learning feel intuitive rather than forced.",
    Kinetiq: "You learn best through hands-on experience and physical engagement. Movement and tactile interaction help you process information deeply, turning abstract concepts into tangible understanding through active practice.",
    Synth: "You possess a remarkable ability to see connections between seemingly unrelated ideas. Your holistic thinking allows you to integrate knowledge from various domains, creating innovative solutions and comprehensive understanding.",
    Dreamweaver: "You think in possibilities and future scenarios, naturally envisioning the bigger picture. Your visionary perspective helps you understand not just what is, but what could be, making you excellent at strategic and creative thinking.",
    Anchor: "You value structure, consistency, and systematic organization in your learning. Your disciplined approach and attention to detail create a solid foundation for building comprehensive knowledge over time.",
    Spark: "You're driven by creativity and innovative thinking, constantly generating new ideas and perspectives. Your enthusiastic approach to learning brings fresh energy to every subject you explore.",
    Empathion: "You connect deeply with the human and emotional dimensions of learning. Your ability to understand context and meaning helps you grasp not just the facts, but the significance behind them.",
    Seeker: "You're motivated by curiosity and the joy of discovery. Your natural inclination to ask questions and explore unknowns drives you to delve deep into subjects that capture your interest.",
    Resonant: "You're highly adaptable and attuned to different learning situations. Your flexibility allows you to adjust your approach based on context, making you effective across various subjects and environments."
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
      checkQuizStatus(username, token);
    }
  }, [navigate]);

  const checkQuizStatus = async (username, token) => {
    try {
      const response = await fetch(`${API_URL}/get_user_profile?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.quiz_completed || data.quiz_skipped) {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Error checking quiz status:', error);
    }
  };

  const generateSubjectSuggestions = async (input) => {
    if (!input || input.length < 2) {
      setSuggestedSubjects([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    
    try {
      const response = await fetch(`${API_URL}/api/suggest_subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          input, 
          college_level: answers.collegeLevel 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedSubjects(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
      setSuggestedSubjects([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSubjectInputChange = (e) => {
    const value = e.target.value;
    setSubjectInput(value);
    generateSubjectSuggestions(value);
  };

  const addSubject = (subject) => {
    if (!answers.subjects.includes(subject)) {
      setAnswers(prev => ({
        ...prev,
        subjects: [...prev.subjects, subject]
      }));
    }
    setSubjectInput('');
    setSuggestedSubjects([]);
    setShowSuggestions(false);
  };

  const removeSubject = (subject) => {
    setAnswers(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== subject)
    }));
  };

  const handleArchetypeSelect = (optionIndex) => {
    setSelectedAnswer(optionIndex);
  };

  const handleArchetypeNext = () => {
    if (selectedAnswer === null) return;

    const selectedOption = archetypeQuestions[currentQuestion].options[selectedAnswer];
    const newArchetypeAnswers = { ...answers.archetypeAnswers, [currentQuestion]: selectedAnswer };
    const newScores = { ...answers.archetypeScores };
    
    Object.entries(selectedOption.archetypes).forEach(([archetype, points]) => {
      newScores[archetype] = (newScores[archetype] || 0) + points;
    });

    setAnswers(prev => ({
      ...prev,
      archetypeAnswers: newArchetypeAnswers,
      archetypeScores: newScores
    }));

    if (currentQuestion < archetypeQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      completeQuiz(newScores);
    }
  };

  const handleArchetypeBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(answers.archetypeAnswers[currentQuestion - 1] ?? null);
    }
  };

  const completeQuiz = async (scores) => {
    const sortedArchetypes = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([archetype]) => archetype);

    const primaryArchetype = sortedArchetypes[0];
    const secondaryArchetype = sortedArchetypes[1];

    try {
      const token = localStorage.getItem('token');
      
      await fetch(`${API_URL}/save_complete_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          is_college_student: answers.isCollegeStudent,
          college_level: answers.collegeLevel,
          preferred_subjects: answers.subjects,
          main_subject: answers.mainSubject,
          brainwave_goal: answers.brainwaveGoal,
          primary_archetype: primaryArchetype,
          secondary_archetype: secondaryArchetype,
          archetype_scores: scores,
          archetype_description: archetypeDescriptions[primaryArchetype],
          quiz_completed: true,
          quiz_responses: answers.archetypeAnswers
        })
      });

      setCurrentStep('complete');
      setTimeout(() => {
        navigate('/dashboard');
      }, 5000);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleSkip = () => {
    setShowSkipWarning(true);
  };

  const confirmSkip = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await fetch(`${API_URL}/save_complete_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          is_college_student: answers.isCollegeStudent,
          college_level: answers.collegeLevel,
          preferred_subjects: answers.subjects,
          main_subject: answers.mainSubject,
          brainwave_goal: answers.brainwaveGoal,
          quiz_completed: false,
          quiz_skipped: true
        })
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
      navigate('/dashboard');
    }
  };

  const cancelSkip = () => {
    setShowSkipWarning(false);
  };

  const isFormValid = () => {
    return answers.isCollegeStudent !== null && 
           answers.collegeLevel && 
           answers.subjects.length > 0 && 
           answers.mainSubject && 
           answers.brainwaveGoal;
  };

  if (currentStep === 'welcome') {
    return (
      <div className="profile-quiz-page">
        <div className="bento-grid">
          <div className="bento-box bento-welcome">
            <h1 className="bento-welcome-title">welcome to cerbyl</h1>
          </div>

          <div className="bento-box bento-quote">
            <p className="bento-quote-text">{randomQuote}</p>
          </div>

          <div className="bento-box bento-cta" onClick={() => setCurrentStep('form')}>
            <div className="bento-cta-content">
              <span className="bento-cta-icon">→</span>
              <span className="bento-cta-text">take quiz</span>
            </div>
          </div>

          <div className="bento-box bento-description">
            <h3 className="bento-desc-title">your personalized ai tutor</h3>
            <p className="bento-desc-text">
              Cerbyl adapts to your unique learning style, helping you master any subject with personalized guidance and support.
            </p>
          </div>

          <div className="bento-box bento-blank bento-accent-1"></div>
          <div className="bento-box bento-blank bento-accent-2"></div>
          <div className="bento-box bento-blank bento-accent-3"></div>
        </div>
      </div>
    );
  }

  if (currentStep === 'archetype') {
    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="quiz-header">
            <h1 className="quiz-title">discover your learning archetype</h1>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${80 + (currentQuestion / archetypeQuestions.length) * 20}%` }}></div>
            </div>
            <p className="quiz-progress-text">
              Question {currentQuestion + 1} of {archetypeQuestions.length}
            </p>
          </div>

          <div className="quiz-content">
            <div className="question-card">
              <h2 className="question-text">{archetypeQuestions[currentQuestion].question}</h2>
              
              <div className="options-grid">
                {archetypeQuestions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                    onClick={() => handleArchetypeSelect(index)}
                  >
                    <span className="option-number">{String.fromCharCode(65 + index)}</span>
                    <span className="option-text">{option.text}</span>
                  </button>
                ))}
              </div>

              <div className="navigation-buttons">
                <button 
                  className="back-btn" 
                  onClick={handleArchetypeBack}
                  disabled={currentQuestion === 0}
                >
                  ← Back
                </button>
                <button 
                  className="continue-btn" 
                  onClick={handleArchetypeNext}
                  disabled={selectedAnswer === null}
                >
                  {currentQuestion === archetypeQuestions.length - 1 ? 'Complete' : 'Continue'}
                </button>
              </div>

              <button className="skip-quiz-btn" onClick={handleSkip}>
                Skip Learning Style Assessment
              </button>
            </div>
          </div>
        </div>

        {showSkipWarning && (
          <div className="skip-warning-overlay">
            <div className="skip-warning-modal">
              <h3>are you sure you want to skip?</h3>
              <p>
                The Learning Archetype Assessment helps us personalize your AI tutor to match your unique learning style. 
                This significantly enhances your learning experience and makes study sessions more effective.
              </p>
              <p className="warning-emphasis">
                We highly recommend completing this short assessment for the best experience.
              </p>
              <div className="warning-actions">
                <button className="continue-assessment-btn" onClick={cancelSkip}>
                  Continue Assessment
                </button>
                <button className="confirm-skip-btn" onClick={confirmSkip}>
                  Skip Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentStep === 'complete') {
    const primaryArchetype = Object.entries(answers.archetypeScores)
      .sort(([, a], [, b]) => b - a)[0][0];

    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="quiz-completion">
            <p className="completion-header">you are a</p>
            
            <h1 className="archetype-name">{primaryArchetype}</h1>
            
            <p className="archetype-description">
              {archetypeDescriptions[primaryArchetype]}
            </p>

            <p className="completion-message">
              Your AI tutor is now personalized to match your unique learning style
            </p>
            <p className="redirect-message">Redirecting to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-quiz-page">
      <div className="quiz-container">
        <div className="quiz-header-single">
          <h1 className="quiz-title-single">tell us about yourself</h1>
          <p className="quiz-subtitle-single">help us personalize your learning experience</p>
        </div>

        <div className="quiz-form">
          <div className="form-section">
            <label className="form-label">are you a college student?</label>
            <div className="button-group-horizontal">
              <button
                className={`choice-btn ${answers.isCollegeStudent === true ? 'selected' : ''}`}
                onClick={() => setAnswers(prev => ({ ...prev, isCollegeStudent: true }))}
              >
                Yes
              </button>
              <button
                className={`choice-btn ${answers.isCollegeStudent === false ? 'selected' : ''}`}
                onClick={() => setAnswers(prev => ({ ...prev, isCollegeStudent: false }))}
              >
                No
              </button>
            </div>
          </div>

          {answers.isCollegeStudent !== null && (
            <div className="form-section">
              <label className="form-label">
                {answers.isCollegeStudent ? 'what level are you at?' : 'what best describes you?'}
              </label>
              <div className="button-group-vertical">
                {collegeLevels.map((level) => (
                  <button
                    key={level}
                    className={`choice-btn-vertical ${answers.collegeLevel === level ? 'selected' : ''}`}
                    onClick={() => setAnswers(prev => ({ ...prev, collegeLevel: level }))}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answers.collegeLevel && (
            <div className="form-section">
              <label className="form-label">what subjects do you need help with?</label>
              <p className="form-hint">type to search or add custom subjects</p>
              
              <div className="subject-input-container">
                <input
                  type="text"
                  className="subject-input"
                  placeholder="e.g., Calculus, Organic Chemistry, Data Structures..."
                  value={subjectInput}
                  onChange={handleSubjectInputChange}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && subjectInput.trim()) {
                      addSubject(subjectInput.trim());
                    }
                  }}
                  onFocus={() => {
                    if (subjectInput.length >= 2) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                />
                {isLoadingSuggestions && <div className="loading-spinner"></div>}

                {showSuggestions && suggestedSubjects.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestedSubjects.map((subject, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onClick={() => addSubject(subject)}
                      >
                        {subject}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {answers.subjects.length > 0 && (
                <div className="selected-subjects">
                  {answers.subjects.map((subject, idx) => (
                    <div key={idx} className="subject-tag">
                      {subject}
                      <button
                        className="remove-subject"
                        onClick={() => removeSubject(subject)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {answers.subjects.length > 0 && (
            <div className="form-section">
              <label className="form-label">which subject is your main focus?</label>
              <div className="button-group-vertical">
                {answers.subjects.map((subject) => (
                  <button
                    key={subject}
                    className={`choice-btn-vertical ${answers.mainSubject === subject ? 'selected' : ''}`}
                    onClick={() => setAnswers(prev => ({ ...prev, mainSubject: subject }))}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answers.mainSubject && (
            <div className="form-section">
              <label className="form-label">what's your main goal?</label>
              <div className="button-group-vertical">
                {brainwaveGoals.map((goal) => (
                  <button
                    key={goal.value}
                    className={`choice-btn-vertical ${answers.brainwaveGoal === goal.value ? 'selected' : ''}`}
                    onClick={() => setAnswers(prev => ({ ...prev, brainwaveGoal: goal.value }))}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isFormValid() && (
            <div className="form-section">
              <button
                className="submit-btn"
                onClick={() => setCurrentStep('archetype')}
              >
                continue to learning style
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileQuiz;