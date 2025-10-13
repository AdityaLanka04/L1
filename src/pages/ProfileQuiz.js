import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileQuiz.css';

const ProfileQuiz = () => {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const [userName, setUserName] = useState('');
  const [archetypeScores, setArchetypeScores] = useState({
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
  });

  const questions = [
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
    },
    {
      id: 11,
      question: "When working on a research paper, you typically:",
      options: [
        { text: "Start with a detailed outline and fill in each section", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Write whatever section inspires you and connect later", archetypes: { Spark: 3, Flowist: 2 } },
        { text: "Draft the whole thing quickly then revise extensively", archetypes: { Kinetiq: 2, Flowist: 2 } },
        { text: "Research deeply to find surprising connections between sources", archetypes: { Synth: 3, Seeker: 2 } }
      ]
    },
    {
      id: 12,
      question: "Your ideal internship or career would involve:",
      options: [
        { text: "Clear structure with defined responsibilities and advancement", archetypes: { Anchor: 3, Logicor: 1 } },
        { text: "Constant learning and exposure to new ideas", archetypes: { Seeker: 3, Spark: 1 } },
        { text: "Making a positive difference in people's lives", archetypes: { Empathion: 3, Synth: 1 } },
        { text: "Variety and the ability to work on different projects", archetypes: { Flowist: 3, Resonant: 2 } }
      ]
    },
    {
      id: 13,
      question: "When giving a class presentation, you're most comfortable:",
      options: [
        { text: "Following prepared notes and a structured format", archetypes: { Anchor: 3, Logicor: 2 } },
        { text: "Using engaging visuals and storytelling", archetypes: { Dreamweaver: 3, Spark: 2 } },
        { text: "Including interactive elements or demonstrations", archetypes: { Kinetiq: 3, Empathion: 1 } },
        { text: "Connecting the topic to broader themes and implications", archetypes: { Synth: 3, Seeker: 1 } }
      ]
    },
    {
      id: 14,
      question: "Your ideal Saturday morning involves:",
      options: [
        { text: "Catching up on coursework following your weekly schedule", archetypes: { Anchor: 2, Logicor: 1 } },
        { text: "Exploring something new - a hobby, place, or interest", archetypes: { Seeker: 3, Spark: 2 } },
        { text: "Physical activity like sports, hiking, or working out", archetypes: { Kinetiq: 3, Flowist: 1 } },
        { text: "Whatever feels right in the moment without rigid plans", archetypes: { Flowist: 3, Resonant: 2 } }
      ]
    },
    {
      id: 15,
      question: "When collaborating with classmates on problem sets, you:",
      options: [
        { text: "Work through each problem step-by-step together", archetypes: { Logicor: 3, Anchor: 1 } },
        { text: "Contribute creative approaches others might not consider", archetypes: { Spark: 3, Dreamweaver: 1 } },
        { text: "Help connect different people's ideas into solutions", archetypes: { Synth: 3, Empathion: 2 } },
        { text: "Adapt your approach based on the group's energy", archetypes: { Resonant: 3, Flowist: 2 } }
      ]
    }
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const hasCompletedQuiz = localStorage.getItem('hasCompletedProfileQuiz');

    if (!token) {
      navigate('/login');
      return;
    }

    if (username) {
      setUserName(username);
    }

    if (hasCompletedQuiz) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleAnswer = (optionIndex) => {
    const selectedOption = questions[currentQuestion].options[optionIndex];
    const newAnswers = { ...answers, [currentQuestion]: optionIndex };
    setAnswers(newAnswers);

    const newScores = { ...archetypeScores };
    Object.entries(selectedOption.archetypes).forEach(([archetype, points]) => {
      newScores[archetype] = (newScores[archetype] || 0) + points;
    });
    setArchetypeScores(newScores);

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
      }, 300);
    } else {
      calculateAndSaveArchetype(newScores);
    }
  };

  const calculateAndSaveArchetype = async (scores) => {
    const sortedArchetypes = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([archetype]) => archetype);

    const primaryArchetype = sortedArchetypes[0];
    const secondaryArchetype = sortedArchetypes[1];

    const archetypeDescriptions = {
      Logicor: "You thrive on logical analysis and systematic problem-solving. You excel at breaking down complex concepts into manageable parts.",
      Flowist: "You learn best through dynamic, hands-on experiences. You adapt easily and prefer learning by doing.",
      Kinetiq: "You're a kinesthetic learner who needs movement and physical engagement to process information effectively.",
      Synth: "You naturally see connections between ideas and excel at integrating knowledge from different domains.",
      Dreamweaver: "You think in big pictures and future possibilities. Visual and imaginative approaches resonate with you.",
      Anchor: "You value structure, organization, and clear systems. You excel with well-defined goals and methodical approaches.",
      Spark: "You're driven by creativity and innovation. Novel ideas and expressive methods fuel your learning.",
      Empathion: "You connect deeply with emotional and interpersonal aspects of learning. You understand through empathy and meaning.",
      Seeker: "You're motivated by curiosity and the joy of discovery. You love exploring new topics and expanding knowledge.",
      Resonant: "You're highly adaptable and tune into different learning environments. You adjust your approach fluidly."
    };

    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:8001/save_archetype_profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          primary_archetype: primaryArchetype,
          secondary_archetype: secondaryArchetype,
          archetype_scores: scores,
          archetype_description: archetypeDescriptions[primaryArchetype]
        })
      });

      localStorage.setItem('hasCompletedProfileQuiz', 'true');
      setIsComplete(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error saving archetype:', error);
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (isComplete) {
    const primaryArchetype = Object.entries(archetypeScores)
      .sort(([, a], [, b]) => b - a)[0][0];

    return (
      <div className="profile-quiz-page">
        <div className="quiz-completion">
          <div className="completion-icon">✓</div>
          <h2>Profile Complete!</h2>
          <p>Your learning archetype: <strong>{primaryArchetype}</strong></p>
          <p className="completion-message">
            Your AI assistant will now adapt to your unique learning style.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-quiz-page">
      <div className="quiz-container">
        <div className="quiz-header">
          <h1 className="quiz-title">Discover Your Learning Archetype</h1>
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="quiz-progress-text">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </div>

        <div className="quiz-content">
          <div className="question-card">
            <h2 className="question-text">{questions[currentQuestion].question}</h2>
            
            <div className="options-grid">
              {questions[currentQuestion].options.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${answers[currentQuestion] === index ? 'selected' : ''}`}
                  onClick={() => handleAnswer(index)}
                >
                  <span className="option-number">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileQuiz;