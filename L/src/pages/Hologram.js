import React, { useState, useEffect, useRef, useCallback } from 'react';

function App() {
  // Hologram system state
  const [hologramState, setHologramState] = useState({
    isActive: false,
    intensity: 0.8,
    coherence: 0.95,
    wavelength: 532, // green laser nm
    beamCount: 4,
    referenceBeam: { angle: 45, intensity: 1.0 },
    objectBeams: [],
    interferencePattern: null,
    reconstructionAngle: 0,
    depth: 50,
    resolution: 512
  });

  // 3D object data
  const [sceneObjects, setSceneObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // Visual effects
  const [visualEffects, setVisualEffects] = useState({
    showInterference: true,
    showBeams: true,
    showFringes: true,
    colorMode: 'realistic',
    animation: true,
    hologramQuality: 'high'
  });

  // Camera and interaction
  const [camera, setCamera] = useState({
    x: 0, y: 0, z: 200,
    rotX: 0, rotY: 0, rotZ: 0,
    zoom: 1,
    isDragging: false,
    lastPos: { x: 0, y: 0 }
  });

  // Canvas refs
  const mainCanvasRef = useRef(null);
  const interferenceCanvasRef = useRef(null);
  const hologramCanvasRef = useRef(null);
  const animationRef = useRef(null);

  // Physics constants
  const PHYSICS = {
    SPEED_OF_LIGHT: 299792458,
    PLANCK: 6.626e-34,
    wavelengths: {
      red: 650,
      green: 532,
      blue: 405,
      violet: 380
    }
  };

  // Predefined 3D objects
  const objectTemplates = {
    cube: {
      name: "Holographic Cube",
      vertices: [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
      ],
      edges: [
        [0,1], [1,2], [2,3], [3,0], [4,5], [5,6], [6,7], [7,4],
        [0,4], [1,5], [2,6], [3,7]
      ],
      color: [0, 255, 128],
      intensity: 0.8
    },
    pyramid: {
      name: "Light Pyramid",
      vertices: [
        [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, 1, 0]
      ],
      edges: [
        [0,1], [1,2], [2,3], [3,0], [0,4], [1,4], [2,4], [3,4]
      ],
      color: [255, 100, 255],
      intensity: 0.9
    },
    helix: {
      name: "DNA Helix",
      vertices: [],
      edges: [],
      color: [100, 200, 255],
      intensity: 0.7,
      special: 'helix'
    },
    molecule: {
      name: "Water Molecule",
      vertices: [
        [0, 0, 0], [-1.5, -0.5, 0], [1.5, -0.5, 0]
      ],
      edges: [[0,1], [0,2]],
      spheres: [
        { pos: [0, 0, 0], radius: 0.8, color: [255, 0, 0] }, // O
        { pos: [-1.5, -0.5, 0], radius: 0.4, color: [255, 255, 255] }, // H
        { pos: [1.5, -0.5, 0], radius: 0.4, color: [255, 255, 255] }  // H
      ],
      color: [255, 255, 255],
      intensity: 0.85
    }
  };

  // Generate helix vertices
  const generateHelix = useCallback((turns = 3, points = 60) => {
    const vertices = [];
    const edges = [];
    
    for (let i = 0; i < points; i++) {
      const t = (i / points) * turns * 2 * Math.PI;
      const y = (i / points - 0.5) * 4;
      
      // Double helix
      vertices.push([Math.cos(t), y, Math.sin(t)]);
      vertices.push([Math.cos(t + Math.PI), y, Math.sin(t + Math.PI)]);
      
      if (i > 0) {
        edges.push([i*2-2, i*2]);
        edges.push([i*2-1, i*2+1]);
        
        // Cross links
        if (i % 5 === 0) {
          edges.push([i*2, i*2+1]);
        }
      }
    }
    
    return { vertices, edges };
  }, []);

  // Initialize helix template
  useEffect(() => {
    const helixData = generateHelix();
    objectTemplates.helix.vertices = helixData.vertices;
    objectTemplates.helix.edges = helixData.edges;
  }, [generateHelix]);

  // Interference pattern calculation
  const calculateInterference = useCallback((width, height) => {
    const pattern = new Array(width * height * 4);
    const { wavelength, coherence, intensity } = hologramState;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Reference beam
        const refPhase = (2 * Math.PI / wavelength) * (x * Math.sin(hologramState.referenceBeam.angle * Math.PI / 180));
        
        // Object beam interference
        let totalAmplitude = 0;
        let totalPhase = 0;
        
        sceneObjects.forEach(obj => {
          if (!obj.visible) return;
          
          obj.vertices.forEach(vertex => {
            const [vx, vy, vz] = vertex;
            const distance = Math.sqrt((x - width/2 - vx*20)**2 + (y - height/2 - vy*20)**2 + vz**2);
            const objPhase = (2 * Math.PI / wavelength) * distance;
            
            totalAmplitude += obj.intensity * Math.cos(objPhase - refPhase);
            totalPhase += objPhase;
          });
        });
        
        // Add coherence and noise effects
        const coherenceNoise = (1 - coherence) * (Math.random() - 0.5) * 0.2;
        const finalAmplitude = Math.max(0, Math.min(1, totalAmplitude * intensity + coherenceNoise));
        
        // Convert to RGB
        const brightness = Math.floor(finalAmplitude * 255);
        
        if (visualEffects.colorMode === 'realistic') {
          // Wavelength to RGB conversion
          const [r, g, b] = wavelengthToRGB(wavelength);
          pattern[index] = r * brightness / 255;
          pattern[index + 1] = g * brightness / 255;
          pattern[index + 2] = b * brightness / 255;
        } else {
          pattern[index] = brightness;
          pattern[index + 1] = brightness;
          pattern[index + 2] = brightness;
        }
        pattern[index + 3] = 255;
      }
    }
    
    return pattern;
  }, [hologramState, sceneObjects, visualEffects.colorMode]);

  // Convert wavelength to RGB
  const wavelengthToRGB = (wavelength) => {
    let r = 0, g = 0, b = 0;
    
    if (wavelength >= 380 && wavelength < 440) {
      r = -(wavelength - 440) / (440 - 380);
      b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
      g = (wavelength - 440) / (490 - 440);
      b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
      g = 1;
      b = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
      r = (wavelength - 510) / (580 - 510);
      g = 1;
    } else if (wavelength >= 580 && wavelength < 645) {
      r = 1;
      g = -(wavelength - 645) / (645 - 580);
    } else if (wavelength >= 645 && wavelength <= 750) {
      r = 1;
    }
    
    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
  };

  // 3D to 2D projection
  const project3D = useCallback((vertex) => {
    const [x, y, z] = vertex;
    
    // Apply camera rotation
    const cosX = Math.cos(camera.rotX);
    const sinX = Math.sin(camera.rotX);
    const cosY = Math.cos(camera.rotY);
    const sinY = Math.sin(camera.rotY);
    
    // Rotate around Y axis
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    
    // Rotate around X axis
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    
    // Perspective projection
    const distance = camera.z + z2;
    const scale = (camera.zoom * 200) / Math.max(distance, 1);
    
    return {
      x: x1 * scale,
      y: y1 * scale,
      z: z2,
      scale: scale
    };
  }, [camera]);

  // Main rendering function
  const renderHologram = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, width, height);

    // Draw interference pattern background
    if (visualEffects.showInterference && sceneObjects.length > 0) {
      const imageData = ctx.createImageData(width, height);
      const pattern = calculateInterference(width, height);
      
      for (let i = 0; i < pattern.length; i++) {
        imageData.data[i] = pattern[i];
      }
      
      ctx.globalAlpha = 0.3;
      ctx.putImageData(imageData, 0, 0);
      ctx.globalAlpha = 1.0;
    }

    // Draw laser beams
    if (visualEffects.showBeams) {
      ctx.strokeStyle = `rgba(${wavelengthToRGB(hologramState.wavelength).join(',')}, 0.6)`;
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      
      // Reference beam
      ctx.beginPath();
      ctx.moveTo(0, height/2);
      ctx.lineTo(width, height/2 + Math.tan(hologramState.referenceBeam.angle * Math.PI / 180) * width);
      ctx.stroke();
      
      // Object beams
      sceneObjects.forEach(obj => {
        if (!obj.visible) return;
        
        obj.vertices.forEach(vertex => {
          const projected = project3D(vertex);
          const screenX = projected.x + width/2;
          const screenY = projected.y + height/2;
          
          if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(screenX, screenY);
            ctx.stroke();
          }
        });
      });
      
      ctx.shadowBlur = 0;
    }

    // Draw holographic objects
    sceneObjects.forEach((obj, objIndex) => {
      if (!obj.visible) return;

      const isSelected = objIndex === selectedObject;
      const baseAlpha = obj.intensity * hologramState.intensity;
      
      // Draw vertices as glowing points
      obj.vertices.forEach((vertex, vertexIndex) => {
        const projected = project3D(vertex);
        const screenX = projected.x + width/2;
        const screenY = projected.y + height/2;
        
        if (screenX >= -50 && screenX <= width + 50 && screenY >= -50 && screenY <= height + 50) {
          const alpha = baseAlpha * Math.max(0.3, 1 - Math.abs(projected.z) / 300);
          const size = Math.max(2, projected.scale * 0.1);
          
          // Glow effect
          const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size * 3);
          gradient.addColorStop(0, `rgba(${obj.color.join(',')}, ${alpha})`);
          gradient.addColorStop(0.5, `rgba(${obj.color.join(',')}, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(${obj.color.join(',')}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(screenX, screenY, size * 3, 0, 2 * Math.PI);
          ctx.fill();
          
          // Core point
          ctx.fillStyle = `rgba(${obj.color.join(',')}, ${Math.min(1, alpha * 2)})`;
          ctx.beginPath();
          ctx.arc(screenX, screenY, size, 0, 2 * Math.PI);
          ctx.fill();
          
          // Selection indicator
          if (isSelected) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, size * 2, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      });

      // Draw edges
      if (obj.edges) {
        obj.edges.forEach(edge => {
          const [v1, v2] = edge;
          const p1 = project3D(obj.vertices[v1]);
          const p2 = project3D(obj.vertices[v2]);
          
          const x1 = p1.x + width/2;
          const y1 = p1.y + height/2;
          const x2 = p2.x + width/2;
          const y2 = p2.y + height/2;
          
          const avgZ = (p1.z + p2.z) / 2;
          const alpha = baseAlpha * Math.max(0.2, 1 - Math.abs(avgZ) / 400);
          
          // Holographic line effect
          ctx.strokeStyle = `rgba(${obj.color.join(',')}, ${alpha})`;
          ctx.lineWidth = Math.max(1, (p1.scale + p2.scale) / 200);
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 5;
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          
          ctx.shadowBlur = 0;
        });
      }

      // Draw spheres for molecular objects
      if (obj.spheres) {
        obj.spheres.forEach(sphere => {
          const projected = project3D(sphere.pos);
          const screenX = projected.x + width/2;
          const screenY = projected.y + height/2;
          const radius = sphere.radius * projected.scale;
          
          if (radius > 1) {
            const alpha = baseAlpha * Math.max(0.3, 1 - Math.abs(projected.z) / 300);
            
            // Sphere glow
            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * 2);
            gradient.addColorStop(0, `rgba(${sphere.color.join(',')}, ${alpha})`);
            gradient.addColorStop(0.7, `rgba(${sphere.color.join(',')}, ${alpha * 0.3})`);
            gradient.addColorStop(1, `rgba(${sphere.color.join(',')}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius * 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // Core sphere
            ctx.fillStyle = `rgba(${sphere.color.join(',')}, ${Math.min(1, alpha * 1.5)})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
            ctx.fill();
          }
        });
      }
    });

    // Holographic distortion effects
    if (visualEffects.animation) {
      const time = Date.now() * 0.001;
      
      // Scan lines
      ctx.globalAlpha = 0.1;
      for (let y = 0; y < height; y += 4) {
        const intensity = Math.sin(y * 0.1 + time * 2) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(0, 255, 255, ${intensity * 0.3})`;
        ctx.fillRect(0, y, width, 2);
      }
      
      // Noise
      if (hologramState.coherence < 1.0) {
        ctx.globalAlpha = (1 - hologramState.coherence) * 0.2;
        for (let i = 0; i < 100; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = Math.random() * 3;
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
          ctx.fillRect(x, y, size, size);
        }
      }
      
      ctx.globalAlpha = 1.0;
    }

    // Recording indicator
    if (isRecording) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(width - 30, 30, 10, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('REC', width - 60, 35);
    }
  }, [hologramState, sceneObjects, selectedObject, visualEffects, camera, project3D, calculateInterference, wavelengthToRGB]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (visualEffects.animation) {
        // Rotate objects slightly for animation
        setSceneObjects(prevObjects => 
          prevObjects.map(obj => ({
            ...obj,
            vertices: obj.vertices.map(vertex => {
              const [x, y, z] = vertex;
              const angle = 0.005;
              return [
                x * Math.cos(angle) - z * Math.sin(angle),
                y,
                x * Math.sin(angle) + z * Math.cos(angle)
              ];
            })
          }))
        );
      }
      
      renderHologram();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [renderHologram, visualEffects.animation]);

  // Mouse interaction
  const handleMouseDown = (e) => {
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCamera(prev => ({
      ...prev,
      isDragging: true,
      lastPos: { x, y }
    }));
  };

  const handleMouseMove = (e) => {
    if (!camera.isDragging) return;
    
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const deltaX = x - camera.lastPos.x;
    const deltaY = y - camera.lastPos.y;
    
    setCamera(prev => ({
      ...prev,
      rotY: prev.rotY + deltaX * 0.01,
      rotX: prev.rotX + deltaY * 0.01,
      lastPos: { x, y }
    }));
  };

  const handleMouseUp = () => {
    setCamera(prev => ({ ...prev, isDragging: false }));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(5, prev.zoom + e.deltaY * -0.001))
    }));
  };

  // Add object to scene
  const addObject = (templateKey) => {
    const template = objectTemplates[templateKey];
    const newObject = {
      ...template,
      id: Date.now(),
      visible: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1
    };
    
    setSceneObjects(prev => [...prev, newObject]);
  };

  // Remove selected object
  const removeSelectedObject = () => {
    if (selectedObject !== null) {
      setSceneObjects(prev => prev.filter((_, index) => index !== selectedObject));
      setSelectedObject(null);
    }
  };

  // Toggle hologram recording
  const toggleRecording = () => {
    setIsRecording(prev => !prev);
    if (!isRecording) {
      console.log('Starting hologram recording...');
    } else {
      console.log('Stopping hologram recording...');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900 to-blue-900 p-4">
        <h1 className="text-3xl font-bold text-center">
          🌟 Advanced Hologram Generator
        </h1>
        <p className="text-center text-gray-300 mt-2">
          Create stunning 3D light sculptures with realistic interference patterns
        </p>
      </header>

      <div className="flex h-screen">
        {/* Control Panel */}
        <div className="w-80 bg-gray-900 p-4 overflow-y-auto space-y-6">
          {/* Laser Settings */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 text-blue-400">⚡ Laser System</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Wavelength (nm)</label>
                <select
                  value={hologramState.wavelength}
                  onChange={(e) => setHologramState(prev => ({ ...prev, wavelength: parseInt(e.target.value) }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value={380}>Violet (380nm)</option>
                  <option value={405}>Blue (405nm)</option>
                  <option value={532}>Green (532nm)</option>
                  <option value={650}>Red (650nm)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Intensity: {Math.floor(hologramState.intensity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={hologramState.intensity}
                  onChange={(e) => setHologramState(prev => ({ ...prev, intensity: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Coherence: {Math.floor(hologramState.coherence * 100)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.01"
                  value={hologramState.coherence}
                  onChange={(e) => setHologramState(prev => ({ ...prev, coherence: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Reference Beam Angle: {hologramState.referenceBeam.angle}°
                </label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={hologramState.referenceBeam.angle}
                  onChange={(e) => setHologramState(prev => ({ 
                    ...prev, 
                    referenceBeam: { ...prev.referenceBeam, angle: parseInt(e.target.value) }
                  }))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Object Library */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 text-green-400">📦 3D Objects</h3>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(objectTemplates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => addObject(key)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                >
                  {template.name.split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Scene Objects:</h4>
              {sceneObjects.map((obj, index) => (
                <div 
                  key={obj.id}
                  className={`flex items-center justify-between p-2 rounded ${
                    selectedObject === index ? 'bg-yellow-900' : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: `rgb(${obj.color.join(',')})` }}
                    />
                    <span className="text-sm">{obj.name}</span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setSelectedObject(index)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Select
                    </button>
                    <button
                      onClick={() => {
                        setSceneObjects(prev => prev.map((o, i) => 
                          i === index ? { ...o, visible: !o.visible } : o
                        ));
                      }}
                      className={`px-2 py-1 rounded text-xs ${
                        obj.visible ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {obj.visible ? '👁️' : '🚫'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedObject !== null && (
              <button
                onClick={removeSelectedObject}
                className="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                🗑️ Remove Selected
              </button>
            )}
          </div>

          {/* Visual Effects */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 text-purple-400">✨ Visual Effects</h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={visualEffects.showInterference}
                  onChange={(e) => setVisualEffects(prev => ({ ...prev, showInterference: e.target.checked }))}
                />
                <span>Show Interference Pattern</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={visualEffects.showBeams}
                  onChange={(e) => setVisualEffects(prev => ({ ...prev, showBeams: e.target.checked }))}
                />
                <span>Show Laser Beams</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={visualEffects.animation}
                  onChange={(e) => setVisualEffects(prev => ({ ...prev, animation: e.target.checked }))}
                />
                <span>Animation</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-2">Color Mode</label>
                <select
                  value={visualEffects.colorMode}
                  onChange={(e) => setVisualEffects(prev => ({ ...prev, colorMode: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="realistic">Realistic</option>
                  <option value="monochrome">Monochrome</option>
                </select>
              </div>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 text-cyan-400">📹 Camera</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Zoom: {camera.zoom.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={camera.zoom}
                  onChange={(e) => setCamera(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCamera(prev => ({ ...prev, rotY: prev.rotY - 0.1 }))}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  ← Rotate
                </button>
                <button
                  onClick={() => setCamera(prev => ({ ...prev, rotY: prev.rotY + 0.1 }))}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  Rotate →
                </button>
                <button
                  onClick={() => setCamera(prev => ({ ...prev, rotX: prev.rotX - 0.1 }))}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  ↑ Tilt
                </button>
                <button
                  onClick={() => setCamera(prev => ({ ...prev, rotX: prev.rotX + 0.1 }))}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  ↓ Tilt
                </button>
              </div>

              <button
                onClick={() => setCamera({
                  x: 0, y: 0, z: 200,
                  rotX: 0, rotY: 0, rotZ: 0,
                  zoom: 1,
                  isDragging: false,
                  lastPos: { x: 0, y: 0 }
                })}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded"
              >
                🔄 Reset View
              </button>
            </div>
          </div>

          {/* Recording Controls */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 text-red-400">🎬 Recording</h3>
            
            <button
              onClick={toggleRecording}
              className={`w-full py-3 rounded font-bold ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isRecording ? '⏹️ Stop Recording' : '🔴 Start Recording'}
            </button>
            
            {isRecording && (
              <div className="mt-2 text-center text-red-400 text-sm animate-pulse">
                Recording hologram data...
              </div>
            )}
          </div>

          {/* System Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 text-orange-400">📊 System Status</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Objects:</span>
                <span className="text-green-400">{sceneObjects.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Wavelength:</span>
                <span className="text-blue-400">{hologramState.wavelength}nm</span>
              </div>
              <div className="flex justify-between">
                <span>Coherence:</span>
                <span className="text-purple-400">{Math.floor(hologramState.coherence * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Beam Angle:</span>
                <span className="text-cyan-400">{hologramState.referenceBeam.angle}°</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={hologramState.isActive ? 'text-green-400' : 'text-red-400'}>
                  {hologramState.isActive ? 'Active' : 'Standby'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Hologram Display */}
        <div className="flex-1 relative bg-black">
          <canvas
            ref={mainCanvasRef}
            width={800}
            height={600}
            className="w-full h-full cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ imageRendering: 'pixelated' }}
          />
          
          {/* Overlay UI */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded p-3 text-white">
            <div className="text-sm space-y-1">
              <div>🖱️ Drag to rotate</div>
              <div>🎡 Scroll to zoom</div>
              <div>Objects: {sceneObjects.filter(obj => obj.visible).length}/{sceneObjects.length}</div>
              {selectedObject !== null && (
                <div className="text-yellow-400">
                  Selected: {sceneObjects[selectedObject]?.name}
                </div>
              )}
            </div>
          </div>

          {/* Wavelength indicator */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded p-3">
            <div className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: `rgb(${wavelengthToRGB(hologramState.wavelength).join(',')})` }}
              />
              <span className="text-white text-sm">
                {hologramState.wavelength}nm
              </span>
            </div>
          </div>

          {/* Performance indicator */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 rounded p-2 text-white text-xs">
            <div>Rendering: {visualEffects.hologramQuality}</div>
            <div>FPS: {visualEffects.animation ? '60' : 'Static'}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 p-4 text-center text-gray-400">
        <p className="text-sm">
          Advanced Hologram Generator | Realistic 3D Light Interference Simulation
        </p>
        <p className="text-xs mt-1">
          Use mouse to interact • Add objects from the panel • Adjust laser parameters for different effects
        </p>
      </footer>
    </div>
  );
}

export default App;