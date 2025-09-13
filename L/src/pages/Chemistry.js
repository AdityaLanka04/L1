
import React from 'react';

const Chemistry = () => {
  const simulations = [
    { id: 'periodictable', title: 'Periodic Table', category: 'Elements', description: 'Interactive elemental classification', path: '/chemistry/periodictable' },
    { id: 'neuroscience', title: 'NeuroScience', category: 'Biochemistry', description: 'Neural pathway analysis', path: '/chemistry/neuroscience' },
    { id: 'brainwave', title: 'BrainWave', category: 'Biophysics', description: 'Electrical brain activity patterns', path: '/chemistry/brainwave' }
  ];

  const handleNavigate = (path) => {
    // For demonstration - replace with your actual routing method
    window.location.href = path;
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #7B5B8B 0%, #9F7FAF 35%, #B59FC5 70%, #D1BFD1 100%)',
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
              Chemistry
              <br />
              <span className="opacity-60">Explorer</span>
            </h1>
            <div className="text-sm text-white opacity-80 mt-6 max-w-2xl mx-auto">
              Molecular modeling and chemical reaction simulations with interactive controls and comprehensive molecular visualization
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-normal mb-4 text-white">Available Simulations</h2>
          <p className="text-sm text-white opacity-80 max-w-3xl mx-auto leading-relaxed">
            Each simulation provides molecular interaction models, real-time chemical analysis, 
            and comprehensive data visualization for enhanced chemistry education.
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
                      backgroundColor: index % 3 === 0 ? 'rgba(123, 91, 139, 0.9)' : 
                                     index % 3 === 1 ? 'rgba(159, 127, 175, 0.9)' : 
                                     'rgba(181, 159, 197, 0.9)' 
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
                    Launch →
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Chemistry;