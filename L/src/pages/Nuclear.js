import React, { useState, useEffect, useRef, useCallback } from 'react';

function App() {
  // Reactor state
  const [reactorState, setReactorState] = useState({
    power: 0,              // MW
    temperature: 20,       // °C
    pressure: 1,          // atm
    neutronFlux: 0,       // neutrons/cm²/s
    criticality: 1.0,     // k-effective
    controlRodPosition: 50, // % inserted (50% = critical)
    moderatorTemp: 20,    // °C
    coolantFlow: 100,     // % flow rate
    fuelBurnup: 0,        // %
    xenonPoison: 0        // xenon-135 concentration
  });

  // Safety systems
  const [safetySystem, setSafetySystem] = useState({
    scram: false,         // Emergency shutdown
    coolantPumps: true,
    emergencyCooling: false,
    containment: true,
    radiation: 0.1        // mSv/h
  });

  // Simulation parameters
  const [isRunning, setIsRunning] = useState(false);
  const [timeStep, setTimeStep] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [reactorType, setReactorType] = useState('PWR'); // PWR, BWR, RBMK
  const [operatorActions, setOperatorActions] = useState([]);
  const [alarms, setAlarms] = useState([]);

  // Animation and visualization
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [neutronParticles, setNeutronParticles] = useState([]);

  // Reactor parameters by type
  const reactorTypes = {
    PWR: {
      name: "Pressurized Water Reactor",
      maxPower: 3400,
      operatingTemp: 320,
      operatingPressure: 155,
      description: "Most common reactor type, uses enriched uranium"
    },
    BWR: {
      name: "Boiling Water Reactor",
      maxPower: 3300,
      operatingTemp: 285,
      operatingPressure: 75,
      description: "Water boils in reactor core, simpler design"
    },
    RBMK: {
      name: "RBMK Reactor",
      maxPower: 3200,
      operatingTemp: 280,
      operatingPressure: 65,
      description: "Graphite-moderated, positive void coefficient"
    }
  };

  // Physics calculations
  const calculateReactorPhysics = useCallback(() => {
    const { controlRodPosition, moderatorTemp, coolantFlow, fuelBurnup, xenonPoison } = reactorState;
    const reactorParams = reactorTypes[reactorType];
    
    // Calculate k-effective (criticality factor)
    let keff = 1.0;
    
    // Control rod reactivity (negative reactivity when inserted)
    keff -= (controlRodPosition / 100) * 0.3;
    
    // Temperature coefficient (negative for PWR/BWR, positive for RBMK)
    const tempCoeff = reactorType === 'RBMK' ? 0.00002 : -0.00005;
    keff += tempCoeff * (moderatorTemp - 20);
    
    // Fuel burnup reduces reactivity
    keff -= fuelBurnup * 0.002;
    
    // Xenon poisoning (peak at ~6 hours after shutdown)
    keff -= xenonPoison * 0.001;
    
    // Void coefficient (positive for RBMK, negative for others)
    const voidFraction = Math.max(0, (reactorState.temperature - 100) / 200);
    if (reactorType === 'RBMK') {
      keff += voidFraction * 0.003; // Positive void coefficient
    } else {
      keff -= voidFraction * 0.002; // Negative void coefficient
    }
    
    // Calculate neutron flux and power
    let newPower = reactorState.power;
    let newFlux = reactorState.neutronFlux;
    
    if (keff > 1.0) {
      // Supercritical - power increases exponentially
      const reactivityInsertion = (keff - 1.0) * 100; // cents
      newPower *= Math.exp(reactivityInsertion * 0.01);
      newFlux = newPower * 1e13; // Rough conversion
    } else if (keff < 1.0) {
      // Subcritical - power decreases
      const reactivityRemoval = (1.0 - keff) * 100;
      newPower *= Math.exp(-reactivityRemoval * 0.01);
      newFlux = newPower * 1e13;
    }
    
    // Calculate temperature from power
    let newTemp = reactorState.temperature;
    const heatGeneration = newPower * reactorParams.maxPower / 100;
    const heatRemoval = coolantFlow * (newTemp - 20) * 0.1;
    const tempChange = (heatGeneration - heatRemoval) * 0.001;
    newTemp += tempChange;
    
    // Calculate pressure (increases with temperature)
    const newPressure = 1 + (newTemp - 20) * 0.01;
    
    // Update xenon concentration (simplified)
    let newXenon = xenonPoison;
    if (newPower > 50) {
      newXenon += 0.1; // Xenon builds up during operation
    } else {
      newXenon = Math.max(0, newXenon - 0.05); // Decays when shut down
    }
    
    // Fuel burnup
    const newBurnup = fuelBurnup + (newPower / reactorParams.maxPower) * 0.001;
    
    return {
      power: Math.max(0, Math.min(120, newPower)), // Max 120% power
      temperature: Math.max(20, newTemp),
      pressure: Math.max(1, newPressure),
      neutronFlux: Math.max(0, newFlux),
      criticality: keff,
      moderatorTemp: newTemp * 0.9, // Moderator slightly cooler
      fuelBurnup: Math.min(100, newBurnup),
      xenonPoison: Math.min(100, newXenon)
    };
  }, [reactorState, reactorType]);

  // Check for alarms and safety conditions
  const checkSafety = useCallback((newState) => {
    const newAlarms = [];
    let newRadiation = safetySystem.radiation;
    
    // High power alarm
    if (newState.power > 100) {
      newAlarms.push({ type: 'HIGH_POWER', message: 'Reactor power exceeds 100%', severity: 'critical' });
    }
    
    // High temperature alarm
    const maxTemp = reactorTypes[reactorType].operatingTemp;
    if (newState.temperature > maxTemp * 1.1) {
      newAlarms.push({ type: 'HIGH_TEMP', message: 'Core temperature critical', severity: 'critical' });
    }
    
    // Criticality alarm
    if (newState.criticality > 1.05) {
      newAlarms.push({ type: 'SUPERCRITICAL', message: 'Reactor supercritical', severity: 'critical' });
    }
    
    // Loss of coolant
    if (reactorState.coolantFlow < 50) {
      newAlarms.push({ type: 'LOCA', message: 'Loss of coolant accident', severity: 'critical' });
    }
    
    // Calculate radiation based on power and containment
    newRadiation = Math.max(0.1, newState.power * 0.01);
    if (!safetySystem.containment) {
      newRadiation *= 100; // Massive radiation release
    }
    
    // Auto-SCRAM conditions
    let autoScram = safetySystem.scram;
    if (newState.power > 115 || newState.temperature > maxTemp * 1.2 || newRadiation > 100) {
      autoScram = true;
      newAlarms.push({ type: 'AUTO_SCRAM', message: 'Automatic reactor shutdown activated', severity: 'critical' });
    }
    
    setAlarms(newAlarms);
    setSafetySystem(prev => ({
      ...prev,
      scram: autoScram,
      radiation: newRadiation,
      emergencyCooling: newState.temperature > maxTemp * 1.15
    }));
    
    return autoScram;
  }, [reactorState, reactorType, safetySystem]);

  // Main simulation loop
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setReactorState(prevState => {
        // Apply SCRAM if activated
        let newState = { ...prevState };
        if (safetySystem.scram) {
          newState.controlRodPosition = 100; // Insert all control rods
        }
        
        // Calculate new reactor physics
        const calculatedState = calculateReactorPhysics();
        newState = { ...newState, ...calculatedState };
        
        // Check safety systems
        checkSafety(newState);
        
        return newState;
      });
      
      setElapsedTime(prev => prev + timeStep);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isRunning, timeStep, calculateReactorPhysics, checkSafety, safetySystem.scram]);

  // Generate neutron particles for visualization
  useEffect(() => {
    if (reactorState.power > 0) {
      const particleCount = Math.min(50, Math.floor(reactorState.power / 2));
      const newParticles = [];
      
      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: Math.random(),
          x: 200 + Math.random() * 200,
          y: 150 + Math.random() * 150,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 1.0
        });
      }
      
      setNeutronParticles(newParticles);
    } else {
      setNeutronParticles([]);
    }
  }, [reactorState.power]);

  // Control functions
  const adjustControlRods = (delta) => {
    if (safetySystem.scram) return;
    
    setReactorState(prev => ({
      ...prev,
      controlRodPosition: Math.max(0, Math.min(100, prev.controlRodPosition + delta))
    }));
    
    addOperatorAction(`Control rods ${delta > 0 ? 'inserted' : 'withdrawn'} ${Math.abs(delta)}%`);
  };

  const adjustCoolantFlow = (delta) => {
    setReactorState(prev => ({
      ...prev,
      coolantFlow: Math.max(0, Math.min(150, prev.coolantFlow + delta))
    }));
    
    addOperatorAction(`Coolant flow ${delta > 0 ? 'increased' : 'decreased'} to ${reactorState.coolantFlow + delta}%`);
  };

  const executeScram = () => {
    setSafetySystem(prev => ({ ...prev, scram: true }));
    addOperatorAction('EMERGENCY SHUTDOWN (SCRAM) ACTIVATED');
  };

  const resetScram = () => {
    if (reactorState.power < 5 && reactorState.temperature < reactorTypes[reactorType].operatingTemp) {
      setSafetySystem(prev => ({ ...prev, scram: false }));
      addOperatorAction('SCRAM reset - reactor ready for startup');
    }
  };

  const addOperatorAction = (action) => {
    const timestamp = new Date().toLocaleTimeString();
    setOperatorActions(prev => [
      { time: timestamp, action, id: Date.now() },
      ...prev.slice(0, 9) // Keep last 10 actions
    ]);
  };

  // Preset scenarios
  const loadScenario = (scenario) => {
    switch (scenario) {
      case 'startup':
        setReactorState(prev => ({
          ...prev,
          power: 0,
          temperature: 20,
          controlRodPosition: 95,
          coolantFlow: 100,
          fuelBurnup: 0,
          xenonPoison: 0
        }));
        setSafetySystem(prev => ({ ...prev, scram: false }));
        addOperatorAction('Reactor startup sequence initiated');
        break;
        
      case 'normal_operation':
        setReactorState(prev => ({
          ...prev,
          power: 75,
          temperature: reactorTypes[reactorType].operatingTemp * 0.9,
          controlRodPosition: 45,
          coolantFlow: 100,
          fuelBurnup: 25,
          xenonPoison: 20
        }));
        break;
        
      case 'xenon_poisoning':
        setReactorState(prev => ({
          ...prev,
          power: 30,
          controlRodPosition: 35,
          xenonPoison: 80
        }));
        addOperatorAction('Reactor in xenon-poisoned state');
        break;
        
      case 'emergency':
        setReactorState(prev => ({
          ...prev,
          power: 110,
          temperature: reactorTypes[reactorType].operatingTemp * 1.15,
          coolantFlow: 60
        }));
        addOperatorAction('Emergency scenario loaded - high power, reduced cooling');
        break;
    }
  };

  // Draw reactor core visualization
  const drawReactorCore = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw reactor vessel
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width/2, height/2, 180, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw fuel assemblies
    const fuelColor = `hsl(${Math.max(0, 60 - reactorState.temperature/10)}, 100%, ${Math.min(80, 30 + reactorState.power/2)}%)`;
    ctx.fillStyle = fuelColor;
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const x = width/2 - 80 + i * 20;
        const y = height/2 - 80 + j * 20;
        const distance = Math.sqrt((x - width/2)**2 + (y - height/2)**2);
        
        if (distance < 160) {
          ctx.fillRect(x, y, 15, 15);
          
          // Add glow effect for high power
          if (reactorState.power > 50) {
            ctx.shadowColor = fuelColor;
            ctx.shadowBlur = 10;
            ctx.fillRect(x, y, 15, 15);
            ctx.shadowBlur = 0;
          }
        }
      }
    }
    
    // Draw control rods
    ctx.fillStyle = '#333';
    const rodInsertion = reactorState.controlRodPosition / 100;
    
    for (let i = 1; i < 8; i += 2) {
      for (let j = 1; j < 8; j += 2) {
        const x = width/2 - 80 + i * 20;
        const y = height/2 - 80 + j * 20;
        const distance = Math.sqrt((x - width/2)**2 + (y - height/2)**2);
        
        if (distance < 160) {
          const rodHeight = 15 * rodInsertion;
          ctx.fillRect(x, y, 15, rodHeight);
        }
      }
    }
    
    // Draw neutron particles
    neutronParticles.forEach(particle => {
      ctx.fillStyle = `rgba(255, 255, 0, ${particle.life})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Draw temperature visualization
    if (reactorState.temperature > 100) {
      const alpha = Math.min(0.3, (reactorState.temperature - 100) / 1000);
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(width/2, height/2, 180, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawReactorCore();
      
      // Update neutron particles
      setNeutronParticles(prev => prev.map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life - 0.02
      })).filter(p => p.life > 0));
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [reactorState, neutronParticles]);

  // Format numbers
  const formatNumber = (num, decimals = 1) => {
    return typeof num === 'number' ? num.toFixed(decimals) : '0.0';
  };

  // Get status color
  const getStatusColor = (value, normal, warning, critical) => {
    if (value >= critical) return 'text-red-500';
    if (value >= warning) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">
            ⚛️ Nuclear Reactor Control Simulator
          </h1>
          <p className="text-lg text-gray-300">
            Control criticality, manage chain reactions, ensure safe operation
          </p>
        </header>

        {/* Reactor Type Selection */}
        <div className="mb-6">
          <div className="flex justify-center space-x-4">
            {Object.entries(reactorTypes).map(([type, info]) => (
              <button
                key={type}
                onClick={() => setReactorType(type)}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  reactorType === type
                    ? 'border-blue-500 bg-blue-900'
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="font-bold">{type}</div>
                <div className="text-xs text-gray-300">{info.maxPower} MW</div>
              </button>
            ))}
          </div>
          <div className="text-center mt-2 text-sm text-gray-400">
            {reactorTypes[reactorType].description}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Reactor Status */}
          <div className="space-y-6">
            {/* Main Parameters */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Reactor Parameters</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Power:</span>
                  <span className={getStatusColor(reactorState.power, 75, 100, 110)}>
                    {formatNumber(reactorState.power)}% ({formatNumber(reactorState.power * reactorTypes[reactorType].maxPower / 100)} MW)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Temperature:</span>
                  <span className={getStatusColor(reactorState.temperature, reactorTypes[reactorType].operatingTemp * 0.9, reactorTypes[reactorType].operatingTemp * 1.1, reactorTypes[reactorType].operatingTemp * 1.2)}>
                    {formatNumber(reactorState.temperature)}°C
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pressure:</span>
                  <span className="text-blue-400">{formatNumber(reactorState.pressure)} atm</span>
                </div>
                <div className="flex justify-between">
                  <span>Criticality (k-eff):</span>
                  <span className={getStatusColor(reactorState.criticality, 1.0, 1.02, 1.05)}>
                    {formatNumber(reactorState.criticality, 3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Neutron Flux:</span>
                  <span className="text-purple-400">{formatNumber(reactorState.neutronFlux, 0)} n/cm²/s</span>
                </div>
              </div>
            </div>

            {/* Control Systems */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Control Systems</h3>
              
              {/* Control Rods */}
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span>Control Rods:</span>
                  <span>{formatNumber(reactorState.controlRodPosition)}% inserted</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => adjustControlRods(5)}
                    disabled={safetySystem.scram}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm"
                  >
                    Insert +5%
                  </button>
                  <button
                    onClick={() => adjustControlRods(-5)}
                    disabled={safetySystem.scram}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
                  >
                    Withdraw -5%
                  </button>
                </div>
              </div>

              {/* Coolant Flow */}
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span>Coolant Flow:</span>
                  <span className={getStatusColor(100 - reactorState.coolantFlow, 25, 50, 80)}>
                    {formatNumber(reactorState.coolantFlow)}%
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => adjustCoolantFlow(10)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    Increase +10%
                  </button>
                  <button
                    onClick={() => adjustCoolantFlow(-10)}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm"
                  >
                    Decrease -10%
                  </button>
                </div>
              </div>

              {/* Emergency Controls */}
              <div className="border-t border-gray-600 pt-4">
                <div className="flex space-x-2 mb-3">
                  <button
                    onClick={executeScram}
                    className="flex-1 py-2 bg-red-700 hover:bg-red-800 rounded font-bold"
                  >
                    🚨 SCRAM
                  </button>
                  <button
                    onClick={resetScram}
                    disabled={reactorState.power > 5}
                    className="flex-1 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-600 rounded"
                  >
                    Reset
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  SCRAM: Emergency reactor shutdown
                </div>
              </div>
            </div>

            {/* Additional Parameters */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Advanced Parameters</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Fuel Burnup:</span>
                  <span className="text-yellow-400">{formatNumber(reactorState.fuelBurnup)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Xenon Poisoning:</span>
                  <span className="text-purple-400">{formatNumber(reactorState.xenonPoison)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Moderator Temp:</span>
                  <span className="text-cyan-400">{formatNumber(reactorState.moderatorTemp)}°C</span>
                </div>
                <div className="flex justify-between">
                  <span>Radiation Level:</span>
                  <span className={getStatusColor(safetySystem.radiation, 1, 10, 100)}>
                    {formatNumber(safetySystem.radiation)} mSv/h
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Reactor Core Visualization */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Reactor Core</h3>
              <canvas
                ref={canvasRef}
                width={400}
                height={400}
                className="w-full border border-gray-600 rounded"
              />
              <div className="mt-4 text-xs text-gray-400 text-center">
                Yellow squares: Fuel assemblies • Dark squares: Control rods • Yellow dots: Neutrons
              </div>
            </div>

            {/* Simulation Controls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Simulation Control</h3>
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className={`px-4 py-2 rounded font-bold ${
                    isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isRunning ? '⏸️ Pause' : '▶️ Start'}
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-sm">Speed:</span>
                  <select
                    value={timeStep}
                    onChange={(e) => setTimeStep(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                  </select>
                </div>
              </div>
              
              <div className="text-sm text-gray-400">
                Runtime: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
              </div>
            </div>
          </div>

          {/* Right Panel - Alarms and Logs */}
          <div className="space-y-6">
            {/* Safety Status */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Safety Systems</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>SCRAM Status:</span>
                  <span className={safetySystem.scram ? 'text-red-500' : 'text-green-500'}>
                    {safetySystem.scram ? '🔴 ACTIVE' : '🟢 READY'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Coolant Pumps:</span>
                  <span className={safetySystem.coolantPumps ? 'text-green-500' : 'text-red-500'}>
                    {safetySystem.coolantPumps ? '🟢 RUNNING' : '🔴 STOPPED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Emergency Cooling:</span>
                  <span className={safetySystem.emergencyCooling ? 'text-yellow-500' : 'text-gray-500'}>
                    {safetySystem.emergencyCooling ? '🟡 ACTIVE' : '⚪ STANDBY'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Containment:</span>
                  <span className={safetySystem.containment ? 'text-green-500' : 'text-red-500'}>
                    {safetySystem.containment ? '🟢 INTACT' : '🔴 BREACH'}
                  </span>
                </div>
              </div>
            </div>

            {/* Alarms */}
            {alarms.length > 0 && (
              <div className="bg-red-900 border border-red-500 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4 text-red-300">🚨 Active Alarms</h3>
                <div className="space-y-2">
                  {alarms.map((alarm, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm ${
                        alarm.severity === 'critical' 
                          ? 'bg-red-800 text-red-200' 
                          : 'bg-yellow-800 text-yellow-200'
                      }`}
                    >
                      <div className="font-bold">{alarm.type}</div>
                      <div className="text-xs">{alarm.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operator Actions Log */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Operator Log</h3>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {operatorActions.length === 0 ? (
                  <div className="text-gray-500 text-sm">No actions recorded</div>
                ) : (
                  operatorActions.map((action) => (
                    <div key={action.id} className="text-xs border-l-2 border-blue-500 pl-2 py-1">
                      <div className="text-blue-400">{action.time}</div>
                      <div className="text-gray-300">{action.action}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Training Scenarios */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Training Scenarios</h3>
              <div className="space-y-2">
                <button
                  onClick={() => loadScenario('startup')}
                  className="w-full p-2 bg-green-700 hover:bg-green-800 rounded text-sm"
                >
                  🚀 Cold Startup
                </button>
                <button
                  onClick={() => loadScenario('normal_operation')}
                  className="w-full p-2 bg-blue-700 hover:bg-blue-800 rounded text-sm"
                >
                  ⚡ Normal Operation
                </button>
                <button
                  onClick={() => loadScenario('xenon_poisoning')}
                  className="w-full p-2 bg-purple-700 hover:bg-purple-800 rounded text-sm"
                >
                  ☢️ Xenon Poisoning
                </button>
                <button
                  onClick={() => loadScenario('emergency')}
                  className="w-full p-2 bg-red-700 hover:bg-red-800 rounded text-sm"
                >
                  🚨 Emergency Response
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel - Educational Information */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Nuclear Physics Basics</h3>
            <div className="text-sm space-y-2">
              <div><strong>Criticality (k-effective):</strong></div>
              <ul className="text-xs text-gray-300 ml-4 space-y-1">
                <li>• k &lt; 1.0: Subcritical (power decreases)</li>
                <li>• k = 1.0: Critical (steady power)</li>
                <li>• k &gt; 1.0: Supercritical (power increases)</li>
              </ul>
              
              <div className="mt-3"><strong>Control Methods:</strong></div>
              <ul className="text-xs text-gray-300 ml-4 space-y-1">
                <li>• Control rods absorb neutrons</li>
                <li>• Temperature affects reactivity</li>
                <li>• Coolant flow removes heat</li>
                <li>• Xenon-135 "poisons" reaction</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-green-400">Safety Systems</h3>
            <div className="text-sm space-y-2">
              <div><strong>Defense in Depth:</strong></div>
              <ul className="text-xs text-gray-300 ml-4 space-y-1">
                <li>• Multiple barriers to radiation</li>
                <li>• Redundant safety systems</li>
                <li>• Automatic shutdown (SCRAM)</li>
                <li>• Containment building</li>
              </ul>
              
              <div className="mt-3"><strong>Emergency Procedures:</strong></div>
              <ul className="text-xs text-gray-300 ml-4 space-y-1">
                <li>• SCRAM stops chain reaction</li>
                <li>• Emergency cooling prevents meltdown</li>
                <li>• Isolation prevents releases</li>
                <li>• Evacuation if needed</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-yellow-400">Reactor Operations</h3>
            <div className="text-sm space-y-2">
              <div><strong>Normal Operation:</strong></div>
              <ul className="text-xs text-gray-300 ml-4 space-y-1">
                <li>• Maintain steady power output</li>
                <li>• Control temperature and pressure</li>
                <li>• Monitor neutron flux</li>
                <li>• Manage fuel burnup</li>
              </ul>
              
              <div className="mt-3"><strong>Common Challenges:</strong></div>
              <ul className="text-xs text-gray-300 ml-4 space-y-1">
                <li>• Xenon buildup after shutdown</li>
                <li>• Load following (power changes)</li>
                <li>• Fuel depletion over time</li>
                <li>• Equipment maintenance</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-blue-300">How to Operate the Reactor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-bold mb-2 text-blue-400">Startup Procedure:</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Load "Cold Startup" scenario</li>
                <li>Start simulation</li>
                <li>Slowly withdraw control rods (-5% at a time)</li>
                <li>Watch criticality approach 1.0</li>
                <li>Maintain steady power by fine-tuning rods</li>
                <li>Monitor temperature and coolant flow</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-bold mb-2 text-blue-400">Emergency Response:</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>If power exceeds 100%, insert control rods</li>
                <li>If temperature is critical, increase coolant</li>
                <li>For any critical alarm, execute SCRAM</li>
                <li>Monitor radiation levels</li>
                <li>Wait for safe conditions before reset</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;