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
  
  // Refs for auto-scroll
  const mainSubjectRef = useRef(null);
  const otherSubjectsRef = useRef(null);
  const goalRef = useRef(null);
  const submitRef = useRef(null);
  
  // Auto-scroll helper function
  const scrollToRef = (ref) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };
  
  // Ref for tracking previous main subject value
  const prevMainSubjectRef = useRef('');

  // Common subjects list
  const commonSubjects = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Engineering', 'Business Administration', 'Economics', 'Psychology', 'Sociology',
    'English Literature', 'History', 'Political Science', 'Philosophy', 'Art History',
    'Music', 'Theater', 'Communications', 'Journalism', 'Marketing',
    'Accounting', 'Finance', 'Statistics', 'Data Science', 'Information Technology',
    'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering',
    'Biochemistry', 'Molecular Biology', 'Genetics', 'Neuroscience', 'Medicine',
    'Nursing', 'Public Health', 'Environmental Science', 'Geography', 'Anthropology',
    'Architecture', 'Graphic Design', 'Film Studies', 'Creative Writing', 'Linguistics',
    'Foreign Languages', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
    'Calculus', 'Algebra', 'Geometry', 'Trigonometry', 'Linear Algebra',
    'Organic Chemistry', 'Physical Chemistry', 'Analytical Chemistry', 'Inorganic Chemistry',
    'Quantum Physics', 'Thermodynamics', 'Electromagnetism', 'Optics', 'Mechanics',
    'Cell Biology', 'Ecology', 'Microbiology', 'Zoology', 'Botany',
    'Software Engineering', 'Web Development', 'Mobile Development', 'Artificial Intelligence',
    'Machine Learning', 'Cybersecurity', 'Database Management', 'Network Administration',
    'Game Development', 'UI/UX Design', 'Digital Marketing', 'Social Media Marketing',
    'Human Resources', 'Operations Management', 'Supply Chain Management', 'Project Management',
    'Law', 'Criminal Justice', 'International Relations', 'Education', 'Special Education'
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

  // Auto-scroll to other subjects section when main subject is typed
  useEffect(() => {
    // Only scroll if mainSubject just became valid (3+ chars) and wasn't before
    if (answers.mainSubject.length >= 3 && prevMainSubjectRef.current.length < 3 && currentStep === 'form') {
      scrollToRef(otherSubjectsRef);
    }
    prevMainSubjectRef.current = answers.mainSubject;
  }, [answers.mainSubject, currentStep]);

  const inspirationalQuotes = [
    "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.",
    "Education is not the filling of a pail, but the lighting of a fire.",
    "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    "The beautiful thing about learning is that no one can take it away from you.",
    "Learning is not attained by chance, it must be sought for with ardor and attended to with diligence."
  ];

  const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];

  const learningStages = [
    'High School Student',
    'Undergraduate Student',
    'Graduate Student',
    'Professional / Working',
    'Self-Learner / Hobbyist',
    'Career Changer',
    'Lifelong Learner'
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
      question: "When you're studying for a big exam, which approaches do you use? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Create detailed outlines and systematic breakdowns", archetypes: { Logicor: 3, Anchor: 2 } },
        { text: "Jump between topics based on interest", archetypes: { Flowist: 3, Spark: 2 } },
        { text: "Use flashcards or explain concepts out loud", archetypes: { Kinetiq: 3, Flowist: 1 } },
        { text: "Draw diagrams and mind maps", archetypes: { Synth: 3, Dreamweaver: 2 } },
        { text: "Study with others in groups", archetypes: { Empathion: 2, Synth: 1 } },
        { text: "Focus on practice problems", archetypes: { Logicor: 2, Kinetiq: 2 } }
      ]
    },
    {
      id: 2,
      question: "What roles do you naturally take in group projects? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Organizer & timeline keeper", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Idea generator & creative problem solver", archetypes: { Spark: 3, Dreamweaver: 2 } },
        { text: "Connector & collaborator", archetypes: { Synth: 3, Empathion: 2 } },
        { text: "Flexible adapter", archetypes: { Flowist: 3, Resonant: 2 } },
        { text: "Detail-oriented editor", archetypes: { Anchor: 2, Logicor: 1 } },
        { text: "Hands-on builder", archetypes: { Kinetiq: 3, Flowist: 1 } }
      ]
    },
    {
      id: 3,
      question: "How do you best understand new concepts?",
      multiSelect: false,
      layout: 'vertical',
      options: [
        { text: "Through logical steps and formulas", archetypes: { Logicor: 3, Anchor: 1 } },
        { text: "By physically working through examples", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "Connecting to real-world applications", archetypes: { Synth: 3, Seeker: 2 } },
        { text: "Grasping the overall vision first", archetypes: { Dreamweaver: 3, Spark: 1 } }
      ]
    },
    {
      id: 4,
      question: "What describes your study space?",
      multiSelect: false,
      layout: 'vertical',
      options: [
        { text: "Very organized with everything labeled", archetypes: { Anchor: 3 } },
        { text: "Organized chaos - messy but I know where things are", archetypes: { Spark: 2, Flowist: 2 } },
        { text: "Decorated with inspiration boards and quotes", archetypes: { Dreamweaver: 3, Spark: 1 } },
        { text: "Constantly rearranged based on projects", archetypes: { Flowist: 3, Resonant: 2 } }
      ]
    },
    {
      id: 5,
      question: "When you hit a roadblock, what do you do? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
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
      id: 6,
      question: "What motivates you during tough semesters? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Clear progress toward degree", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Learning fascinating topics", archetypes: { Seeker: 3, Spark: 2 } },
        { text: "Work with meaning & impact", archetypes: { Empathion: 3, Synth: 1 } },
        { text: "Achieving mastery", archetypes: { Logicor: 3, Kinetiq: 2 } },
        { text: "Exploring new ideas", archetypes: { Dreamweaver: 2, Seeker: 2 } },
        { text: "Building practical skills", archetypes: { Kinetiq: 2, Anchor: 1 } }
      ]
    },
    {
      id: 7,
      question: "How do you take notes in lectures?",
      multiSelect: false,
      layout: 'vertical',
      options: [
        { text: "Detailed linear notes following structure", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Sketches, diagrams, and visual elements", archetypes: { Dreamweaver: 3, Spark: 2 } },
        { text: "Key ideas with connections to other topics", archetypes: { Synth: 3, Seeker: 1 } },
        { text: "Record/photograph to review later while active", archetypes: { Kinetiq: 3, Flowist: 2 } }
      ]
    },
    {
      id: 8,
      question: "What type of classes do you prefer? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Career-focused courses", archetypes: { Anchor: 3, Logicor: 1 } },
        { text: "Interdisciplinary explorations", archetypes: { Seeker: 3, Spark: 2 } },
        { text: "Hands-on projects", archetypes: { Kinetiq: 3, Flowist: 1 } },
        { text: "Multi-discipline connections", archetypes: { Synth: 3, Dreamweaver: 2 } },
        { text: "Theory-heavy courses", archetypes: { Logicor: 2, Seeker: 1 } },
        { text: "Creative & innovative courses", archetypes: { Spark: 3, Dreamweaver: 1 } }
      ]
    },
    {
      id: 9,
      question: "How do you handle deadline stress? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Make detailed to-do lists", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Exercise or physical activity", archetypes: { Kinetiq: 3, Flowist: 2 } },
        { text: "Talk with friends or journal", archetypes: { Empathion: 3, Spark: 1 } },
        { text: "Stay flexible with plans", archetypes: { Resonant: 3, Flowist: 2 } },
        { text: "Focus intensely on tasks", archetypes: { Logicor: 2, Anchor: 1 } },
        { text: "Take strategic breaks", archetypes: { Resonant: 2, Kinetiq: 1 } }
      ]
    },
    {
      id: 10,
      question: "Which study environments work for you? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Quiet library", archetypes: { Anchor: 2, Logicor: 2 } },
        { text: "Coffee shop with ambiance", archetypes: { Flowist: 3, Kinetiq: 1 } },
        { text: "Outdoor spaces", archetypes: { Kinetiq: 2, Resonant: 2 } },
        { text: "Creative inspiring spaces", archetypes: { Spark: 3, Dreamweaver: 2 } },
        { text: "Study groups", archetypes: { Empathion: 2, Synth: 2 } },
        { text: "My own room", archetypes: { Anchor: 1, Resonant: 1 } }
      ]
    },
    {
      id: 11,
      question: "What learning resources do you prefer? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Textbooks & written materials", archetypes: { Logicor: 2, Anchor: 2 } },
        { text: "Video tutorials", archetypes: { Kinetiq: 2, Flowist: 1 } },
        { text: "Interactive simulations", archetypes: { Kinetiq: 3, Spark: 2 } },
        { text: "Concept maps & visuals", archetypes: { Synth: 3, Dreamweaver: 2 } },
        { text: "Discussion forums", archetypes: { Empathion: 2, Seeker: 1 } },
        { text: "Real-world case studies", archetypes: { Synth: 2, Seeker: 2 } }
      ]
    },
    {
      id: 12,
      question: "How do you prepare for exams? (Select all that apply)",
      multiSelect: true,
      layout: 'grid',
      options: [
        { text: "Review notes systematically", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Do practice problems", archetypes: { Logicor: 3, Kinetiq: 1 } },
        { text: "Create study guides", archetypes: { Anchor: 2, Synth: 2 } },
        { text: "Teach concepts to others", archetypes: { Empathion: 3, Kinetiq: 2 } },
        { text: "Review in varied locations", archetypes: { Flowist: 2, Kinetiq: 1 } },
        { text: "Connect to bigger picture", archetypes: { Dreamweaver: 2, Synth: 2 } }
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
      const response = await fetch(`${API_URL}/check_profile_quiz?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
                if (data.completed) {
                    navigate('/dashboard');
        }
      }
    } catch (error) {
          }
  };

  const generateMainSubjectSuggestions = (input) => {
    if (!input || input.length < 2) {
      setMainSubjectSuggestions([]);
      setShowMainSuggestions(false);
      return;
    }

    const filtered = commonSubjects.filter(subject => 
      subject.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 8);

    setMainSubjectSuggestions(filtered);
    setShowMainSuggestions(filtered.length > 0);
  };

  const generateOtherSubjectSuggestions = (input) => {
    if (!input || input.length < 2) {
      setOtherSubjectSuggestions([]);
      setShowOtherSuggestions(false);
      return;
    }

    const filtered = commonSubjects.filter(subject => 
      subject.toLowerCase().includes(input.toLowerCase()) &&
      !answers.subjects.includes(subject) &&
      subject !== answers.mainSubject
    ).slice(0, 8);

    setOtherSubjectSuggestions(filtered);
    setShowOtherSuggestions(filtered.length > 0);
  };

  const handleSubjectInputChange = (e) => {
    const value = e.target.value;
    setSubjectInput(value);
    generateOtherSubjectSuggestions(value);
  };

  const addSubject = (subject) => {
    if (!answers.subjects.includes(subject)) {
      setAnswers(prev => {
        const newSubjects = [...prev.subjects, subject];
                // Scroll to goal section after first subject is added
        if (newSubjects.length === 1) {
          scrollToRef(goalRef);
        }
        return {
          ...prev,
          subjects: newSubjects
        };
      });
    }
    setSubjectInput('');
    setOtherSubjectSuggestions([]);
    setShowOtherSuggestions(false);
  };

  const removeSubject = (subject) => {
    setAnswers(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== subject)
    }));
  };

  const handleArchetypeSelect = (optionIndex) => {
    const question = archetypeQuestions[currentQuestion];
    
    if (question.multiSelect) {
      setSelectedAnswers(prev => {
        if (prev.includes(optionIndex)) {
          return prev.filter(i => i !== optionIndex);
        } else {
          return [...prev, optionIndex];
        }
      });
    } else {
      setSelectedAnswer(optionIndex);
    }
  };

  const handleArchetypeNext = () => {
    const question = archetypeQuestions[currentQuestion];
    
    if (question.multiSelect && selectedAnswers.length === 0) return;
    if (!question.multiSelect && selectedAnswer === null) return;

    const newArchetypeAnswers = { 
      ...answers.archetypeAnswers, 
      [currentQuestion]: question.multiSelect ? selectedAnswers : selectedAnswer 
    };
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

    setAnswers(prev => ({
      ...prev,
      archetypeAnswers: newArchetypeAnswers,
      archetypeScores: newScores
    }));

    if (currentQuestion < archetypeQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setSelectedAnswers([]);
    } else {
      completeQuiz(newScores);
    }
  };

  const handleArchetypeBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers.archetypeAnswers[currentQuestion - 1];
      const prevQuestion = archetypeQuestions[currentQuestion - 1];
      
      if (prevQuestion.multiSelect) {
        setSelectedAnswers(prevAnswer || []);
        setSelectedAnswer(null);
      } else {
        setSelectedAnswer(prevAnswer ?? null);
        setSelectedAnswers([]);
      }
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
          learning_stage: answers.learningStage,
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
      // Set flags that user just completed onboarding
      sessionStorage.setItem('justCompletedOnboarding', 'true');
      sessionStorage.setItem('isFirstTimeUser', 'true');
      sessionStorage.setItem('justLoggedIn', 'true'); // Set flag for welcome notification
      setTimeout(() => {
        navigate('/dashboard');
      }, 5000);
    } catch (error) {
          }
  };

  const handleSkip = () => {
    setShowSkipWarning(true);
  };

  const confirmSkip = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/save_complete_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          learning_stage: answers.learningStage,
          preferred_subjects: answers.subjects,
          main_subject: answers.mainSubject,
          brainwave_goal: answers.brainwaveGoal,
          quiz_completed: false,
          quiz_skipped: true
        })
      });

      if (response.ok) {
        const data = await response.json();
                        
        // Set flag that user just completed onboarding (by skipping)
        sessionStorage.setItem('justCompletedOnboarding', 'true');
        sessionStorage.setItem('isFirstTimeUser', 'true');
        
        // Wait a moment for database to fully commit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        navigate('/dashboard');
      } else {
                navigate('/dashboard');
      }
    } catch (error) {
            navigate('/dashboard');
    }
  };

  const cancelSkip = () => {
    setShowSkipWarning(false);
  };

  const isFormValid = () => {
    return answers.learningStage && 
           answers.subjects.length > 0 && 
           answers.mainSubject && 
           answers.brainwaveGoal;
  };

  if (currentStep === 'welcome') {
    return (
      <div className="profile-quiz-page">
        <div className="bento-background">
          <div className="bento-bg-box bento-bg-1"></div>
          <div className="bento-bg-box bento-bg-2"></div>
          <div className="bento-bg-box bento-bg-3"></div>
          <div className="bento-bg-box bento-bg-4"></div>
          <div className="bento-bg-box bento-bg-5"></div>
          <div className="bento-bg-box bento-bg-6"></div>
          <div className="bento-bg-box bento-bg-7"></div>
          <div className="bento-bg-box bento-bg-8"></div>
        </div>
        
        <div className="bento-grid">
          <div className="connection-network">
            <div className="node node-1"></div>
            <div className="node node-2"></div>
            <div className="node node-3"></div>
            <div className="node node-4"></div>
            <div className="node node-5"></div>
            <div className="node node-6"></div>
            <div className="node node-7"></div>
            <div className="node node-8"></div>
            <svg className="connection-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="25" y1="25" x2="50" y2="25" className="connection-line" />
              <line x1="50" y1="12.5" x2="75" y2="12.5" className="connection-line" />
              <line x1="75" y1="25" x2="87.5" y2="25" className="connection-line" />
              <line x1="50" y1="37.5" x2="75" y2="37.5" className="connection-line" />
              <line x1="37.5" y1="62.5" x2="62.5" y2="62.5" className="connection-line" />
              <line x1="50" y1="75" x2="75" y2="75" className="connection-line" />
              <line x1="25" y1="25" x2="25" y2="62.5" className="connection-line" />
              <line x1="75" y1="37.5" x2="75" y2="62.5" className="connection-line" />
            </svg>
          </div>

          <div className="bento-box bento-text-large">
            <h1 className="bento-large-title">
              <img src="/logo.svg" alt="" style={{ height: '40px', marginRight: '12px', verticalAlign: 'middle', filter: 'brightness(0) saturate(100%) invert(77%) sepia(48%) saturate(456%) hue-rotate(359deg) brightness(95%) contrast(89%)' }} />
              welcome to cerbyl
            </h1>
          </div>

          <div className="bento-box bento-quote-top">
            <p className="bento-quote-text">{randomQuote}</p>
          </div>

          <div className="bento-box bento-symbol-top">
            <svg className="bento-symbol-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
            </svg>
          </div>

          <div className="bento-box bento-main-cta" onClick={() => setCurrentStep('form')}>
            <div className="bento-cta-content">
              <svg className="bento-cta-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span className="bento-cta-text">take quiz</span>
            </div>
          </div>

          <div className="bento-box bento-skip-cta" onClick={handleSkip}>
            <div className="bento-cta-content">
              <svg className="bento-skip-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
              </svg>
              <span className="bento-cta-text">skip quiz</span>
            </div>
          </div>

          <div className="bento-box bento-accent-light"></div>
          <div className="bento-box bento-accent-medium"></div>

          <div className="bento-box bento-accent-mid"></div>
          <div className="bento-box bento-accent-strong"></div>

          <div className="bento-box bento-accent-dark"></div>

          <div className="bento-box bento-description">
            <h3 className="bento-desc-title">your personalized ai tutor</h3>
            <p className="bento-desc-text">
              Cerbyl adapts to your unique learning style, helping you master any subject with personalized guidance and support.
            </p>
          </div>

          <div className="bento-box bento-accent-subtle"></div>
        </div>
        
        {showSkipWarning && (
          <div className="skip-warning-overlay">
            <div className="skip-warning-modal">
              <h3>skip the quiz?</h3>
              <p>
                Taking this quiz helps us understand your learning style and personalize your experience. 
                We can adapt to your needs much better if you complete it!
              </p>
              <p className="warning-emphasis">
                You can always take the quiz later from your profile section.
              </p>
              <div className="warning-actions">
                <button className="continue-assessment-btn" onClick={cancelSkip}>
                  Take Quiz
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

  if (currentStep === 'archetype') {
    const question = archetypeQuestions[currentQuestion];
    const isValid = question.multiSelect ? selectedAnswers.length > 0 : selectedAnswer !== null;
    
    return (
      <div className="profile-quiz-page">
        <div className="bento-background">
          <div className="bento-bg-box bento-bg-1"></div>
          <div className="bento-bg-box bento-bg-2"></div>
          <div className="bento-bg-box bento-bg-3"></div>
          <div className="bento-bg-box bento-bg-4"></div>
          <div className="bento-bg-box bento-bg-5"></div>
          <div className="bento-bg-box bento-bg-6"></div>
          <div className="bento-bg-box bento-bg-7"></div>
          <div className="bento-bg-box bento-bg-8"></div>
        </div>
        
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
              <h2 className="question-text">{question.question}</h2>
              {question.multiSelect && (
                <p className="question-subtitle">select all that apply</p>
              )}
              
              <div className={`options-grid ${question.layout === 'grid' ? 'options-grid-2col' : 'options-grid-1col'}`}>
                {question.options.map((option, index) => {
                  const isSelected = question.multiSelect 
                    ? selectedAnswers.includes(index)
                    : selectedAnswer === index;
                    
                  return (
                    <button
                      key={index}
                      className={`option-button ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleArchetypeSelect(index)}
                    >
                      <span className="option-number">{String.fromCharCode(65 + index)}</span>
                      <span className="option-text">{option.text}</span>
                      {question.multiSelect && isSelected && (
                        <span className="option-checkmark">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="navigation-buttons">
                <button 
                  className="back-btn" 
                  onClick={handleArchetypeBack}
                  disabled={currentQuestion === 0}
                >
                  <svg className="back-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 5v14l-11-7z"/>
                  </svg>
                  back
                </button>
                <button 
                  className="continue-btn" 
                  onClick={handleArchetypeNext}
                  disabled={!isValid}
                >
                  {currentQuestion === archetypeQuestions.length - 1 ? 'complete' : 'continue'}
                </button>
              </div>

              <button className="skip-quiz-btn" onClick={handleSkip}>
                skip learning style assessment
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
      <div className="bento-background">
        <div className="bento-bg-box bento-bg-1"></div>
        <div className="bento-bg-box bento-bg-2"></div>
        <div className="bento-bg-box bento-bg-3"></div>
        <div className="bento-bg-box bento-bg-4"></div>
        <div className="bento-bg-box bento-bg-5"></div>
        <div className="bento-bg-box bento-bg-6"></div>
        <div className="bento-bg-box bento-bg-7"></div>
        <div className="bento-bg-box bento-bg-8"></div>
      </div>
      
      <div className="quiz-container">
        <div className="quiz-header-single">
          <div className="quiz-header-left">
            <h1 className="quiz-title-single">profile</h1>
            <p className="quiz-subtitle-single">customize your ai learning experience</p>
          </div>
          <button className="back-to-dashboard-btn" onClick={() => navigate('/dashboard')}>
            ◄ back to dashboard
          </button>
        </div>

        <div className="quiz-form">
          <div className="form-section">
            <label className="form-label">what best describes your learning journey?</label>
            <div className="button-group-vertical">
              {learningStages.map((stage) => (
                <button
                  key={stage}
                  className={`choice-btn-vertical ${answers.learningStage === stage ? 'selected' : ''}`}
                  onClick={() => {
                    setAnswers(prev => ({ ...prev, learningStage: stage }));
                    scrollToRef(mainSubjectRef);
                  }}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>

          {answers.learningStage && (
            <div className="form-section" ref={mainSubjectRef}>
              <label className="form-label">what's your main subject or field of study?</label>
              <p className="form-hint">type to search or add a custom subject</p>
              
              <div className="subject-input-container">
                <input
                  type="text"
                  className="subject-input"
                  placeholder="e.g., Computer Science, Biology, Mathematics..."
                  value={answers.mainSubject}
                  onChange={(e) => {
                    setAnswers(prev => ({ ...prev, mainSubject: e.target.value }));
                    generateMainSubjectSuggestions(e.target.value);
                  }}
                  autoComplete="off"
                  onFocus={() => {
                    if (answers.mainSubject.length >= 2) {
                      generateMainSubjectSuggestions(answers.mainSubject);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowMainSuggestions(false), 200);
                  }}
                />

                {showMainSuggestions && mainSubjectSuggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {mainSubjectSuggestions.map((subject, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setAnswers(prev => ({ ...prev, mainSubject: subject }));
                          setMainSubjectSuggestions([]);
                          setShowMainSuggestions(false);
                          scrollToRef(otherSubjectsRef);
                        }}
                      >
                        {subject}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {answers.mainSubject && (
            <div className="form-section" ref={otherSubjectsRef}>
              <label className="form-label">what other subjects are you interested in?</label>
              <p className="form-hint">type to search or add custom subjects (optional)</p>
              
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

              <div className="subject-input-container">
                <input
                  type="text"
                  className="subject-input"
                  placeholder="e.g., Calculus, Organic Chemistry, Data Structures..."
                  value={subjectInput}
                  onChange={handleSubjectInputChange}
                  autoComplete="off"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && subjectInput.trim() && subjectInput !== answers.mainSubject) {
                      addSubject(subjectInput.trim());
                    }
                  }}
                  onFocus={() => {
                    if (subjectInput.length >= 2) {
                      generateOtherSubjectSuggestions(subjectInput);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowOtherSuggestions(false), 200);
                  }}
                />

                {showOtherSuggestions && otherSubjectSuggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {otherSubjectSuggestions.map((subject, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addSubject(subject);
                        }}
                      >
                        {subject}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {answers.mainSubject && (
            <div className="form-section" ref={goalRef}>
              <label className="form-label">what's your main goal?</label>
              <div className="button-group-vertical">
                {brainwaveGoals.map((goal) => (
                  <button
                    key={goal.value}
                    className={`choice-btn-vertical ${answers.brainwaveGoal === goal.value ? 'selected' : ''}`}
                    onClick={() => {
                      setAnswers(prev => ({ ...prev, brainwaveGoal: goal.value }));
                      scrollToRef(submitRef);
                    }}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answers.mainSubject && answers.brainwaveGoal && (
            <div className="form-section" ref={submitRef}>
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