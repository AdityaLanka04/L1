import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileQuiz.css';
import { API_URL } from '../config';

const ProfileQuiz = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('welcome');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState({
    preferredSubjects: [],
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
    "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice. - Brian Herbert",
    "Education is not the filling of a pail, but the lighting of a fire. - William Butler Yeats",
    "Live as if you were to die tomorrow. Learn as if you were to live forever. - Mahatma Gandhi",
    "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
    "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence. - Abigail Adams"
  ];

  const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];

  const allSubjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'Geography', 'Literature', 'Languages', 'Art',
    'Music', 'Economics', 'Business', 'Psychology', 'Philosophy',
    'Engineering', 'Medicine', 'Law', 'Political Science', 'Sociology'
  ];

  const brainwaveGoals = [
    { value: 'exam_prep', label: 'Prepare for exams and tests' },
    { value: 'homework_help', label: 'Get help with homework and assignments' },
    { value: 'concept_mastery', label: 'Master difficult concepts' },
    { value: 'skill_building', label: 'Build new skills and knowledge' },
    { value: 'career_prep', label: 'Prepare for career and professional growth' },
    { value: 'curiosity', label: 'Learn out of curiosity and interest' }
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
        // If quiz was completed or skipped, redirect to dashboard
        if (data.quiz_completed || data.quiz_skipped) {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Error checking quiz status:', error);
    }
  };

  const handleSubjectToggle = (subject) => {
    setAnswers(prev => ({
      ...prev,
      preferredSubjects: prev.preferredSubjects.includes(subject)
        ? prev.preferredSubjects.filter(s => s !== subject)
        : [...prev.preferredSubjects, subject]
    }));
  };

  const handleMainSubjectSelect = (subject) => {
    setAnswers(prev => ({ ...prev, mainSubject: subject }));
  };

  const handleGoalSelect = (goal) => {
    setAnswers(prev => ({ ...prev, brainwaveGoal: goal }));
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
          preferred_subjects: answers.preferredSubjects,
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
          preferred_subjects: answers.preferredSubjects,
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

  const progressSteps = {
    'welcome': 0,
    'subjects': 20,
    'mainSubject': 40,
    'goal': 60,
    'archetype': 80 + (currentQuestion / archetypeQuestions.length) * 20,
    'complete': 100
  };

  const progress = progressSteps[currentStep] || 0;

  if (currentStep === 'welcome') {
    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="welcome-screen">
            <h1 className="welcome-title">welcome to cerbyl</h1>
            
            <p className="welcome-message">
              Let's personalize your learning experience. This quick assessment will help us understand your goals and learning style.
            </p>

            <div className="welcome-bottom">
              <p className="quote-text">{randomQuote}</p>
              <button className="start-quiz-btn" onClick={() => setCurrentStep('subjects')}>
                Begin Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'subjects') {
    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="quiz-header">
            <h1 className="quiz-title">Select Your Interests</h1>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="quiz-progress-text">Step 1 of 4</p>
          </div>

          <div className="quiz-content">
            <h2 className="question-text">Which subjects are you interested in learning?</h2>
            <p className="question-subtitle">Select all that apply</p>
            
            <div className="subject-grid">
              {allSubjects.map(subject => (
                <div
                  key={subject}
                  className={`subject-card ${answers.preferredSubjects.includes(subject) ? 'selected' : ''}`}
                  onClick={() => handleSubjectToggle(subject)}
                >
                  {subject}
                </div>
              ))}
            </div>

            <button 
              className="continue-btn" 
              onClick={() => setCurrentStep('mainSubject')}
              disabled={answers.preferredSubjects.length === 0}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'mainSubject') {
    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="quiz-header">
            <h1 className="quiz-title">Your Main Focus</h1>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="quiz-progress-text">Step 2 of 4</p>
          </div>

          <div className="quiz-content">
            <h2 className="question-text">What's your primary subject or field of study?</h2>
            
            <div className="options-grid">
              {allSubjects.map((subject, index) => (
                <button
                  key={subject}
                  className={`option-button ${answers.mainSubject === subject ? 'selected' : ''}`}
                  onClick={() => handleMainSubjectSelect(subject)}
                >
                  <span className="option-number">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{subject}</span>
                </button>
              ))}
            </div>

            <div className="navigation-buttons">
              <button className="back-btn" onClick={() => setCurrentStep('subjects')}>
                ◄ Back
              </button>
              <button 
                className="continue-btn" 
                onClick={() => setCurrentStep('goal')}
                disabled={!answers.mainSubject}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'goal') {
    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="quiz-header">
            <h1 className="quiz-title">Your Learning Goal</h1>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="quiz-progress-text">Step 3 of 4</p>
          </div>

          <div className="quiz-content">
            <h2 className="question-text">What's your main goal with Cerbyl?</h2>
            
            <div className="options-grid">
              {brainwaveGoals.map((goal, index) => (
                <button
                  key={goal.value}
                  className={`option-button ${answers.brainwaveGoal === goal.value ? 'selected' : ''}`}
                  onClick={() => handleGoalSelect(goal.value)}
                >
                  <span className="option-number">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{goal.label}</span>
                </button>
              ))}
            </div>

            <div className="navigation-buttons">
              <button className="back-btn" onClick={() => setCurrentStep('mainSubject')}>
                Back
              </button>
              <button 
                className="continue-btn" 
                onClick={() => setCurrentStep('archetype')}
                disabled={!answers.brainwaveGoal}
              >
                Continue to Learning Style Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'archetype') {
    return (
      <div className="profile-quiz-page">
        <div className="quiz-container">
          <div className="quiz-header">
            <h1 className="quiz-title">Discover Your Learning Archetype</h1>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }}></div>
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
                  Back
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
              <h3>Are you sure you want to skip?</h3>
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
            <p className="completion-header">You are a</p>
            
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

  return null;
};

export default ProfileQuiz;