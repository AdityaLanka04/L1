import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileQuiz.css';
import { API_URL } from '../config';

const ProfileQuiz = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('welcome');
  const [subjectInput, setSubjectInput] = useState('');
  const [mainSubjectSuggestions, setMainSubjectSuggestions] = useState([]);
  const [showMainSuggestions, setShowMainSuggestions] = useState(false);
  const [otherSubjectSuggestions, setOtherSubjectSuggestions] = useState([]);
  const [showOtherSuggestions, setShowOtherSuggestions] = useState(false);
  
  const mainSubjectRef = useRef(null);
  const otherSubjectsRef = useRef(null);
  const goalRef = useRef(null);
  const submitRef = useRef(null);
  const prevMainSubjectRef = useRef('');
  
  const scrollToRef = (ref) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const commonSubjects = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Engineering', 'Business Administration', 'Economics', 'Psychology', 'Sociology',
    'English Literature', 'History', 'Political Science', 'Philosophy', 'Art History',
    'Music', 'Theater', 'Communications', 'Journalism', 'Marketing',
    'Accounting', 'Finance', 'Statistics', 'Data Science', 'Information Technology',
    'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering',
    'Biochemistry', 'Molecular Biology', 'Genetics', 'Neuroscience', 'Medicine',
    'Nursing', 'Public Health', 'Environmental Science', 'Geography', 'Anthropology',
    'Architecture', 'Graphic Design', 'Film Studies', 'Creative Writing', 'Linguistics',
    'Calculus', 'Algebra', 'Geometry', 'Linear Algebra', 'Organic Chemistry',
    'Software Engineering', 'Web Development', 'Artificial Intelligence', 'Machine Learning',
    'Cybersecurity', 'Database Management', 'Game Development', 'UI/UX Design'
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const [answers, setAnswers] = useState({
    learningStage: '',
    subjects: [],
    mainSubject: '',
    brainwaveGoal: '',
    archetypeAnswers: {},
    archetypeScores: {
      Logicor: 0, Flowist: 0, Kinetiq: 0, Synth: 0, Dreamweaver: 0,
      Anchor: 0, Spark: 0, Empathion: 0, Seeker: 0, Resonant: 0
    }
  });
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (answers.mainSubject.length >= 3 && prevMainSubjectRef.current.length < 3 && currentStep === 'form') {
      scrollToRef(otherSubjectsRef);
    }
    prevMainSubjectRef.current = answers.mainSubject;
  }, [answers.mainSubject, currentStep]);

  const inspirationalQuotes = [
    "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.",
    "Education is not the filling of a pail, but the lighting of a fire.",
    "Live as if you were to die tomorrow. Learn as if you were to live forever."
  ];
  const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];

  const learningStages = [
    'High School Student', 'Undergraduate Student', 'Graduate Student',
    'Professional / Working', 'Self-Learner / Hobbyist', 'Career Changer', 'Lifelong Learner'
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
      id: 1, question: "When studying for a big exam, which approaches do you use?", multiSelect: true, layout: 'grid',
      options: [
        { text: "Create detailed outlines", archetypes: { Logicor: 3, Anchor: 2 } },
        { text: "Jump between topics", archetypes: { Flowist: 3, Spark: 2 } },
        { text: "Use flashcards or explain aloud", archetypes: { Kinetiq: 3, Flowist: 1 } },
        { text: "Draw diagrams and mind maps", archetypes: { Synth: 3, Dreamweaver: 2 } },
        { text: "Study with others", archetypes: { Empathion: 2, Synth: 1 } },
        { text: "Focus on practice problems", archetypes: { Logicor: 2, Kinetiq: 2 } }
      ]
    },
    {
      id: 2, question: "What roles do you naturally take in group projects?", multiSelect: true, layout: 'grid',
      options: [
        { text: "Organizer & timeline keeper", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Idea generator", archetypes: { Spark: 3, Dreamweaver: 2 } },
        { text: "Connector & collaborator", archetypes: { Synth: 3, Empathion: 2 } },
        { text: "Flexible adapter", archetypes: { Flowist: 3, Resonant: 2 } },
        { text: "Detail-oriented editor", archetypes: { Anchor: 2, Logicor: 1 } },
        { text: "Hands-on builder", archetypes: { Kinetiq: 3, Flowist: 1 } }
      ]
    },
    {
      id: 3, question: "How do you best understand new concepts?", multiSelect: false, layout: 'vertical',
      options: [
        { text: "Through logical steps and formulas", archetypes: { Logicor: 3, Anchor: 1 } },
        { text: "By physically working through examples", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "Connecting to real-world applications", archetypes: { Synth: 3, Seeker: 2 } },
        { text: "Grasping the overall vision first", archetypes: { Dreamweaver: 3, Spark: 1 } }
      ]
    },
    {
      id: 4, question: "What describes your study space?", multiSelect: false, layout: 'vertical',
      options: [
        { text: "Very organized with everything labeled", archetypes: { Anchor: 3 } },
        { text: "Organized chaos - messy but I know where things are", archetypes: { Spark: 2, Flowist: 2 } },
        { text: "Decorated with inspiration boards", archetypes: { Dreamweaver: 3, Spark: 1 } },
        { text: "Constantly rearranged based on projects", archetypes: { Flowist: 3, Resonant: 2 } }
      ]
    },
    {
      id: 5, question: "When you hit a roadblock, what do you do?", multiSelect: true, layout: 'grid',
      options: [
        { text: "Break it into smaller pieces", archetypes: { Logicor: 3, Anchor: 1 } },
        { text: "Try different approaches", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "Look for patterns", archetypes: { Synth: 3, Seeker: 1 } },
        { text: "Brainstorm alternatives", archetypes: { Spark: 3, Dreamweaver: 2 } },
        { text: "Take a break and come back", archetypes: { Resonant: 2, Flowist: 1 } },
        { text: "Ask for help", archetypes: { Empathion: 2, Synth: 1 } }
      ]
    },
    {
      id: 6, question: "What motivates you during tough semesters?", multiSelect: true, layout: 'grid',
      options: [
        { text: "Clear progress toward degree", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Learning fascinating topics", archetypes: { Seeker: 3, Spark: 2 } },
        { text: "Work with meaning & impact", archetypes: { Empathion: 3, Synth: 1 } },
        { text: "Achieving mastery", archetypes: { Logicor: 3, Kinetiq: 2 } },
        { text: "Exploring new ideas", archetypes: { Dreamweaver: 2, Seeker: 2 } },
        { text: "Building practical skills", archetypes: { Kinetiq: 2, Anchor: 1 } }
      ]
    }
  ];

  const archetypeDescriptions = {
    Logicor: "You excel at breaking down complex problems into logical steps. Your analytical mind naturally identifies patterns.",
    Flowist: "You thrive in dynamic learning environments where you can adapt and explore freely.",
    Kinetiq: "You learn best through hands-on experience and physical engagement.",
    Synth: "You possess a remarkable ability to see connections between seemingly unrelated ideas.",
    Dreamweaver: "You think in possibilities and future scenarios, naturally envisioning the bigger picture.",
    Anchor: "You value structure, consistency, and systematic organization in your learning.",
    Spark: "You're driven by creativity and innovative thinking, constantly generating new ideas.",
    Empathion: "You connect deeply with the human and emotional dimensions of learning.",
    Seeker: "You're motivated by curiosity and the joy of discovery.",
    Resonant: "You're highly adaptable and attuned to different learning situations."
  };


  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token) { navigate('/login'); return; }
    if (username) { setUserName(username); checkQuizStatus(username, token); }
  }, [navigate]);

  const checkQuizStatus = async (username, token) => {
    try {
      const response = await fetch(`${API_URL}/get_user_profile?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.quiz_completed || data.quiz_skipped) navigate('/dashboard');
      }
    } catch (error) { console.error('Error checking quiz status:', error); }
  };

  const generateMainSubjectSuggestions = (input) => {
    if (!input || input.length < 2) { setMainSubjectSuggestions([]); setShowMainSuggestions(false); return; }
    const filtered = commonSubjects.filter(s => s.toLowerCase().includes(input.toLowerCase())).slice(0, 8);
    setMainSubjectSuggestions(filtered);
    setShowMainSuggestions(filtered.length > 0);
  };

  const generateOtherSubjectSuggestions = (input) => {
    if (!input || input.length < 2) { setOtherSubjectSuggestions([]); setShowOtherSuggestions(false); return; }
    const filtered = commonSubjects.filter(s => 
      s.toLowerCase().includes(input.toLowerCase()) && !answers.subjects.includes(s) && s !== answers.mainSubject
    ).slice(0, 8);
    setOtherSubjectSuggestions(filtered);
    setShowOtherSuggestions(filtered.length > 0);
  };

  const handleSubjectInputChange = (e) => { setSubjectInput(e.target.value); generateOtherSubjectSuggestions(e.target.value); };

  const addSubject = (subject) => {
    if (!answers.subjects.includes(subject)) {
      setAnswers(prev => {
        const newSubjects = [...prev.subjects, subject];
        if (newSubjects.length === 1) scrollToRef(goalRef);
        return { ...prev, subjects: newSubjects };
      });
    }
    setSubjectInput(''); setOtherSubjectSuggestions([]); setShowOtherSuggestions(false);
  };

  const removeSubject = (subject) => setAnswers(prev => ({ ...prev, subjects: prev.subjects.filter(s => s !== subject) }));

  const handleArchetypeSelect = (optionIndex) => {
    const question = archetypeQuestions[currentQuestion];
    if (question.multiSelect) {
      setSelectedAnswers(prev => prev.includes(optionIndex) ? prev.filter(i => i !== optionIndex) : [...prev, optionIndex]);
    } else {
      setSelectedAnswer(optionIndex);
    }
  };

  const handleArchetypeNext = () => {
    const question = archetypeQuestions[currentQuestion];
    if (question.multiSelect && selectedAnswers.length === 0) return;
    if (!question.multiSelect && selectedAnswer === null) return;

    const newArchetypeAnswers = { ...answers.archetypeAnswers, [currentQuestion]: question.multiSelect ? selectedAnswers : selectedAnswer };
    const newScores = { ...answers.archetypeScores };
    
    if (question.multiSelect) {
      selectedAnswers.forEach(answerIndex => {
        const selectedOption = question.options[answerIndex];
        Object.entries(selectedOption.archetypes).forEach(([archetype, points]) => {
          newScores[archetype] = (newScores[archetype] || 0) + points;
        });
      });
    } else {
      const selectedOption = question.options[selectedAnswer];
      Object.entries(selectedOption.archetypes).forEach(([archetype, points]) => {
        newScores[archetype] = (newScores[archetype] || 0) + points;
      });
    }

    setAnswers(prev => ({ ...prev, archetypeAnswers: newArchetypeAnswers, archetypeScores: newScores }));

    if (currentQuestion < archetypeQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null); setSelectedAnswers([]);
    } else {
      completeQuiz(newScores);
    }
  };

  const handleArchetypeBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers.archetypeAnswers[currentQuestion - 1];
      const prevQuestion = archetypeQuestions[currentQuestion - 1];
      if (prevQuestion.multiSelect) { setSelectedAnswers(prevAnswer || []); setSelectedAnswer(null); }
      else { setSelectedAnswer(prevAnswer ?? null); setSelectedAnswers([]); }
    }
  };


  const completeQuiz = async (scores) => {
    const sortedArchetypes = Object.entries(scores).sort(([, a], [, b]) => b - a).map(([archetype]) => archetype);
    const primaryArchetype = sortedArchetypes[0];
    const secondaryArchetype = sortedArchetypes[1];

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/save_complete_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: userName, learning_stage: answers.learningStage, preferred_subjects: answers.subjects,
          main_subject: answers.mainSubject, brainwave_goal: answers.brainwaveGoal,
          primary_archetype: primaryArchetype, secondary_archetype: secondaryArchetype,
          archetype_scores: scores, archetype_description: archetypeDescriptions[primaryArchetype],
          quiz_completed: true, quiz_responses: answers.archetypeAnswers
        })
      });
      setCurrentStep('complete');
      localStorage.setItem('justCompletedQuiz', 'true');
      sessionStorage.setItem('justLoggedIn', 'true');
      setTimeout(() => navigate('/dashboard'), 5000);
    } catch (error) { console.error('Error saving profile:', error); }
  };

  const handleSkip = () => setShowSkipWarning(true);
  const cancelSkip = () => setShowSkipWarning(false);

  const confirmSkip = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/save_complete_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: userName, learning_stage: answers.learningStage, preferred_subjects: answers.subjects,
          main_subject: answers.mainSubject, brainwave_goal: answers.brainwaveGoal,
          quiz_completed: false, quiz_skipped: true
        })
      });
      navigate('/dashboard');
    } catch (error) { console.error('Error saving profile:', error); navigate('/dashboard'); }
  };

  // WELCOME SCREEN
  if (currentStep === 'welcome') {
    return (
      <div className="pq-page">
        <header className="pq-header">
          <div className="pq-header-left">
            <h1 className="pq-header-title">cerbyl</h1>
            <span className="pq-header-subtitle">profile setup</span>
          </div>
        </header>
        <div className="pq-main">
          <div className="pq-bento-grid">
            <div className="pq-bento-box pq-bento-large">
              <h1 className="pq-bento-title">welcome to cerbyl</h1>
            </div>
            <div className="pq-bento-box pq-bento-quote">
              <p className="pq-quote-text">{randomQuote}</p>
            </div>
            <div className="pq-bento-box pq-bento-symbol">
              <svg className="pq-symbol-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
              </svg>
            </div>
            <div className="pq-bento-box pq-bento-cta" onClick={() => setCurrentStep('form')}>
              <div className="pq-cta-content">
                <svg className="pq-cta-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <span className="pq-cta-text">take quiz</span>
              </div>
            </div>
            <div className="pq-bento-box"></div>
            <div className="pq-bento-box"></div>
            <div className="pq-bento-box pq-bento-desc">
              <h3 className="pq-desc-title">your personalized ai tutor</h3>
              <p className="pq-desc-text">Cerbyl adapts to your unique learning style, helping you master any subject.</p>
            </div>
            <div className="pq-bento-box"></div>
          </div>
        </div>
      </div>
    );
  }


  // ARCHETYPE QUIZ SCREEN
  if (currentStep === 'archetype') {
    const question = archetypeQuestions[currentQuestion];
    const isValid = question.multiSelect ? selectedAnswers.length > 0 : selectedAnswer !== null;
    
    return (
      <div className="pq-page">
        <header className="pq-header">
          <div className="pq-header-left">
            <h1 className="pq-header-title">learning archetype</h1>
            <span className="pq-header-subtitle">discover your learning style</span>
          </div>
        </header>
        <div className="pq-main">
          <div className="pq-container">
            <div className="pq-progress">
              <div className="pq-progress-bar">
                <div className="pq-progress-fill" style={{ width: `${((currentQuestion + 1) / archetypeQuestions.length) * 100}%` }}></div>
              </div>
              <p className="pq-progress-text">Question {currentQuestion + 1} of {archetypeQuestions.length}</p>
            </div>

            <div className="pq-question">
              <h2 className="pq-question-text">{question.question}</h2>
              {question.multiSelect && <p className="pq-question-hint">select all that apply</p>}
            </div>
            
            <div className={`pq-options ${question.layout === 'grid' ? 'grid' : ''}`}>
              {question.options.map((option, index) => {
                const isSelected = question.multiSelect ? selectedAnswers.includes(index) : selectedAnswer === index;
                return (
                  <button key={index} className={`pq-option ${isSelected ? 'selected' : ''}`} onClick={() => handleArchetypeSelect(index)}>
                    <span className="pq-option-marker">{String.fromCharCode(65 + index)}</span>
                    <span className="pq-option-text">{option.text}</span>
                    {question.multiSelect && isSelected && <span className="pq-option-check">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="pq-nav">
              <button className="pq-nav-btn-action back" onClick={handleArchetypeBack} disabled={currentQuestion === 0}>back</button>
              <button className="pq-nav-btn-action continue" onClick={handleArchetypeNext} disabled={!isValid}>
                {currentQuestion === archetypeQuestions.length - 1 ? 'complete' : 'continue'}
              </button>
            </div>
            <button className="pq-skip-btn" onClick={handleSkip}>skip learning style assessment</button>
          </div>
        </div>

        {showSkipWarning && (
          <div className="pq-warning-overlay">
            <div className="pq-warning-modal">
              <h3>are you sure you want to skip?</h3>
              <p>The Learning Archetype Assessment helps us personalize your AI tutor to match your unique learning style.</p>
              <p className="pq-warning-emphasis">We highly recommend completing this short assessment.</p>
              <div className="pq-warning-actions">
                <button className="pq-warning-btn continue" onClick={cancelSkip}>Continue Assessment</button>
                <button className="pq-warning-btn skip" onClick={confirmSkip}>Skip Anyway</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // COMPLETION SCREEN
  if (currentStep === 'complete') {
    const primaryArchetype = Object.entries(answers.archetypeScores).sort(([, a], [, b]) => b - a)[0][0];
    return (
      <div className="pq-page">
        <header className="pq-header">
          <div className="pq-header-left">
            <h1 className="pq-header-title">profile complete</h1>
          </div>
        </header>
        <div className="pq-main">
          <div className="pq-container">
            <div className="pq-completion">
              <p className="pq-completion-header">you are a</p>
              <h1 className="pq-archetype-name">{primaryArchetype}</h1>
              <p className="pq-archetype-desc">{archetypeDescriptions[primaryArchetype]}</p>
              <p className="pq-completion-message">Your AI tutor is now personalized to match your unique learning style</p>
              <p className="pq-redirect-message">Redirecting to your dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // FORM SCREEN (default)
  return (
    <div className="pq-page">
      <header className="pq-header">
        <div className="pq-header-left">
          <h1 className="pq-header-title">profile</h1>
          <span className="pq-header-subtitle">customize your ai learning experience</span>
        </div>
        <div className="pq-header-right">
          <button className="pq-nav-btn" onClick={() => navigate('/dashboard')}>◄ back to dashboard</button>
        </div>
      </header>

      <div className="pq-main">
        <div className="pq-container">
          <div className="pq-form-section">
            <label className="pq-form-label">what best describes your learning journey?</label>
            <div className="pq-btn-group">
              {learningStages.map((stage) => (
                <button key={stage} className={`pq-choice-btn ${answers.learningStage === stage ? 'selected' : ''}`}
                  onClick={() => { setAnswers(prev => ({ ...prev, learningStage: stage })); scrollToRef(mainSubjectRef); }}>
                  {stage}
                </button>
              ))}
            </div>
          </div>

          {answers.learningStage && (
            <div className="pq-form-section" ref={mainSubjectRef}>
              <label className="pq-form-label">what's your main subject or field of study?</label>
              <p className="pq-form-hint">type to search or add a custom subject</p>
              <div className="pq-input-wrapper">
                <input type="text" className="pq-input" placeholder="e.g., Computer Science, Biology..."
                  value={answers.mainSubject}
                  onChange={(e) => { setAnswers(prev => ({ ...prev, mainSubject: e.target.value })); generateMainSubjectSuggestions(e.target.value); }}
                  onFocus={() => { if (answers.mainSubject.length >= 2) generateMainSubjectSuggestions(answers.mainSubject); }}
                  onBlur={() => setTimeout(() => setShowMainSuggestions(false), 200)} />
                {showMainSuggestions && mainSubjectSuggestions.length > 0 && (
                  <div className="pq-suggestions">
                    {mainSubjectSuggestions.map((subject, idx) => (
                      <div key={idx} className="pq-suggestion-item"
                        onMouseDown={(e) => { e.preventDefault(); setAnswers(prev => ({ ...prev, mainSubject: subject }));
                          setMainSubjectSuggestions([]); setShowMainSuggestions(false); scrollToRef(otherSubjectsRef); }}>
                        {subject}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {answers.mainSubject && (
            <div className="pq-form-section" ref={otherSubjectsRef}>
              <label className="pq-form-label">what other subjects are you interested in?</label>
              <p className="pq-form-hint">type to search or add custom subjects (optional)</p>
              {answers.subjects.length > 0 && (
                <div className="pq-tags">
                  {answers.subjects.map((subject, idx) => (
                    <div key={idx} className="pq-tag">
                      {subject}
                      <button className="pq-tag-remove" onClick={() => removeSubject(subject)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="pq-input-wrapper">
                <input type="text" className="pq-input" placeholder="e.g., Calculus, Data Structures..."
                  value={subjectInput} onChange={handleSubjectInputChange}
                  onKeyPress={(e) => { if (e.key === 'Enter' && subjectInput.trim() && subjectInput !== answers.mainSubject) addSubject(subjectInput.trim()); }}
                  onFocus={() => { if (subjectInput.length >= 2) generateOtherSubjectSuggestions(subjectInput); }}
                  onBlur={() => setTimeout(() => setShowOtherSuggestions(false), 200)} />
                {showOtherSuggestions && otherSubjectSuggestions.length > 0 && (
                  <div className="pq-suggestions">
                    {otherSubjectSuggestions.map((subject, idx) => (
                      <div key={idx} className="pq-suggestion-item" onMouseDown={(e) => { e.preventDefault(); addSubject(subject); }}>
                        {subject}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {answers.mainSubject && (
            <div className="pq-form-section" ref={goalRef}>
              <label className="pq-form-label">what's your main goal?</label>
              <div className="pq-btn-group">
                {brainwaveGoals.map((goal) => (
                  <button key={goal.value} className={`pq-choice-btn ${answers.brainwaveGoal === goal.value ? 'selected' : ''}`}
                    onClick={() => { setAnswers(prev => ({ ...prev, brainwaveGoal: goal.value })); scrollToRef(submitRef); }}>
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answers.mainSubject && answers.brainwaveGoal && (
            <div className="pq-form-section" ref={submitRef}>
              <button className="pq-submit-btn" onClick={() => setCurrentStep('archetype')}>continue to learning style</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileQuiz;
