import React from 'react';

const History = () => {
  const simulations = [
    { id: 'timeline', title: 'Interactive Timeline', category: 'Chronology', description: 'Explore major historical events across civilizations', path: '/history/timeline' },
    { id: 'civilizations', title: 'Ancient Civilizations', category: 'Antiquity', description: 'Rise and fall of early human societies', path: '/history/civilizations' },
    { id: 'wars', title: 'Military Conflicts', category: 'Warfare', description: 'Strategic analysis of historical battles', path: '/history/wars' },
    { id: 'revolutions', title: 'Social Revolutions', category: 'Society', description: 'Transformative movements and their impact', path: '/history/revolutions' },
    { id: 'exploration', title: 'Age of Exploration', category: 'Discovery', description: 'Maritime expeditions and global expansion', path: '/history/exploration' },
    { id: 'industrial', title: 'Industrial Revolution', category: 'Technology', description: 'Technological advancement and social change', path: '/history/industrial' }
  ];

  const handleNavigate = (path) => {
    // For demonstration - replace with your actual routing method
    window.location.href = path;
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #8B6B4B 0%, #AF8F6F 35%, #C5A58F 70%, #D1C1A5 100%)',
      fontFamily: "'Lekton', 'Courier New', monospace" 
    }}>
      {/* Header Grid */}
      <div className="border-b-2 border-white border-opacity-30 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="max-w-6xl mx-auto px-8 py-12">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-2 text-white opacity-80">
              Interactive Learning Platform
            </div>
            <h1 className="text-7xl font-normal leading-none tracking-tight text-white">
              History
              <br />
              <span className="opacity-60">Explorer</span>
            </h1>
            <div className="text-sm text-white opacity-80 mt-6 max-w-2xl mx-auto">
              Temporal analysis of human civilization through interactive timelines and comprehensive historical documentation
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-normal mb-4 text-white">Available Explorations</h2>
          <p className="text-sm text-white opacity-80 max-w-3xl mx-auto leading-relaxed">
            Each exploration provides chronological analysis, interactive timelines, 
            and comprehensive historical context for enhanced understanding of human civilization.
          </p>
        </div>

        {/* Simulations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {simulations.map((sim, index) => (
            <button 
              key={sim.id}
              onClick={() => handleNavigate(sim.path)}
              className="group block border border-white border-opacity-30 hover:border-opacity-60 hover:backdrop-blur-md transition-all duration-200 w-full text-left rounded-lg overflow-hidden cursor-pointer"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
            >
              <div className="p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div 
                    className="w-3 h-3 rounded-full group-hover:scale-125 transition-transform border border-white border-opacity-30"
                    style={{ 
                      backgroundColor: index % 4 === 0 ? 'rgba(139, 107, 75, 0.9)' : 
                                     index % 4 === 1 ? 'rgba(175, 143, 111, 0.9)' : 
                                     index % 4 === 2 ? 'rgba(197, 165, 143, 0.9)' : 'rgba(209, 193, 165, 0.9)' 
                    }}
                  ></div>
                </div>

                {/* Content */}
                <div className="mb-6">
                  <div className="text-xs uppercase tracking-wider mb-2 text-gray-700 opacity-80">
                    {sim.category}
                  </div>
                  <h3 className="text-2xl font-normal mb-3 text-gray-900 group-hover:opacity-80 transition-opacity">
                    {sim.title}
                  </h3>
                  <p className="text-sm text-gray-800 opacity-90 leading-relaxed">
                    {sim.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-600 border-opacity-30">
                  <div className="text-xs uppercase tracking-wider text-gray-700 opacity-70">
                    Interactive
                  </div>
                  <div className="text-xs text-gray-800 opacity-80 group-hover:opacity-100 transition-opacity">
                    Explore →
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Historical Periods Section */}
        <div className="mt-16 p-8 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
          <h2 className="text-2xl font-normal mb-8 text-center text-white">Historical Analysis</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(139, 107, 75, 0.8)' }}>
                <span className="text-white text-xl">📜</span>
              </div>
              <p className="text-sm font-medium text-white">Primary Sources</p>
              <p className="text-xs text-white opacity-70 mt-1">Historical documents</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(175, 143, 111, 0.8)' }}>
                <span className="text-white text-xl">⏰</span>
              </div>
              <p className="text-sm font-medium text-white">Timeline Analysis</p>
              <p className="text-xs text-white opacity-70 mt-1">Chronological study</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(197, 165, 143, 0.8)' }}>
                <span className="text-white text-xl">🗺️</span>
              </div>
              <p className="text-sm font-medium text-white">Geographical Context</p>
              <p className="text-xs text-white opacity-70 mt-1">Spatial analysis</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(209, 193, 165, 0.8)' }}>
                <span className="text-white text-xl">👥</span>
              </div>
              <p className="text-sm font-medium text-white">Social Impact</p>
              <p className="text-xs text-white opacity-70 mt-1">Cultural transformation</p>
            </div>
          </div>
        </div>

        {/* Era Statistics */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">5000+</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Years Covered</div>
          </div>
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">50+</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Civilizations</div>
          </div>
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">1000+</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Key Events</div>
          </div>
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">Interactive</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Timeline</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;