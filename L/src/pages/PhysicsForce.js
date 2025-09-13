import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Info, Zap } from 'lucide-react';

const PhysicsForce = () => {
  const sceneRef = useRef(null);
  const boxRef = useRef(null);
  const engineRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [forceX, setForceX] = useState(0.05);
  const [forceY, setForceY] = useState(-0.05);
  const [mass, setMass] = useState(5);
  const [showData, setShowData] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [velocityX, setVelocityX] = useState(0);
  const [velocityY, setVelocityY] = useState(0);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);

  // Setup the simulation once when mass changes.
  useEffect(() => {
    let engine = null;
    let render = null;
    let runner = null;
    let intervalId = null;
    let Matter = null;

    const setupPhysics = async () => {
      try {
        if (typeof window === 'undefined' || !sceneRef.current) return;
        const matterModule = await import('matter-js');
        Matter = matterModule.default || matterModule;
        
        engine = Matter.Engine.create({
          gravity: { x: 0, y: 1 },
          positionIterations: 6,
          velocityIterations: 4
        });
        engineRef.current = engine;
        
        render = Matter.Render.create({
          element: sceneRef.current,
          engine: engine,
          options: {
            width: 600,
            height: 400,
            wireframes: false,
            background: 'rgba(255, 255, 255, 0.1)',
            pixelRatio: window.devicePixelRatio || 1
          }
        });
        
        // Create simulation bodies with green theme colors
        const ground = Matter.Bodies.rectangle(300, 380, 600, 40, {
          isStatic: true,
          render: { fillStyle: '#6B8B6B' }
        });
        
        const box = Matter.Bodies.rectangle(100, 200, 50, 50, {
          restitution: 0.6,
          friction: 0.05,
          mass: mass,
          render: { 
            fillStyle: '#B5C5A0',
            strokeStyle: '#8FAB8F',
            lineWidth: 2
          }
        });
        boxRef.current = box;
        
        const leftWall = Matter.Bodies.rectangle(10, 200, 20, 400, {
          isStatic: true,
          render: { fillStyle: '#8FAB8F' }
        });
        const rightWall = Matter.Bodies.rectangle(590, 200, 20, 400, {
          isStatic: true,
          render: { fillStyle: '#8FAB8F' }
        });
        
        Matter.Composite.add(engine.world, [ground, box, leftWall, rightWall]);
        
        runner = Matter.Runner.create();
        Matter.Runner.run(runner, engine);
        Matter.Render.run(render);
        
        intervalId = setInterval(() => {
          if (box && box.position && box.velocity) {
            setVelocityX(parseFloat(box.velocity.x.toFixed(2)));
            setVelocityY(parseFloat(box.velocity.y.toFixed(2)));
            setPositionX(parseFloat(box.position.x.toFixed(2)));
            setPositionY(parseFloat(box.position.y.toFixed(2)));
          }
        }, 100);
        
        setLoaded(true);
      } catch (error) {
        console.error("Physics setup error:", error);
      }
    };
    
    setupPhysics();
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (Matter && render && render.canvas) {
        Matter.Render.stop(render);
        render.canvas.remove();
      }
      if (Matter && runner) {
        Matter.Runner.stop(runner);
      }
      if (Matter && engine) {
        Matter.Engine.clear(engine);
      }
    };
  }, [mass]);

  const applyForce = async () => {
    try {
      if (!boxRef.current || !boxRef.current.position) {
        console.error("Box reference is not valid");
        return;
      }
      const matterModule = await import('matter-js');
      const Matter = matterModule.default || matterModule;
      const box = boxRef.current;
      
      Matter.Body.applyForce(
        box,
        { x: box.position.x, y: box.position.y },
        { x: forceX, y: forceY }
      );
    } catch (error) {
      console.error("Error applying force:", error);
    }
  };

  const resetPosition = async () => {
    try {
      if (!boxRef.current) {
        console.error("Box reference is not valid");
        return;
      }
      const matterModule = await import('matter-js');
      const Matter = matterModule.default || matterModule;
      const box = boxRef.current;
      
      Matter.Body.setPosition(box, { x: 100, y: 200 });
      Matter.Body.setVelocity(box, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(box, 0);
    } catch (error) {
      console.error("Error resetting position:", error);
    }
  };

  const kineticEnergy = (0.5 * mass * (velocityX * velocityX + velocityY * velocityY)).toFixed(2);

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
              <h1 className="text-3xl font-normal text-white">Force Dynamics</h1>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
              >
                <Info className="mr-2 h-4 w-4" />
                Newton's Laws
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {showInfo && (
          <div className="mb-8 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}>
            <h3 className="text-lg font-medium text-gray-800 mb-3 uppercase tracking-wide">Force Dynamics Theory</h3>
            <p className="mb-3 text-gray-700 leading-relaxed">
              Newton's second law states that the acceleration of an object is directly proportional to the net force acting on it 
              and inversely proportional to its mass: F = ma.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
              <div>
                <div className="font-medium text-gray-800 mb-1">Force Application</div>
                <div className="text-gray-700">Applied force vectors determine acceleration direction and magnitude</div>
              </div>
              <div>
                <div className="font-medium text-gray-800 mb-1">Mass Effects</div>
                <div className="text-gray-700">Greater mass results in reduced acceleration for identical forces</div>
              </div>
              <div>
                <div className="font-medium text-gray-800 mb-1">Energy Conservation</div>
                <div className="text-gray-700">Kinetic energy increases with velocity: KE = ½mv²</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-12 gap-8">
          {/* Control Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <h3 className="text-lg font-medium text-white mb-6 flex items-center">
                <Zap className="mr-3 h-5 w-5" />
                Force Parameters
              </h3>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Horizontal Force: {forceX} N
                  </label>
                  <input 
                    type="range" 
                    min="-0.2" 
                    max="0.2" 
                    step="0.01" 
                    value={forceX}
                    onChange={(e) => setForceX(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(181, 197, 160, 0.5)' }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Vertical Force: {forceY} N
                  </label>
                  <input 
                    type="range" 
                    min="-0.2" 
                    max="0.2" 
                    step="0.01" 
                    value={forceY}
                    onChange={(e) => setForceY(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(143, 171, 143, 0.5)' }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Object Mass: {mass} kg
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="1" 
                    value={mass}
                    onChange={(e) => setMass(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(201, 201, 163, 0.5)' }}
                  />
                </div>
              </div>
              
              <div className="mt-8 grid grid-cols-2 gap-4">
                <button 
                  onClick={applyForce}
                  disabled={!loaded}
                  className="px-4 py-3 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide flex items-center justify-center"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Apply Force
                </button>
                <button 
                  onClick={resetPosition}
                  disabled={!loaded}
                  className="px-4 py-3 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide flex items-center justify-center"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </button>
              </div>
              
              <div className="mt-6">
                <label className="flex items-center text-sm text-white opacity-90">
                  <input 
                    type="checkbox" 
                    checked={showData} 
                    onChange={() => setShowData(!showData)}
                    className="form-checkbox h-4 w-4 mr-3"
                  />
                  <span className="uppercase tracking-wide">Display Metrics</span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Simulation Area */}
          <div className="col-span-12 lg:col-span-8">
            <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-4">
                Real-time Force Simulation
              </div>
              
              <div 
                ref={sceneRef}
                className="border border-white border-opacity-30 rounded-lg overflow-hidden shadow-lg mx-auto" 
                style={{ width: 600, height: 400, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              ></div>
              
              {showData && loaded && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <h3 className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-3">
                      Kinematic Data
                    </h3>
                    <div className="space-y-2 text-sm text-gray-800">
                      <div className="flex justify-between">
                        <span>Velocity X:</span>
                        <span className="font-mono">{velocityX} m/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Velocity Y:</span>
                        <span className="font-mono">{velocityY} m/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Position X:</span>
                        <span className="font-mono">{positionX}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Position Y:</span>
                        <span className="font-mono">{positionY}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <h3 className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-3">
                      Force Analysis
                    </h3>
                    <div className="space-y-2 text-sm text-gray-800">
                      <div className="flex justify-between">
                        <span>Mass:</span>
                        <span className="font-mono">{mass} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Force X:</span>
                        <span className="font-mono">{forceX} N</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Force Y:</span>
                        <span className="font-mono">{forceY} N</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kinetic Energy:</span>
                        <span className="font-mono">{kineticEnergy} J</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Learning Objectives */}
            <div className="mt-6 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
              <h3 className="text-lg font-medium text-white mb-4 uppercase tracking-wide">
                Learning Objectives
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white opacity-90">
                <div>
                  <div className="font-medium mb-1">Force Vector Analysis</div>
                  <div className="text-xs opacity-80">Observe how force magnitude and direction affect acceleration</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Newton's Second Law</div>
                  <div className="text-xs opacity-80">Demonstrate F = ma relationship through mass variations</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Energy Conservation</div>
                  <div className="text-xs opacity-80">Visualize kinetic energy changes during motion</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Trajectory Control</div>
                  <div className="text-xs opacity-80">Experiment with force vectors to control object paths</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicsForce;