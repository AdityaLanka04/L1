import React from 'react';

const GeographyGamesHub = () => {
  const simulations = [
    { id: 'flagQuiz', title: 'Flag Quiz Challenge', category: 'Cultural', description: 'Timed flag identification challenges', path: '/geography/flagQuiz' },
    { id: 'capitalMatch', title: 'Capital Matching', category: 'Political', description: 'Match countries with their capitals', path: '/geography/capitalMatch' },
    { id: 'landmarkGuess', title: 'Landmark Detective', category: 'Cultural', description: 'Identify famous world landmarks', path: '/geography/landmarkGuess' },
    { id: 'climateZones', title: 'Climate Zones', category: 'Environmental', description: 'Explore global climate patterns', path: '/geography/climateZones' },
    { id: 'oceanCurrents', title: 'Ocean Currents', category: 'Physical', description: 'Marine circulation systems', path: '/geography/oceanCurrents' },
    { id: 'mountainRanges', title: 'Mountain Ranges', category: 'Physical', description: 'Global topographic features', path: '/geography/mountainRanges' }
  ];

  const handleNavigate = (path) => {
    // For demonstration - replace with your actual routing method
    window.location.href = path;
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #8B5A5F 0%, #AF7F7F 35%, #C5A09F 70%, #D1C1BF 100%)',
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
              Geography
              <br />
              <span className="opacity-60">Games Hub</span>
            </h1>
            <div className="text-sm text-white opacity-80 mt-6 max-w-2xl mx-auto">
              Explore the world through interactive geography games with real-time scoring and comprehensive educational content
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-normal mb-4 text-white">Available Games</h2>
          <p className="text-sm text-white opacity-80 max-w-3xl mx-auto leading-relaxed">
            Each game provides interactive challenges, real-time scoring systems, 
            and comprehensive geographical knowledge for enhanced learning outcomes.
          </p>
        </div>

        {/* Games Grid */}
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
                      backgroundColor: index % 4 === 0 ? 'rgba(139, 90, 95, 0.9)' : 
                                     index % 4 === 1 ? 'rgba(175, 127, 127, 0.9)' : 
                                     index % 4 === 2 ? 'rgba(197, 160, 159, 0.9)' : 'rgba(209, 193, 191, 0.9)' 
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
                    Play →
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Learning Features Section */}
        <div className="mt-16 p-8 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
          <h2 className="text-2xl font-normal mb-8 text-center text-white">Learning Features</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(139, 90, 95, 0.8)' }}>
                <span className="text-white text-xl">⏱</span>
              </div>
              <p className="text-sm font-medium text-white">Timed Challenges</p>
              <p className="text-xs text-white opacity-70 mt-1">Real-time scoring</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(175, 127, 127, 0.8)' }}>
                <span className="text-white text-xl">🏆</span>
              </div>
              <p className="text-sm font-medium text-white">Score Tracking</p>
              <p className="text-xs text-white opacity-70 mt-1">Progress analytics</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(197, 160, 159, 0.8)' }}>
                <span className="text-white text-xl">⭐</span>
              </div>
              <p className="text-sm font-medium text-white">Achievement System</p>
              <p className="text-xs text-white opacity-70 mt-1">Milestone rewards</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(209, 193, 191, 0.8)' }}>
                <span className="text-white text-xl">🌍</span>
              </div>
              <p className="text-sm font-medium text-white">Global Knowledge</p>
              <p className="text-xs text-white opacity-70 mt-1">Comprehensive data</p>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">6</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Game Modes</div>
          </div>
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">195</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Countries</div>
          </div>
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">500+</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Landmarks</div>
          </div>
          <div className="text-center p-6 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <div className="text-2xl font-bold text-white mb-1">Real-time</div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Scoring</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeographyGamesHub;