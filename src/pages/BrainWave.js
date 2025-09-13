import React, { useState, useEffect, useRef } from 'react';

function App() {
  // Brain wave states
  const [brainwaves, setBrainwaves] = useState({
    delta: 20,    // 0.5-4 Hz - Deep sleep
    theta: 15,    // 4-8 Hz - Drowsy, meditative
    alpha: 25,    // 8-13 Hz - Relaxed, calm
    beta: 30,     // 13-30 Hz - Focused, alert
    gamma: 10     // 30-100 Hz - High cognitive function
  });

  // Mental states
  const [mentalState, setMentalState] = useState('balanced');
  const [targetState, setTargetState] = useState(null);
  const [gameMode, setGameMode] = useState('exploration');
  const [meditationTimer, setMeditationTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [biofeedbackScore, setBiofeedbackScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // EEG wave data for visualization
  const [waveData, setWaveData] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Predefined brain wave patterns
  const patterns = {
    deep_sleep: { delta: 80, theta: 15, alpha: 3, beta: 2, gamma: 0 },
    light_sleep: { delta: 50, theta: 35, alpha: 10, beta: 5, gamma: 0 },
    drowsy: { delta: 15, theta: 60, alpha: 20, beta: 5, gamma: 0 },
    meditative: { delta: 5, theta: 45, alpha: 40, beta: 8, gamma: 2 },
    relaxed: { delta: 5, theta: 15, alpha: 65, beta: 12, gamma: 3 },
    focused: { delta: 2, theta: 8, alpha: 25, beta: 55, gamma: 10 },
    alert: { delta: 1, theta: 4, alpha: 15, beta: 65, gamma: 15 },
    hyperactive: { delta: 0, theta: 2, alpha: 8, beta: 75, gamma: 15 },
    anxious: { delta: 1, theta: 5, alpha: 10, beta: 80, gamma: 4 },
    adhd: { delta: 5, theta: 45, alpha: 15, beta: 25, gamma: 10 }
  };

  // Brain wave frequencies (Hz)
  const frequencies = {
    delta: { min: 0.5, max: 4, color: '#8B5CF6' },    // Purple
    theta: { min: 4, max: 8, color: '#3B82F6' },      // Blue  
    alpha: { min: 8, max: 13, color: '#10B981' },     // Green
    beta: { min: 13, max: 30, color: '#F59E0B' },     // Orange
    gamma: { min: 30, max: 100, color: '#EF4444' }    // Red
  };

  // Update mental state based on brainwave patterns
  useEffect(() => {
    const determineMentalState = () => {
      const { delta, theta, alpha, beta, gamma } = brainwaves;
      
      if (delta > 60) return 'deep_sleep';
      if (delta > 35) return 'light_sleep';
      if (theta > 50) return 'drowsy';
      if (theta > 35 && alpha > 30) return 'meditative';
      if (alpha > 50) return 'relaxed';
      if (beta > 50 && gamma > 8) return 'focused';
      if (beta > 70) return 'alert';
      if (beta > 75 && gamma > 12) return 'hyperactive';
      if (beta > 75 && alpha < 15) return 'anxious';
      if (theta > 40 && beta < 30) return 'adhd';
      
      return 'balanced';
    };

    setMentalState(determineMentalState());
  }, [brainwaves]);

  // Generate wave data points for visualization
  useEffect(() => {
    const generateWaveData = () => {
      const dataPoints = [];
      const time = currentTime;
      
      Object.entries(brainwaves).forEach(([wave, amplitude]) => {
        const freq = frequencies[wave];
        const avgFreq = (freq.min + freq.max) / 2;
        
        // Generate sine wave with noise
        for (let i = 0; i < 200; i++) {
          const x = i;
          const baseWave = Math.sin((time + x) * avgFreq * 0.1) * (amplitude / 100);
          const noise = (Math.random() - 0.5) * 0.1 * (amplitude / 100);
          const y = baseWave + noise;
          
          dataPoints.push({ x, y, wave, amplitude: amplitude / 100 });
        }
      });
      
      setWaveData(dataPoints);
    };

    generateWaveData();
  }, [brainwaves, currentTime]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setCurrentTime(prev => prev + 0.1);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Meditation timer
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setMeditationTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Biofeedback scoring
  useEffect(() => {
    if (targetState && patterns[targetState]) {
      const target = patterns[targetState];
      let score = 0;
      let totalDiff = 0;
      
      Object.entries(target).forEach(([wave, targetValue]) => {
        const currentValue = brainwaves[wave];
        const diff = Math.abs(currentValue - targetValue);
        totalDiff += diff;
      });
      
      score = Math.max(0, 100 - totalDiff);
      setBiofeedbackScore(Math.round(score));
      
      // Update streak
      if (score > 80) {
        setStreak(prev => prev + 1);
      } else if (score < 60) {
        setStreak(0);
      }
    }
  }, [brainwaves, targetState]);

  // Handle brainwave adjustments
  const handleBrainwaveChange = (wave, value) => {
    const newValue = parseInt(value);
    const diff = newValue - brainwaves[wave];
    
    // Redistribute to maintain balance (total should be around 100)
    const otherWaves = Object.keys(brainwaves).filter(w => w !== wave);
    const adjustment = -diff / otherWaves.length;
    
    const newBrainwaves = { ...brainwaves };
    newBrainwaves[wave] = newValue;
    
    otherWaves.forEach(w => {
      newBrainwaves[w] = Math.max(0, Math.min(100, newBrainwaves[w] + adjustment));
    });
    
    setBrainwaves(newBrainwaves);
  };

  // Apply preset pattern
  const applyPattern = (patternName) => {
    setBrainwaves(patterns[patternName]);
  };

  // Start training session
  const startTraining = (target) => {
    setTargetState(target);
    setGameMode('training');
    setBiofeedbackScore(0);
    setStreak(0);
  };

  // Start meditation
  const startMeditation = () => {
    setIsTimerRunning(true);
    setMeditationTimer(0);
    setTargetState('meditative');
    setGameMode('meditation');
  };

  // Stop meditation
  const stopMeditation = () => {
    setIsTimerRunning(false);
    setGameMode('exploration');
    setTargetState(null);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get state info
  const getStateInfo = (state) => {
    const stateInfo = {
      deep_sleep: { emoji: '😴', description: 'Deep restorative sleep', color: 'text-purple-600' },
      light_sleep: { emoji: '🌙', description: 'Light sleep, dreaming', color: 'text-purple-400' },
      drowsy: { emoji: '😪', description: 'Drowsy, about to fall asleep', color: 'text-blue-400' },
      meditative: { emoji: '🧘', description: 'Deep meditation, inner peace', color: 'text-blue-600' },
      relaxed: { emoji: '😌', description: 'Calm and relaxed', color: 'text-green-600' },
      focused: { emoji: '🎯', description: 'Focused concentration', color: 'text-orange-600' },
      alert: { emoji: '👁️', description: 'Highly alert and attentive', color: 'text-orange-700' },
      hyperactive: { emoji: '⚡', description: 'Hyperactive, overstimulated', color: 'text-red-600' },
      anxious: { emoji: '😰', description: 'Anxious, stressed', color: 'text-red-700' },
      adhd: { emoji: '🌀', description: 'ADHD pattern detected', color: 'text-yellow-600' },
      balanced: { emoji: '⚖️', description: 'Balanced brain state', color: 'text-gray-600' }
    };
    return stateInfo[state] || stateInfo.balanced;
  };

  // Draw EEG waves on canvas
  const drawEEGWaves = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw waves
    const waveHeight = height / 5;
    Object.entries(brainwaves).forEach(([wave, amplitude], index) => {
      const freq = frequencies[wave];
      const yOffset = waveHeight * index + waveHeight / 2;
      
      ctx.strokeStyle = freq.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x += 2) {
        const avgFreq = (freq.min + freq.max) / 2;
        const baseWave = Math.sin((currentTime + x) * avgFreq * 0.02) * (amplitude / 100) * 20;
        const noise = (Math.random() - 0.5) * 2 * (amplitude / 100);
        const y = yOffset - baseWave - noise;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Label
      ctx.fillStyle = freq.color;
      ctx.font = '12px Arial';
      ctx.fillText(`${wave.toUpperCase()} (${amplitude}%)`, 5, yOffset - 25);
    });
  };

  // Update canvas
  useEffect(() => {
    drawEEGWaves();
  }, [brainwaves, currentTime]);

  // Render brainwave controls
  const renderBrainwaveControls = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {Object.entries(brainwaves).map(([wave, amplitude]) => {
        const freq = frequencies[wave];
        return (
          <div key={wave} className="bg-white rounded-lg shadow-lg p-4">
            <div className="text-center mb-3">
              <h3 className="font-bold text-lg capitalize" style={{ color: freq.color }}>
                {wave}
              </h3>
              <div className="text-xs text-gray-600">
                {freq.min}-{freq.max} Hz
              </div>
              <div className="text-2xl font-bold mt-2" style={{ color: freq.color }}>
                {amplitude}%
              </div>
            </div>
            
            <input
              type="range"
              min="0"
              max="100"
              value={amplitude}
              onChange={(e) => handleBrainwaveChange(wave, e.target.value)}
              className="w-full mb-2"
              style={{ accentColor: freq.color }}
            />
            
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${amplitude}%`,
                  backgroundColor: freq.color
                }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render EEG display
  const renderEEGDisplay = () => (
    <div className="bg-black rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-lg">Live EEG Pattern</h3>
        <div className="text-white text-sm">
          Frequency Analysis • Real-time
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full border border-gray-600 rounded"
      />
      <div className="grid grid-cols-5 gap-2 mt-2 text-xs">
        {Object.entries(frequencies).map(([wave, freq]) => (
          <div key={wave} className="text-center text-white">
            <div style={{ color: freq.color }} className="font-bold">
              {wave.toUpperCase()}
            </div>
            <div className="opacity-70">{freq.min}-{freq.max}Hz</div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render mental state display
  const renderMentalState = () => {
    const stateInfo = getStateInfo(mentalState);
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-6xl mb-4">{stateInfo.emoji}</div>
        <h3 className={`text-2xl font-bold mb-2 ${stateInfo.color}`}>
          {mentalState.replace('_', ' ').toUpperCase()}
        </h3>
        <p className="text-gray-600">{stateInfo.description}</p>
        
        {gameMode === 'training' && targetState && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-800 mb-2">Training Mode</div>
            <div className="text-2xl font-bold text-blue-600 mb-1">
              Score: {biofeedbackScore}/100
            </div>
            <div className="text-sm text-blue-700">
              Target: {targetState.replace('_', ' ')}
            </div>
            {streak > 0 && (
              <div className="text-sm text-green-600 mt-2">
                🔥 Streak: {streak}
              </div>
            )}
          </div>
        )}
        
        {gameMode === 'meditation' && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-800 mb-2">Meditation Session</div>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatTime(meditationTimer)}
            </div>
            <div className="text-sm text-green-700">
              Keep alpha and theta waves elevated
            </div>
            <button
              onClick={stopMeditation}
              className="mt-3 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              End Session
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render pattern presets
  const renderPatternPresets = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Brain State Presets</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(patterns).map(([patternName, pattern]) => {
          const stateInfo = getStateInfo(patternName);
          return (
            <button
              key={patternName}
              onClick={() => applyPattern(patternName)}
              className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
            >
              <div className="text-2xl mb-1">{stateInfo.emoji}</div>
              <div className="text-xs font-medium capitalize">
                {patternName.replace('_', ' ')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Render training modes
  const renderTrainingModes = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Biofeedback Training</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 border rounded-lg">
          <div className="text-3xl mb-2">🧘‍♀️</div>
          <h4 className="font-bold mb-2">Meditation Training</h4>
          <p className="text-sm text-gray-600 mb-3">
            Train to achieve meditative alpha/theta states
          </p>
          <button
            onClick={startMeditation}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Start Meditation
          </button>
        </div>
        
        <div className="text-center p-4 border rounded-lg">
          <div className="text-3xl mb-2">🎯</div>
          <h4 className="font-bold mb-2">Focus Training</h4>
          <p className="text-sm text-gray-600 mb-3">
            Enhance concentration and attention
          </p>
          <button
            onClick={() => startTraining('focused')}
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
          >
            Train Focus
          </button>
        </div>
        
        <div className="text-center p-4 border rounded-lg">
          <div className="text-3xl mb-2">😌</div>
          <h4 className="font-bold mb-2">Relaxation Training</h4>
          <p className="text-sm text-gray-600 mb-3">
            Learn to achieve calm alpha states
          </p>
          <button
            onClick={() => startTraining('relaxed')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Train Relaxation
          </button>
        </div>
      </div>
      
      {gameMode === 'training' && (
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setGameMode('exploration');
              setTargetState(null);
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Exit Training
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-800 mb-2">
            🧠 Brain Wave Pattern Matcher
          </h1>
          <p className="text-lg text-indigo-600">
            Explore EEG patterns, train your brainwaves, and optimize mental states
          </p>
        </header>

        <div className="space-y-8">
          {/* EEG Display */}
          {renderEEGDisplay()}

          {/* Current Mental State */}
          {renderMentalState()}

          {/* Brainwave Controls */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Brainwave Frequency Controls</h2>
            {renderBrainwaveControls()}
          </div>

          {/* Pattern Presets */}
          {renderPatternPresets()}

          {/* Training Modes */}
          {renderTrainingModes()}

          {/* Educational Info */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">Understanding Brainwaves</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
              {Object.entries(frequencies).map(([wave, freq]) => (
                <div key={wave} className="p-3 border rounded-lg">
                  <h4 className="font-bold capitalize mb-2" style={{ color: freq.color }}>
                    {wave} Waves
                  </h4>
                  <div className="text-xs text-gray-600 mb-2">
                    {freq.min}-{freq.max} Hz
                  </div>
                  <div className="text-xs">
                    {wave === 'delta' && 'Deep sleep, healing, regeneration'}
                    {wave === 'theta' && 'REM sleep, meditation, creativity'}
                    {wave === 'alpha' && 'Relaxation, calm awareness'}
                    {wave === 'beta' && 'Normal waking consciousness'}
                    {wave === 'gamma' && 'High-level cognitive processing'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-bold mb-2">Clinical Applications:</h4>
                <ul className="space-y-1 text-gray-700">
                  <li>• Neurofeedback therapy for ADHD</li>
                  <li>• Meditation and mindfulness training</li>
                  <li>• Sleep disorder diagnosis</li>
                  <li>• Peak performance training</li>
                  <li>• Anxiety and stress management</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-2">Natural Ways to Influence Brainwaves:</h4>
                <ul className="space-y-1 text-gray-700">
                  <li>• Meditation increases alpha and theta</li>
                  <li>• Exercise boosts beta and gamma</li>
                  <li>• Deep breathing promotes alpha waves</li>
                  <li>• Music can synchronize brainwaves</li>
                  <li>• Sleep deprivation disrupts all patterns</li>
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