import React, { useState, useEffect } from 'react';

function App() {
  // Neurotransmitter levels (0-100 scale)
  const [neurotransmitters, setNeurotransmitters] = useState({
    dopamine: 50,
    serotonin: 50,
    gaba: 50,
    norepinephrine: 50,
    acetylcholine: 50,
    endorphins: 50
  });

  // Mood and behavior indicators
  const [moodState, setMoodState] = useState({
    happiness: 50,
    anxiety: 50,
    focus: 50,
    energy: 50,
    sleep: 50,
    motivation: 50,
    memory: 50,
    stress: 50
  });

  // Conditions and disorders
  const [conditions, setConditions] = useState({
    depression: false,
    anxiety_disorder: false,
    adhd: false,
    insomnia: false,
    addiction_risk: false,
    cognitive_decline: false
  });

  // Lifestyle factors
  const [lifestyle, setLifestyle] = useState({
    exercise: 50,
    sleep_quality: 50,
    diet: 50,
    social_connection: 50,
    stress_level: 50,
    substance_use: 0
  });

  // Active scenario
  const [activeScenario, setActiveScenario] = useState(null);
  const [gameMode, setGameMode] = useState('free_play');
  const [targetMood, setTargetMood] = useState(null);
  const [score, setScore] = useState(0);

  // Update mood state based on neurotransmitter levels
  useEffect(() => {
    const calculateMood = () => {
      const { dopamine, serotonin, gaba, norepinephrine, acetylcholine, endorphins } = neurotransmitters;
      
      // Complex interactions between neurotransmitters
      const newMood = {
        happiness: Math.round((serotonin * 0.4 + dopamine * 0.3 + endorphins * 0.3)),
        anxiety: Math.round(100 - (gaba * 0.6 + serotonin * 0.4)),
        focus: Math.round((norepinephrine * 0.4 + acetylcholine * 0.4 + dopamine * 0.2)),
        energy: Math.round((norepinephrine * 0.5 + dopamine * 0.3 + endorphins * 0.2)),
        sleep: Math.round((gaba * 0.6 + serotonin * 0.4)),
        motivation: Math.round((dopamine * 0.6 + norepinephrine * 0.4)),
        memory: Math.round((acetylcholine * 0.7 + norepinephrine * 0.3)),
        stress: Math.round(100 - (gaba * 0.5 + serotonin * 0.3 + endorphins * 0.2))
      };

      // Apply lifestyle factor modifiers
      Object.keys(newMood).forEach(mood => {
        if (mood === 'happiness') {
          newMood[mood] += (lifestyle.exercise - 50) * 0.2;
          newMood[mood] += (lifestyle.social_connection - 50) * 0.15;
        }
        if (mood === 'anxiety') {
          newMood[mood] += (lifestyle.stress_level - 50) * 0.3;
          newMood[mood] -= (lifestyle.exercise - 50) * 0.1;
        }
        if (mood === 'sleep') {
          newMood[mood] += (lifestyle.sleep_quality - 50) * 0.4;
        }
        if (mood === 'energy') {
          newMood[mood] += (lifestyle.diet - 50) * 0.2;
          newMood[mood] -= lifestyle.substance_use * 0.3;
        }
        
        // Clamp values between 0-100
        newMood[mood] = Math.max(0, Math.min(100, Math.round(newMood[mood])));
      });

      setMoodState(newMood);
    };

    calculateMood();
  }, [neurotransmitters, lifestyle]);

  // Check for conditions based on neurotransmitter imbalances
  useEffect(() => {
    const checkConditions = () => {
      const { dopamine, serotonin, gaba, norepinephrine } = neurotransmitters;
      
      setConditions({
        depression: serotonin < 30 || dopamine < 25,
        anxiety_disorder: gaba < 30 || norepinephrine > 80,
        adhd: dopamine < 35 && norepinephrine < 40,
        insomnia: gaba < 25 || serotonin < 30,
        addiction_risk: dopamine > 85 || lifestyle.substance_use > 70,
        cognitive_decline: neurotransmitters.acetylcholine < 25
      });
    };

    checkConditions();
  }, [neurotransmitters, lifestyle]);

  // Predefined scenarios
  const scenarios = {
    depression: {
      name: "Depression Treatment",
      description: "Patient shows signs of major depression. Adjust neurotransmitters to improve mood.",
      initial: { dopamine: 20, serotonin: 15, gaba: 45, norepinephrine: 30, acetylcholine: 50, endorphins: 25 },
      target: { happiness: 70, anxiety: 30, motivation: 60 }
    },
    anxiety: {
      name: "Anxiety Management",
      description: "Patient has severe anxiety. Balance neurotransmitters to reduce anxiety and improve calm.",
      initial: { dopamine: 40, serotonin: 35, gaba: 20, norepinephrine: 85, acetylcholine: 50, endorphins: 30 },
      target: { anxiety: 25, stress: 30, sleep: 70 }
    },
    adhd: {
      name: "ADHD Focus Enhancement",
      description: "Patient has ADHD. Improve focus and attention while maintaining emotional balance.",
      initial: { dopamine: 25, serotonin: 45, gaba: 40, norepinephrine: 30, acetylcholine: 35, endorphins: 45 },
      target: { focus: 75, motivation: 70, anxiety: 40 }
    },
    addiction: {
      name: "Addiction Recovery",
      description: "Patient in addiction recovery. Restore natural reward pathways and reduce cravings.",
      initial: { dopamine: 90, serotonin: 30, gaba: 25, norepinephrine: 70, acetylcholine: 40, endorphins: 20 },
      target: { motivation: 60, happiness: 60, stress: 40 }
    }
  };

  // Handle neurotransmitter changes
  const handleNeurotransmitterChange = (nt, value) => {
    setNeurotransmitters(prev => ({
      ...prev,
      [nt]: parseInt(value)
    }));
  };

  // Handle lifestyle changes
  const handleLifestyleChange = (factor, value) => {
    setLifestyle(prev => ({
      ...prev,
      [factor]: parseInt(value)
    }));
  };

  // Start a scenario
  const startScenario = (scenarioKey) => {
    const scenario = scenarios[scenarioKey];
    setNeurotransmitters(scenario.initial);
    setTargetMood(scenario.target);
    setActiveScenario(scenarioKey);
    setGameMode('scenario');
    setScore(0);
  };

  // Calculate scenario score
  const calculateScore = () => {
    if (!targetMood) return 0;
    
    let totalScore = 0;
    let targetCount = 0;
    
    Object.entries(targetMood).forEach(([mood, target]) => {
      const current = moodState[mood];
      const difference = Math.abs(current - target);
      const moodScore = Math.max(0, 100 - difference * 2);
      totalScore += moodScore;
      targetCount++;
    });
    
    return Math.round(totalScore / targetCount);
  };

  // Get color for mood indicators
  const getMoodColor = (value, inverted = false) => {
    const normalizedValue = inverted ? 100 - value : value;
    if (normalizedValue >= 70) return 'bg-green-500';
    if (normalizedValue >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get neurotransmitter info
  const getNeurotransmitterInfo = (nt) => {
    const info = {
      dopamine: { name: 'Dopamine', icon: '🎯', color: 'bg-purple-500', function: 'Reward, motivation, pleasure' },
      serotonin: { name: 'Serotonin', icon: '😊', color: 'bg-blue-500', function: 'Mood, sleep, appetite' },
      gaba: { name: 'GABA', icon: '😌', color: 'bg-green-500', function: 'Calming, anti-anxiety' },
      norepinephrine: { name: 'Norepinephrine', icon: '⚡', color: 'bg-red-500', function: 'Alertness, arousal, fight-or-flight' },
      acetylcholine: { name: 'Acetylcholine', icon: '🧠', color: 'bg-indigo-500', function: 'Learning, memory, attention' },
      endorphins: { name: 'Endorphins', icon: '✨', color: 'bg-pink-500', function: 'Natural painkillers, euphoria' }
    };
    return info[nt];
  };

  // Render neurotransmitter controls
  const renderNeurotransmitterControls = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(neurotransmitters).map(([nt, level]) => {
        const info = getNeurotransmitterInfo(nt);
        return (
          <div key={nt} className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-2">{info.icon}</span>
              <div>
                <h3 className="font-bold text-lg">{info.name}</h3>
                <p className="text-xs text-gray-600">{info.function}</p>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Level: {level}</span>
                <span className={`px-2 py-1 rounded text-xs text-white ${
                  level < 30 ? 'bg-red-500' : level > 70 ? 'bg-orange-500' : 'bg-green-500'
                }`}>
                  {level < 30 ? 'Low' : level > 70 ? 'High' : 'Normal'}
                </span>
              </div>
              
              <input
                type="range"
                min="0"
                max="100"
                value={level}
                onChange={(e) => handleNeurotransmitterChange(nt, e.target.value)}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)`
                }}
              />
              
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
            
            <div className={`h-2 rounded-full ${info.color} opacity-20`}>
              <div 
                className={`h-full rounded-full ${info.color}`}
                style={{ width: `${level}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render mood indicators
  const renderMoodIndicators = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Mental State Indicators</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(moodState).map(([mood, value]) => {
          const isInverted = ['anxiety', 'stress'].includes(mood);
          const displayValue = isInverted ? 100 - value : value;
          const color = getMoodColor(value, isInverted);
          
          return (
            <div key={mood} className="text-center">
              <div className="mb-2">
                <div className={`w-16 h-16 rounded-full ${color} mx-auto flex items-center justify-center text-white font-bold text-lg`}>
                  {displayValue}
                </div>
              </div>
              <h4 className="font-medium capitalize text-sm">
                {mood.replace('_', ' ')}
              </h4>
              {targetMood && targetMood[mood] && (
                <div className="text-xs text-gray-500 mt-1">
                  Target: {isInverted ? 100 - targetMood[mood] : targetMood[mood]}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {gameMode === 'scenario' && (
        <div className="mt-6 text-center">
          <div className="text-2xl font-bold text-blue-600">
            Score: {calculateScore()}/100
          </div>
          <div className="text-sm text-gray-600">
            Match the target mood states to complete the scenario
          </div>
        </div>
      )}
    </div>
  );

  // Render conditions panel
  const renderConditions = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Potential Conditions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(conditions).map(([condition, present]) => (
          <div
            key={condition}
            className={`p-3 rounded-lg border-2 ${
              present 
                ? 'border-red-500 bg-red-50 text-red-800' 
                : 'border-green-500 bg-green-50 text-green-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">
                {condition.replace('_', ' ')}
              </span>
              <span className="text-lg">
                {present ? '⚠️' : '✅'}
              </span>
            </div>
            {present && (
              <div className="text-xs mt-1 opacity-80">
                Risk detected based on current levels
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Render lifestyle factors
  const renderLifestyleFactors = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Lifestyle Factors</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(lifestyle).map(([factor, value]) => (
          <div key={factor} className="space-y-2">
            <label className="block text-sm font-medium capitalize">
              {factor.replace('_', ' ')}: {value}
              {factor === 'substance_use' && value > 0 && '⚠️'}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => handleLifestyleChange(factor, e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render scenarios
  const renderScenarios = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Clinical Scenarios</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(scenarios).map(([key, scenario]) => (
          <div key={key} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-lg mb-2">{scenario.name}</h4>
            <p className="text-sm text-gray-600 mb-4">{scenario.description}</p>
            <button
              onClick={() => startScenario(key)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Start Scenario
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-800 mb-2">
            🧠 Neurotransmitter Balance Game
          </h1>
          <p className="text-lg text-indigo-600">
            Explore how brain chemistry affects mood, behavior, and mental health
          </p>
        </header>

        {/* Game Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow p-2">
            <button
              onClick={() => setGameMode('free_play')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                gameMode === 'free_play'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Free Play
            </button>
            <button
              onClick={() => setGameMode('scenario')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ml-2 ${
                gameMode === 'scenario'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Scenarios
            </button>
          </div>
        </div>

        {/* Active Scenario Info */}
        {activeScenario && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
            <h3 className="font-bold text-blue-800">
              Active: {scenarios[activeScenario].name}
            </h3>
            <p className="text-blue-700 text-sm">
              {scenarios[activeScenario].description}
            </p>
            <button
              onClick={() => {
                setActiveScenario(null);
                setTargetMood(null);
                setGameMode('free_play');
              }}
              className="mt-2 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Exit Scenario
            </button>
          </div>
        )}

        <div className="space-y-8">
          {/* Neurotransmitter Controls */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Neurotransmitter Levels</h2>
            {renderNeurotransmitterControls()}
          </div>

          {/* Mood Indicators */}
          {renderMoodIndicators()}

          {/* Two column layout for conditions and lifestyle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {renderConditions()}
            {renderLifestyleFactors()}
          </div>

          {/* Scenarios (only show in free play mode) */}
          {gameMode === 'free_play' && renderScenarios()}

          {/* Educational Info */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">Did You Know?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-bold mb-2">Neurotransmitter Facts:</h4>
                <ul className="space-y-1 text-gray-700">
                  <li>• Dopamine is crucial for motivation and reward processing</li>
                  <li>• Serotonin affects mood, sleep, and appetite regulation</li>
                  <li>• GABA is the brain's main inhibitory neurotransmitter</li>
                  <li>• Imbalances can lead to mental health conditions</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-2">Natural Ways to Balance:</h4>
                <ul className="space-y-1 text-gray-700">
                  <li>• Exercise increases dopamine and endorphins</li>
                  <li>• Meditation can boost GABA and serotonin</li>
                  <li>• Good sleep is essential for neurotransmitter production</li>
                  <li>• Social connections improve overall brain chemistry</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;