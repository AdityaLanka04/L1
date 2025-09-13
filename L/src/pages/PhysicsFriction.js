import React, { useEffect, useRef, useState } from 'react';
import { Sliders, RefreshCw, PlayCircle, PauseCircle, Info } from 'lucide-react';

const PhysicsFriction = () => {
  const sceneRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  
  // Box properties state
  const [highFrictionValue, setHighFrictionValue] = useState(0.9);
  const [lowFrictionValue, setLowFrictionValue] = useState(0.1);
  const [gravityValue, setGravityValue] = useState(0.5);
  const [rampAngle, setRampAngle] = useState(5);
  
  // Tracking data
  const [highBoxData, setHighBoxData] = useState({ velocity: { x: 0, y: 0 }, position: { x: 0, y: 0 } });
  const [lowBoxData, setLowBoxData] = useState({ velocity: { x: 0, y: 0 }, position: { x: 0, y: 0 } });
  
  // References to Matter objects
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const highFrictionBoxRef = useRef(null);
  const lowFrictionBoxRef = useRef(null);
  const rampRef = useRef(null);
  const matterRef = useRef(null);

  // Handle simulation pause/play
  const toggleSimulation = () => {
    if (!matterRef.current || !runnerRef.current) return;
    
    setIsRunning(prev => {
      if (prev) {
        matterRef.current.Runner.stop(runnerRef.current);
      } else {
        matterRef.current.Runner.run(runnerRef.current, engineRef.current);
      }
      return !prev;
    });
  };

  // Reset simulation
  const resetSimulation = () => {
    if (!matterRef.current) return;
    
    // Reset box positions
    matterRef.current.Body.setPosition(highFrictionBoxRef.current, { x: 150, y: 50 });
    matterRef.current.Body.setPosition(lowFrictionBoxRef.current, { x: 150, y: 120 });
    
    // Reset velocities
    matterRef.current.Body.setVelocity(highFrictionBoxRef.current, { x: 0, y: 0 });
    matterRef.current.Body.setVelocity(lowFrictionBoxRef.current, { x: 0, y: 0 });
  };

  // Update friction and physics properties
  const updatePhysicsProperties = () => {
    if (!matterRef.current) return;
    
    // Update friction values
    matterRef.current.Body.set(highFrictionBoxRef.current, "friction", highFrictionValue);
    matterRef.current.Body.set(lowFrictionBoxRef.current, "friction", lowFrictionValue);
    
    // Update gravity
    engineRef.current.gravity.y = gravityValue;
    
    // Update ramp angle
    updateRampAngle();
  };
  
  // Update the ramp angle
  const updateRampAngle = () => {
    if (!matterRef.current || !rampRef.current) return;
    
    // Calculate ramp coordinates based on angle
    const rampLength = 500;
    const angleRad = (rampAngle * Math.PI) / 180;
    const heightDifference = rampLength * Math.sin(angleRad);
    
    // Remove old ramp
    matterRef.current.Composite.remove(engineRef.current.world, rampRef.current);
    
    // Create new ramp with updated angle
    rampRef.current = matterRef.current.Bodies.rectangle(
      300, // x position
      350 - heightDifference/2, // y position
      rampLength, // width
      20, // height
      { 
        isStatic: true,
        angle: angleRad,
        friction: 0.3,
        render: { fillStyle: '#8FAB8F' }
      }
    );
    
    matterRef.current.Composite.add(engineRef.current.world, rampRef.current);
    
    // Reset boxes to top of ramp
    resetSimulation();
  };

  useEffect(() => {
    let intervalId;

    const setupPhysics = async () => {
      try {
        // Import Matter.js
        const Matter = await import('matter-js');
        matterRef.current = Matter;
        
        // Create engine with initial gravity
        const engine = Matter.Engine.create({ 
          gravity: { x: 0, y: gravityValue } 
        });
        engineRef.current = engine;
        
        // Create renderer
        const render = Matter.Render.create({
          element: sceneRef.current,
          engine: engine,
          options: {
            width: 600,
            height: 400,
            wireframes: false,
            background: 'rgba(255, 255, 255, 0.1)',
            showSleeping: false,
          }
        });
        
        // Create ground/container walls to keep objects in view
        const ground = Matter.Bodies.rectangle(300, 430, 800, 60, { 
          isStatic: true,
          render: { fillStyle: '#6B8B6B' }
        });
        
        const leftWall = Matter.Bodies.rectangle(-10, 200, 20, 400, { 
          isStatic: true,
          render: { fillStyle: '#6B8B6B' }
        });
        
        const rightWall = Matter.Bodies.rectangle(610, 200, 20, 400, { 
          isStatic: true,
          render: { fillStyle: '#6B8B6B' }
        });
        
        // Create initial ramp
        const rampLength = 500;
        const angleRad = (rampAngle * Math.PI) / 180;
        const heightDifference = rampLength * Math.sin(angleRad);
        
        const ramp = Matter.Bodies.rectangle(
          300, 
          350 - heightDifference/2, 
          rampLength, 
          20, 
          { 
            isStatic: true,
            angle: angleRad,
            friction: 0.3,
            render: { fillStyle: '#8FAB8F' }
          }
        );
        rampRef.current = ramp;
        
        // Create boxes with different friction
        const highFrictionBox = Matter.Bodies.rectangle(150, 50, 40, 40, {
          friction: highFrictionValue,
          restitution: 0.2,
          render: { 
            fillStyle: '#B5C5A0',
            strokeStyle: '#8FAB8F',
            lineWidth: 2
          }
        });
        highFrictionBoxRef.current = highFrictionBox;
        
        const lowFrictionBox = Matter.Bodies.rectangle(150, 120, 40, 40, {
          friction: lowFrictionValue,
          restitution: 0.2,
          render: { 
            fillStyle: '#C9C9A3',
            strokeStyle: '#B5C5A0',
            lineWidth: 2
          }
        });
        lowFrictionBoxRef.current = lowFrictionBox;
        
        // Add all bodies to the world
        Matter.Composite.add(engine.world, [
          ground, leftWall, rightWall, ramp, 
          highFrictionBox, lowFrictionBox
        ]);
        
        // Create runner
        const runner = Matter.Runner.create();
        runnerRef.current = runner;
        
        // Start the simulation
        Matter.Runner.run(runner, engine);
        Matter.Render.run(render);
        
        // Update state with box positions and velocities
        intervalId = setInterval(() => {
          setHighBoxData({
            velocity: {
              x: parseFloat(highFrictionBox.velocity.x.toFixed(2)),
              y: parseFloat(highFrictionBox.velocity.y.toFixed(2))
            },
            position: {
              x: parseFloat(highFrictionBox.position.x.toFixed(2)),
              y: parseFloat(highFrictionBox.position.y.toFixed(2))
            }
          });
          
          setLowBoxData({
            velocity: {
              x: parseFloat(lowFrictionBox.velocity.x.toFixed(2)),
              y: parseFloat(lowFrictionBox.velocity.y.toFixed(2))
            },
            position: {
              x: parseFloat(lowFrictionBox.position.x.toFixed(2)),
              y: parseFloat(lowFrictionBox.position.y.toFixed(2))
            }
          });
        }, 100);
        
        setLoaded(true);
      } catch (error) {
        console.error("Physics setup error:", error);
      }
    };
    
    setupPhysics();
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (runnerRef.current && matterRef.current) {
        matterRef.current.Runner.stop(runnerRef.current);
      }
    };
  }, []);
  
  // Apply physics property changes when values change
  useEffect(() => {
    if (loaded) {
      updatePhysicsProperties();
    }
  }, [highFrictionValue, lowFrictionValue, gravityValue, rampAngle, loaded]);

  // Calculate speed difference as percentage
  const calculateSpeedDifference = () => {
    const highSpeed = Math.sqrt(
      Math.pow(highBoxData.velocity.x, 2) + 
      Math.pow(highBoxData.velocity.y, 2)
    );
    
    const lowSpeed = Math.sqrt(
      Math.pow(lowBoxData.velocity.x, 2) + 
      Math.pow(lowBoxData.velocity.y, 2)
    );
    
    if (highSpeed === 0 && lowSpeed === 0) return "0%";
    
    // If high friction box is at rest but low friction is moving
    if (highSpeed < 0.1 && lowSpeed > 0.1) {
      return "∞%"; // Essentially infinite difference
    }
    
    const diff = ((lowSpeed - highSpeed) / Math.max(0.1, highSpeed)) * 100;
    return `${diff.toFixed(0)}%`;
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #6B8B6B 0%, #8FAB8F 35%, #B5C5A0 70%, #C9C9A3 100%)',
      fontFamily: "'Lekton', 'Courier New', monospace" 
    }}>
      {/* Header */}
      <div className="border-b border-white border-opacity-20 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs uppercase tracking-wider text-white opacity-60 mb-1">
                Physics Simulation
              </div>
              <h1 className="text-3xl font-normal text-white">Friction Analysis</h1>
            </div>
            <div className="flex space-x-2">
              {isRunning ? (
                <button 
                  onClick={toggleSimulation}
                  className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
                >
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Pause
                </button>
              ) : (
                <button 
                  onClick={toggleSimulation}
                  className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Play
                </button>
              )}
              <button 
                onClick={resetSimulation}
                className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </button>
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {showInfo && (
          <div className="mb-8 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}>
            <h3 className="text-lg font-medium text-gray-800 mb-3 uppercase tracking-wide">Friction Physics</h3>
            <p className="mb-3 text-gray-700 leading-relaxed">
              Friction is a force that opposes the relative motion of surfaces in contact. 
              The force acts parallel to the surfaces and depends on the coefficient of friction.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded mr-3" style={{ backgroundColor: '#B5C5A0' }}></div>
                <span className="text-gray-700">High friction coefficient (more resistance)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded mr-3" style={{ backgroundColor: '#C9C9A3' }}></div>
                <span className="text-gray-700">Low friction coefficient (less resistance)</span>
              </div>
            </div>
            <p className="text-gray-700 text-sm">
              Adjust the parameters to observe how friction coefficients, gravity, and surface angle affect object motion.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-12 gap-8">
          {/* Simulation Area */}
          <div className="col-span-12 lg:col-span-8">
            <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-4">
                Real-time Physics Simulation
              </div>
              
              <div 
                ref={sceneRef} 
                className="border border-white border-opacity-30 rounded-lg overflow-hidden shadow-lg mx-auto" 
                style={{ width: 600, height: 400, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              ></div>
              
              {/* Data Display */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(181, 197, 160, 0.3)' }}>
                  <h3 className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-2">
                    High Friction Object
                  </h3>
                  <div className="space-y-1 text-sm text-gray-800">
                    <div className="flex justify-between">
                      <span>Velocity X:</span>
                      <span className="font-mono">{highBoxData.velocity.x.toFixed(2)} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Velocity Y:</span>
                      <span className="font-mono">{highBoxData.velocity.y.toFixed(2)} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Speed:</span>
                      <span className="font-mono">{Math.sqrt(Math.pow(highBoxData.velocity.x, 2) + Math.pow(highBoxData.velocity.y, 2)).toFixed(2)} m/s</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(201, 201, 163, 0.3)' }}>
                  <h3 className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-2">
                    Low Friction Object
                  </h3>
                  <div className="space-y-1 text-sm text-gray-800">
                    <div className="flex justify-between">
                      <span>Velocity X:</span>
                      <span className="font-mono">{lowBoxData.velocity.x.toFixed(2)} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Velocity Y:</span>
                      <span className="font-mono">{lowBoxData.velocity.y.toFixed(2)} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Speed:</span>
                      <span className="font-mono">{Math.sqrt(Math.pow(lowBoxData.velocity.x, 2) + Math.pow(lowBoxData.velocity.y, 2)).toFixed(2)} m/s</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <h3 className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-2">
                  Comparative Analysis
                </h3>
                <p className="text-sm text-gray-800">
                  Speed differential: <span className="font-mono font-medium">{calculateSpeedDifference()}</span> faster motion in low-friction environment
                </p>
              </div>
            </div>
          </div>
          
          {/* Control Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <h3 className="text-lg font-medium text-white mb-6 flex items-center">
                <Sliders className="mr-3 h-5 w-5" />
                Parameter Control
              </h3>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    High Friction: {highFrictionValue}
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={highFrictionValue}
                    onChange={(e) => setHighFrictionValue(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(181, 197, 160, 0.5)' }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Low Friction: {lowFrictionValue}
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={lowFrictionValue}
                    onChange={(e) => setLowFrictionValue(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(201, 201, 163, 0.5)' }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Gravity: {gravityValue}
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={gravityValue}
                    onChange={(e) => setGravityValue(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(143, 171, 143, 0.5)' }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Ramp Angle: {rampAngle}°
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="30" 
                    step="1" 
                    value={rampAngle}
                    onChange={(e) => setRampAngle(parseInt(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(107, 139, 107, 0.5)' }}
                  />
                </div>
              </div>
              
              <div className="mt-8 p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                <p className="text-xs uppercase tracking-wider text-white opacity-70 mb-3">
                  Experimental Protocols
                </p>
                <ul className="text-sm text-white opacity-80 space-y-2">
                  <li>• Zero friction coefficients for frictionless motion</li>
                  <li>• Maximum ramp angle for gravitational analysis</li>
                  <li>• Zero gravity for isolated friction observation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicsFriction;