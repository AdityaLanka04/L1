import React, { useState, useEffect, useRef, useCallback } from 'react';

function App() {
  // Game state
  const [gameState, setGameState] = useState({
    velocity: 0,           // fraction of speed of light (0-0.999)
    position: 0,           // position along track
    properTime: 0,         // time experienced by the racer
    coordinateTime: 0,     // time measured by stationary observer
    energy: 1000,          // fuel/energy units
    isRacing: false,
    raceDistance: 10,      // light-years
    lapCount: 0,
    bestLapTime: null
  });

  // Physics constants
  const SPEED_OF_LIGHT = 299792458; // m/s
  const MAX_VELOCITY = 0.999; // 99.9% speed of light
  const ENERGY_CONSUMPTION_RATE = 0.5;
  const ACCELERATION_RATE = 0.001;
  const DECELERATION_RATE = 0.002;

  // Visual effects
  const [stars, setStars] = useState([]);
  const [doppler, setDoppler] = useState({ red: 0, blue: 0 });
  const [lengthContraction, setLengthContraction] = useState(1);
  const [timeDilation, setTimeDilation] = useState(1);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const gameLoopRef = useRef(null);

  // Calculate relativistic effects
  const calculateRelativisticEffects = useCallback((v) => {
    // Lorentz factor (gamma)
    const gamma = 1 / Math.sqrt(1 - v * v);
    
    // Time dilation factor
    const timeDilationFactor = gamma;
    
    // Length contraction factor
    const lengthContractionFactor = Math.sqrt(1 - v * v);
    
    // Relativistic momentum factor
    const momentumFactor = gamma * v;
    
    // Doppler shift for colors
    const dopplerFactor = Math.sqrt((1 + v) / (1 - v));
    
    return {
      gamma,
      timeDilationFactor,
      lengthContractionFactor,
      momentumFactor,
      dopplerFactor
    };
  }, []);

  // Initialize stars for visual effect
  useEffect(() => {
    const initialStars = [];
    for (let i = 0; i < 200; i++) {
      initialStars.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        z: Math.random() * 1000,
        originalZ: Math.random() * 1000,
        brightness: Math.random(),
        id: i
      });
    }
    setStars(initialStars);
  }, []);

  // Main game loop
  useEffect(() => {
    if (!gameState.isRacing) return;

    const gameLoop = setInterval(() => {
      setGameState(prevState => {
        const effects = calculateRelativisticEffects(prevState.velocity);
        
        // Update proper time (time experienced by racer)
        const properTimeDelta = 0.1 / effects.timeDilationFactor;
        
        // Update coordinate time (time measured by observer)
        const coordinateTimeDelta = 0.1;
        
        // Update position
        const positionDelta = prevState.velocity * 0.1;
        
        // Energy consumption increases with velocity
        const energyConsumption = ENERGY_CONSUMPTION_RATE * (1 + prevState.velocity * 5);
        
        const newState = {
          ...prevState,
          properTime: prevState.properTime + properTimeDelta,
          coordinateTime: prevState.coordinateTime + coordinateTimeDelta,
          position: prevState.position + positionDelta,
          energy: Math.max(0, prevState.energy - energyConsumption)
        };

        // Check for lap completion
        if (newState.position >= prevState.raceDistance) {
          const lapTime = newState.coordinateTime;
          const newLapCount = prevState.lapCount + 1;
          const newBestTime = !prevState.bestLapTime || lapTime < prevState.bestLapTime 
            ? lapTime : prevState.bestLapTime;

          return {
            ...newState,
            position: 0,
            coordinateTime: 0,
            properTime: 0,
            lapCount: newLapCount,
            bestLapTime: newBestTime
          };
        }

        // Stop if out of energy
        if (newState.energy <= 0) {
          return {
            ...newState,
            velocity: Math.max(0, newState.velocity - DECELERATION_RATE * 2),
            isRacing: newState.velocity > 0.001
          };
        }

        return newState;
      });
    }, 100);

    gameLoopRef.current = gameLoop;
    return () => clearInterval(gameLoop);
  }, [gameState.isRacing, calculateRelativisticEffects]);

  // Update visual effects based on velocity
  useEffect(() => {
    const effects = calculateRelativisticEffects(gameState.velocity);
    
    setTimeDilation(effects.timeDilationFactor);
    setLengthContraction(effects.lengthContractionFactor);
    
    // Doppler shift colors
    const redShift = Math.max(0, 1 - effects.dopplerFactor);
    const blueShift = Math.max(0, effects.dopplerFactor - 1);
    setDoppler({ red: redShift, blue: blueShift });

    // Update star field for relativistic effects
    setStars(prevStars => prevStars.map(star => ({
      ...star,
      z: star.originalZ * effects.lengthContractionFactor,
      brightness: star.brightness * (1 + gameState.velocity)
    })));
  }, [gameState.velocity, calculateRelativisticEffects]);

  // Controls
  const accelerate = () => {
    if (gameState.energy > 0 && gameState.velocity < MAX_VELOCITY) {
      setGameState(prev => ({
        ...prev,
        velocity: Math.min(MAX_VELOCITY, prev.velocity + ACCELERATION_RATE)
      }));
    }
  };

  const decelerate = () => {
    setGameState(prev => ({
      ...prev,
      velocity: Math.max(0, prev.velocity - DECELERATION_RATE)
    }));
  };

  const startRace = () => {
    setGameState(prev => ({
      ...prev,
      isRacing: true,
      position: 0,
      properTime: 0,
      coordinateTime: 0,
      energy: 1000
    }));
  };

  const stopRace = () => {
    setGameState(prev => ({ ...prev, isRacing: false }));
  };

  const refuel = () => {
    setGameState(prev => ({ ...prev, energy: 1000 }));
  };

  // Draw game visualization
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear with space background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#000011');
    gradient.addColorStop(1, '#000033');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Apply relativistic visual effects
    const effects = calculateRelativisticEffects(gameState.velocity);

    // Draw star field with relativistic effects
    stars.forEach(star => {
      const screenX = (star.x - width/2) * (1000 / (star.z + 1000)) + width/2;
      const screenY = (star.y - height/2) * (1000 / (star.z + 1000)) + height/2;

      if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
        const size = Math.max(1, 3 * star.brightness * (1000 / (star.z + 500)));
        const alpha = Math.min(1, star.brightness * (1 + gameState.velocity * 2));

        // Doppler shift effect on star colors
        if (gameState.velocity > 0.1) {
          const hue = doppler.blue > 0 ? 240 : (doppler.red > 0 ? 0 : 60);
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, 2 * Math.PI);
        ctx.fill();

        // Star trails at high velocity
        if (gameState.velocity > 0.5) {
          const trailLength = gameState.velocity * 50;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(screenX - trailLength, screenY);
          ctx.stroke();
        }
      }
    });

    // Draw ship
    const shipX = width / 2;
    const shipY = height * 0.8;
    
    // Length contraction effect on ship
    const shipLength = 60 * lengthContraction;
    const shipHeight = 20;

    ctx.fillStyle = '#00aaff';
    ctx.fillRect(shipX - shipLength/2, shipY - shipHeight/2, shipLength, shipHeight);
    
    // Engine glow
    if (gameState.velocity > 0) {
      const glowIntensity = gameState.velocity;
      ctx.fillStyle = `rgba(0, 255, 255, ${glowIntensity})`;
      ctx.beginPath();
      ctx.arc(shipX - shipLength/2, shipY, 10 * glowIntensity, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Warp effect at high velocities
    if (gameState.velocity > 0.8) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${(gameState.velocity - 0.8) * 5})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * 2 * Math.PI;
        const radius = 100 + Math.sin(Date.now() * 0.01 + i) * 20;
        const x = shipX + Math.cos(angle) * radius;
        const y = shipY + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Speed lines
    if (gameState.velocity > 0.3) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${gameState.velocity * 0.5})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * width;
        const lineLength = gameState.velocity * 100;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - lineLength, height);
        ctx.stroke();
      }
    }
  }, [stars, gameState.velocity, lengthContraction, doppler, calculateRelativisticEffects]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawGame();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'Space':
          e.preventDefault();
          accelerate();
          break;
        case 'ArrowDown':
          e.preventDefault();
          decelerate();
          break;
        case 'KeyR':
          refuel();
          break;
        case 'KeyS':
          if (gameState.isRacing) {
            stopRace();
          } else {
            startRace();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isRacing, gameState.energy, gameState.velocity]);

  // Format numbers
  const formatNumber = (num, decimals = 2) => {
    return typeof num === 'number' ? num.toFixed(decimals) : '0.00';
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="text-center py-4 bg-gradient-to-r from-blue-900 to-purple-900">
        <h1 className="text-4xl font-bold mb-2">🚀 Relativistic Racing</h1>
        <p className="text-lg text-gray-300">Experience time dilation as you approach light speed!</p>
      </header>

      <div className="flex">
        {/* Left Panel - Controls and Physics */}
        <div className="w-80 bg-gray-900 p-6 space-y-6">
          {/* Race Controls */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-xl font-bold mb-4">Race Control</h3>
            <div className="space-y-3">
              <button
                onClick={gameState.isRacing ? stopRace : startRace}
                className={`w-full py-2 px-4 rounded font-bold ${
                  gameState.isRacing 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {gameState.isRacing ? '⏹️ Stop Race' : '🏁 Start Race'}
              </button>
              
              <button
                onClick={refuel}
                disabled={gameState.energy >= 1000}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
              >
                ⛽ Refuel
              </button>

              <div className="text-sm text-gray-400">
                <p>🔺 Up/Space: Accelerate</p>
                <p>🔻 Down: Decelerate</p>
                <p>R: Refuel • S: Start/Stop</p>
              </div>
            </div>
          </div>

          {/* Velocity and Energy */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-xl font-bold mb-4">Ship Status</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span>Velocity:</span>
                  <span className="text-cyan-400">
                    {formatNumber(gameState.velocity, 3)}c
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatNumber(gameState.velocity * SPEED_OF_LIGHT / 1000)} km/s
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Energy:</span>
                  <span className={gameState.energy < 200 ? 'text-red-400' : 'text-green-400'}>
                    {Math.floor(gameState.energy)}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(gameState.energy / 1000) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <span>Position:</span>
                <span className="text-yellow-400">
                  {formatNumber(gameState.position, 1)} / {gameState.raceDistance} ly
                </span>
              </div>
            </div>
          </div>

          {/* Relativistic Effects */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-xl font-bold mb-4">⚛️ Relativistic Effects</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Time Dilation (γ):</span>
                <span className="text-purple-400">
                  {formatNumber(timeDilation, 2)}×
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Length Contraction:</span>
                <span className="text-orange-400">
                  {formatNumber(lengthContraction, 3)}×
                </span>
              </div>

              <div className="text-xs text-gray-400 mt-3">
                <p><strong>Your Time:</strong> {formatTime(gameState.properTime)}</p>
                <p><strong>Earth Time:</strong> {formatTime(gameState.coordinateTime)}</p>
                <p><strong>Time Saved:</strong> {formatTime(gameState.coordinateTime - gameState.properTime)}</p>
              </div>

              {gameState.velocity > 0.1 && (
                <div className="mt-3 p-2 bg-blue-900 rounded text-xs">
                  <p className="text-blue-300">
                    {gameState.velocity > 0.5 
                      ? "🌟 Experiencing significant time dilation!"
                      : "⏰ Time is starting to slow down for you"
                    }
                  </p>
                </div>
              )}

              {gameState.velocity > 0.8 && (
                <div className="mt-2 p-2 bg-purple-900 rounded text-xs">
                  <p className="text-purple-300">
                    🌌 Length contraction is making everything appear shorter!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Race Statistics */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-xl font-bold mb-4">🏆 Race Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Laps Completed:</span>
                <span className="text-green-400">{gameState.lapCount}</span>
              </div>
              
              {gameState.bestLapTime && (
                <div className="flex justify-between">
                  <span>Best Lap Time:</span>
                  <span className="text-gold-400">{formatTime(gameState.bestLapTime)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Max Velocity:</span>
                <span className="text-cyan-400">
                  {formatNumber(MAX_VELOCITY, 3)}c
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full border border-gray-700"
          />

          {/* HUD Overlay */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-75 rounded-lg p-4">
            <div className="text-2xl font-mono">
              <div className="text-cyan-400">
                {formatNumber(gameState.velocity * 100, 1)}% light speed
              </div>
              <div className="text-sm text-gray-400">
                γ = {formatNumber(timeDilation, 2)}
              </div>
            </div>
          </div>

          {/* Speed Warning */}
          {gameState.velocity > 0.95 && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-red-900 border-2 border-red-500 rounded-lg p-6 text-center animate-pulse">
                <div className="text-3xl font-bold text-red-300 mb-2">
                  ⚠️ EXTREME RELATIVISTIC EFFECTS
                </div>
                <div className="text-red-400">
                  Approaching maximum velocity!
                </div>
              </div>
            </div>
          )}

          {/* Game Instructions */}
          {!gameState.isRacing && gameState.lapCount === 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-gray-900 bg-opacity-90 rounded-lg p-4 text-center">
                <h4 className="text-lg font-bold mb-2">🎮 How to Play</h4>
                <p className="text-sm text-gray-300 mb-2">
                  Race around the {gameState.raceDistance} light-year track and experience Einstein's relativity!
                </p>
                <p className="text-xs text-gray-400">
                  As you approach light speed, time dilates and space contracts.
                  The faster you go, the less time passes for you compared to observers on Earth!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;