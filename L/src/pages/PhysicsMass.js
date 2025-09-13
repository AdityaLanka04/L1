import React, { useState, useEffect, useRef } from 'react';

const ProjectileMotion = () => {
  // Canvas dimensions
  const canvasWidth = 800;
  const canvasHeight = 400;
  
  // State for projectile parameters
  const [angle, setAngle] = useState(45);
  const [velocity, setVelocity] = useState(50);
  const [gravity, setGravity] = useState(9.8);
  const [isSimulating, setIsSimulating] = useState(false);
  const [trajectory, setTrajectory] = useState([]);
  const [currentPosition, setCurrentPosition] = useState({ x: 0, y: canvasHeight - 10 });
  const [pathPoints, setPathPoints] = useState([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [maxDistance, setMaxDistance] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const [showTheory, setShowTheory] = useState(false);
  
  // Refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Convert angle to radians
  const toRadians = (degrees) => degrees * Math.PI / 180;
  
  // Calculate the trajectory points
  const calculateTrajectory = () => {
    const points = [];
    const radians = toRadians(angle);
    const vx = velocity * Math.cos(radians);
    const vy = velocity * Math.sin(radians);
    
    let maxDist = 0;
    let maxH = 0;
    
    // Total flight time = (2 * vy) / g
    const timeOfFlight = (2 * vy) / gravity;
    
    // Calculate position at each time step
    for (let t = 0; t <= timeOfFlight; t += 0.1) {
      const x = vx * t;
      const y = canvasHeight - (vy * t - 0.5 * gravity * t * t) - 10; // adjust for canvas orientation
      
      if (x > maxDist) maxDist = x;
      if (canvasHeight - y > maxH) maxH = canvasHeight - y;
      
      // Always include the starting point; then break when the projectile hits the ground
      points.push({ x, y });
      if (t > 0 && y >= canvasHeight - 10) {
        break;
      }
    }
    
    setMaxDistance(maxDist.toFixed(2));
    setMaxHeight(maxH.toFixed(2));
    return points;
  };
  
  // Update trajectory when parameters change
  useEffect(() => {
    if (!isSimulating) {
      const newTrajectory = calculateTrajectory();
      setTrajectory(newTrajectory);
    }
  }, [angle, velocity, gravity, isSimulating]);
  
  // Start simulation
  const startSimulation = () => {
    if (isSimulating) return; // Prevent multiple starts
    
    setIsSimulating(true);
    setCurrentPosition({ x: 0, y: canvasHeight - 10 });
    setPathPoints([{ x: 0, y: canvasHeight - 10 }]); // Initialize path with starting point
    setTimeElapsed(0);
    startTimeRef.current = Date.now();
    
    const newTrajectory = calculateTrajectory();
    setTrajectory(newTrajectory);
    
    // Clear any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animateProjectile();
  };
  
  // Reset simulation
  const resetSimulation = () => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Reset all state values
    setIsSimulating(false);
    setCurrentPosition({ x: 0, y: canvasHeight - 10 });
    setPathPoints([]);
    setTimeElapsed(0);
    
    // Recalculate trajectory based on current parameters
    const newTrajectory = calculateTrajectory();
    setTrajectory(newTrajectory);
    
    // Force immediate redraw of canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      drawCanvas(ctx);
    }
  };
  
  // Animate the projectile motion
  const animateProjectile = () => {
    const radians = toRadians(angle);
    const vx = velocity * Math.cos(radians);
    const vy = velocity * Math.sin(radians);
    
    const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
    setTimeElapsed(elapsedSeconds.toFixed(2));
    
    const x = vx * elapsedSeconds;
    const y = canvasHeight - (vy * elapsedSeconds - 0.5 * gravity * elapsedSeconds * elapsedSeconds) - 10;
    
    // Update projectile position
    const newPosition = { x, y };
    setCurrentPosition(newPosition);
    
    // Add point to path trace
    setPathPoints(prevPoints => [...prevPoints, newPosition]);
    
    // Compute total flight time for current parameters
    const totalFlightTime = (2 * vy) / gravity;
    
    // Continue animation until the projectile has completed its flight or goes off screen
    if (elapsedSeconds < totalFlightTime && x < canvasWidth && y > 0) {
      animationRef.current = requestAnimationFrame(animateProjectile);
    } else {
      setIsSimulating(false);
    }
  };
  
  // Handle parameter changes
  const handleAngleChange = (e) => {
    setAngle(Number(e.target.value));
  };
  
  const handleVelocityChange = (e) => {
    setVelocity(Number(e.target.value));
  };
  
  const handleGravityChange = (e) => {
    setGravity(Number(e.target.value));
  };
  
  // Draw the canvas
  const drawCanvas = (ctx) => {
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw ground
    ctx.fillStyle = '#6B8B6B';
    ctx.fillRect(0, canvasHeight - 10, canvasWidth, 10);
    
    // Draw gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    
    // Vertical gridlines
    for (let x = 0; x <= canvasWidth; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight - 10);
      ctx.stroke();
      
      // Draw distance markers
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px Lekton, monospace';
      ctx.fillText(`${x}m`, x + 2, canvasHeight - 15);
    }
    
    // Horizontal gridlines
    for (let y = canvasHeight - 10; y >= 0; y -= 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
      
      // Draw height markers
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px Lekton, monospace';
      ctx.fillText(`${canvasHeight - y - 10}m`, 2, y + 10);
    }
    
    // Draw predicted trajectory
    if (trajectory.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]); // Dashed line for predicted path
      ctx.beginPath();
      ctx.moveTo(trajectory[0].x, trajectory[0].y);
      
      for (let i = 1; i < trajectory.length; i++) {
        ctx.lineTo(trajectory[i].x, trajectory[i].y);
      }
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset to solid line
    }
    
    // Draw actual path trace
    if (pathPoints.length > 1) {
      ctx.strokeStyle = '#C9C9A3'; // Light green for the trace
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      
      for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
      }
      
      ctx.stroke();
    }
    
    // Draw projectile
    if (isSimulating || (pathPoints.length > 0 && !isSimulating)) {
      ctx.fillStyle = '#B5C5A0';
      ctx.strokeStyle = '#8FAB8F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(currentPosition.x, currentPosition.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };
  
  // Redraw canvas when values change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawCanvas(ctx);
    }
  }, [trajectory, currentPosition, pathPoints, isSimulating]);
  
  // Initial canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawCanvas(ctx);
    }
    
    // Initialize trajectory on first render
    const initialTrajectory = calculateTrajectory();
    setTrajectory(initialTrajectory);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
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
              <h1 className="text-3xl font-normal text-white">Projectile Motion</h1>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowTheory(!showTheory)}
                className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
              >
                Theory
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {showTheory && (
          <div className="mb-8 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}>
            <h3 className="text-lg font-medium text-gray-800 mb-3 uppercase tracking-wide">Ballistic Motion Theory</h3>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Projectile motion describes the motion of an object thrown or projected into the air, subject to only the acceleration of gravity.
              The object is called a projectile, and its path is called its trajectory.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium text-gray-800 mb-2 uppercase tracking-wide">Key Equations</h4>
                <div className="space-y-1 text-gray-700 font-mono text-xs">
                  <div>v<sub>x</sub> = v<sub>0</sub> cos(θ)</div>
                  <div>v<sub>y</sub> = v<sub>0</sub> sin(θ) - gt</div>
                  <div>x = v<sub>x</sub>t</div>
                  <div>y = v<sub>0</sub> sin(θ)t - ½gt²</div>
                  <div>h<sub>max</sub> = v<sub>0</sub>² sin²(θ) / (2g)</div>
                  <div>R = v<sub>0</sub>² sin(2θ) / g</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-2 uppercase tracking-wide">Physical Principles</h4>
                <div className="space-y-1 text-gray-700 text-xs">
                  <div>• Horizontal velocity remains constant (no air resistance)</div>
                  <div>• Maximum range occurs at 45° launch angle</div>
                  <div>• Complementary angles yield identical ranges</div>
                  <div>• Flight time determined by vertical velocity component</div>
                  <div>• Gravitational acceleration affects trajectory curvature</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-12 gap-8">
          {/* Simulation Area */}
          <div className="col-span-12 lg:col-span-8">
            <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-4">
                Ballistic Trajectory Simulation
              </div>
              
              <div 
                className="border border-white border-opacity-30 rounded-lg overflow-hidden shadow-lg mx-auto mb-6" 
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              >
                <canvas 
                  ref={canvasRef} 
                  width={canvasWidth} 
                  height={canvasHeight}
                  className="w-full"
                />
              </div>
              
              {/* Legend */}
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-800 mb-6">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#B5C5A0', border: '1px solid #8FAB8F' }}></div>
                  <span>Projectile Object</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-0.5 mr-2" style={{ backgroundColor: '#C9C9A3' }}></div>
                  <span>Actual Trajectory</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-0.5 mr-2 border-dashed" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}></div>
                  <span>Predicted Path</span>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex justify-center gap-4">
                <button 
                  onClick={startSimulation} 
                  disabled={isSimulating}
                  className="px-6 py-3 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide disabled:opacity-50"
                >
                  Launch Projectile
                </button>
                <button 
                  onClick={resetSimulation}
                  className="px-6 py-3 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
                >
                  Reset Simulation
                </button>
              </div>
            </div>
          </div>
          
          {/* Control Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <h3 className="text-lg font-medium text-white mb-6 uppercase tracking-wide">
                Launch Parameters
              </h3>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Launch Angle: {angle}°
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="90" 
                    value={angle} 
                    onChange={handleAngleChange} 
                    disabled={isSimulating}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(181, 197, 160, 0.5)' }}
                  />
                  <div className="flex justify-between text-xs text-white opacity-70 mt-1">
                    <span>0°</span>
                    <span>90°</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Initial Velocity: {velocity} m/s
                  </label>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={velocity} 
                    onChange={handleVelocityChange} 
                    disabled={isSimulating}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(143, 171, 143, 0.5)' }}
                  />
                  <div className="flex justify-between text-xs text-white opacity-70 mt-1">
                    <span>10 m/s</span>
                    <span>100 m/s</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-white opacity-90 mb-3 uppercase tracking-wide">
                    Gravity: {gravity} m/s²
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="0.1" 
                    value={gravity} 
                    onChange={handleGravityChange} 
                    disabled={isSimulating}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'rgba(201, 201, 163, 0.5)' }}
                  />
                  <div className="flex justify-between text-xs text-white opacity-70 mt-1">
                    <span>1 m/s²</span>
                    <span>20 m/s²</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Data Display */}
            <div className="mt-6 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
              <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wide">
                Real-time Metrics
              </h3>
              
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="text-white opacity-70 mb-1">Time Elapsed</div>
                    <div className="text-white font-mono text-sm">{timeElapsed} s</div>
                  </div>
                  <div className="p-3 rounded border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="text-white opacity-70 mb-1">Position X</div>
                    <div className="text-white font-mono text-sm">{currentPosition.x.toFixed(2)} m</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="text-white opacity-70 mb-1">Position Y</div>
                    <div className="text-white font-mono text-sm">{(canvasHeight - currentPosition.y - 10).toFixed(2)} m</div>
                  </div>
                  <div className="p-3 rounded border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="text-white opacity-70 mb-1">Max Height</div>
                    <div className="text-white font-mono text-sm">{maxHeight} m</div>
                  </div>
                </div>
                
                <div className="p-3 rounded border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <div className="text-white opacity-70 mb-2">Velocity Components</div>
                  <div className="text-white font-mono text-xs">
                    v<sub>x</sub>: {(velocity * Math.cos(toRadians(angle))).toFixed(2)} m/s<br/>
                    v<sub>y</sub>: {(velocity * Math.sin(toRadians(angle))).toFixed(2)} m/s
                  </div>
                </div>
                
                <div className="p-3 rounded border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <div className="text-white opacity-70 mb-1">Maximum Range</div>
                  <div className="text-white font-mono text-sm">{maxDistance} m</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectileMotion;