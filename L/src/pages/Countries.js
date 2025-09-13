import React, { useState, useEffect, useRef } from 'react';

// Load Leaflet CSS
const loadLeafletCSS = () => {
  if (typeof document !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
};

const CountryGuessingGame = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [currentCountry, setCurrentCountry] = useState(null);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [geoJsonLayer, setGeoJsonLayer] = useState(null);
  const [countries, setCountries] = useState([]);
  const [usedCountries, setUsedCountries] = useState(new Set());

  // Sample countries with coordinates for the game
  const gameCountries = [
    { name: 'United States', code: 'US', hint: 'Land of the free, home of the brave' },
    { name: 'Brazil', code: 'BR', hint: 'Largest country in South America' },
    { name: 'Russia', code: 'RU', hint: 'Largest country in the world' },
    { name: 'China', code: 'CN', hint: 'Most populous country' },
    { name: 'India', code: 'IN', hint: 'Known for the Taj Mahal' },
    { name: 'Australia', code: 'AU', hint: 'The land down under' },
    { name: 'Canada', code: 'CA', hint: 'Known for maple syrup and hockey' },
    { name: 'Germany', code: 'DE', hint: 'Heart of Europe' },
    { name: 'France', code: 'FR', hint: 'City of lights capital' },
    { name: 'Japan', code: 'JP', hint: 'Land of the rising sun' },
    { name: 'United Kingdom', code: 'GB', hint: 'Home of Big Ben' },
    { name: 'Italy', code: 'IT', hint: 'Boot-shaped peninsula' },
    { name: 'Spain', code: 'ES', hint: 'Famous for flamenco and paella' },
    { name: 'Egypt', code: 'EG', hint: 'Home of the pyramids' },
    { name: 'South Africa', code: 'ZA', hint: 'Rainbow nation' },
    { name: 'Mexico', code: 'MX', hint: 'Famous for tacos and Day of the Dead' },
    { name: 'Argentina', code: 'AR', hint: 'Land of tango' },
    { name: 'Turkey', code: 'TR', hint: 'Bridges Europe and Asia' },
    { name: 'Saudi Arabia', code: 'SA', hint: 'Desert kingdom' },
    { name: 'Thailand', code: 'TH', hint: 'Land of smiles' }
  ];

  useEffect(() => {
    // Load Leaflet CSS first
    loadLeafletCSS();
    
    // Initialize Leaflet map
    const initMap = async () => {
      if (typeof window !== 'undefined' && !map) {
        // Load Leaflet dynamically
        const L = (await import('leaflet')).default;
        
        // Create map with better options
        const mapInstance = L.map(mapRef.current, {
          center: [30, 0],
          zoom: 2,
          minZoom: 1,
          maxZoom: 10,
          zoomControl: true,
          scrollWheelZoom: true,
          dragging: true,
          worldCopyJump: true
        });

        // Add high-quality tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 10,
          tileSize: 256,
          zoomOffset: 0
        }).addTo(mapInstance);

        // Set bounds for better world view
        mapInstance.setMaxBounds([[-90, -180], [90, 180]]);

        setMap(mapInstance);
        loadCountriesData(mapInstance, L);
      }
    };

    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  const loadCountriesData = async (mapInstance, L) => {
    try {
      // Using a simplified world countries GeoJSON from a public API
      const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
      const worldData = await response.json();
      
      // Convert TopoJSON to GeoJSON (simplified approach)
      // For a real implementation, you'd use topojson library
      // Here we'll create a simple polygon layer for demonstration
      
      const geoLayer = L.geoJSON(null, {
        style: (feature) => ({
          fillColor: '#3388ff',
          weight: 1,
          opacity: 1,
          color: '#666',
          fillOpacity: 0.3
        }),
        onEachFeature: (feature, layer) => {
          layer.on({
            click: (e) => handleCountryClick(feature, layer),
            mouseover: (e) => {
              layer.setStyle({
                fillColor: '#ff7800',
                fillOpacity: 0.7
              });
            },
            mouseout: (e) => {
              if (!currentCountry || feature.properties.NAME !== currentCountry.name) {
                layer.setStyle({
                  fillColor: '#3388ff',
                  fillOpacity: 0.3
                });
              }
            }
          });
        }
      });

      // For demo purposes, we'll create simple country boundaries
      // In a real app, you'd load actual GeoJSON country data
      createDemoCountries(mapInstance, L);
      
    } catch (error) {
      console.error('Error loading countries data:', error);
      createDemoCountries(mapInstance, L);
    }
  };

  const createDemoCountries = (mapInstance, L) => {
    // Better country polygons with more accurate boundaries
    const demoCountries = [
      { 
        name: 'United States', 
        bounds: [[24.396308, -124.848974], [49.384358, -66.885444]],
        color: '#FF6B6B'
      },
      { 
        name: 'Brazil', 
        bounds: [[-33.750000, -73.985535], [5.264877, -34.729993]],
        color: '#4ECDC4'
      },
      { 
        name: 'Russia', 
        bounds: [[41.151416, 19.638573], [81.857361, 179.999989]],
        color: '#45B7D1'
      },
      { 
        name: 'China', 
        bounds: [[18.197700, 73.557692], [53.560974, 134.773911]],
        color: '#96CEB4'
      },
      { 
        name: 'Australia', 
        bounds: [[-43.634597, 113.338953], [-10.668187, 153.569469]],
        color: '#FECA57'
      },
      { 
        name: 'Canada', 
        bounds: [[41.675105, -141.000000], [83.110626, -52.636291]],
        color: '#FF9FF3'
      },
      { 
        name: 'India', 
        bounds: [[8.067229, 68.162386], [35.508742, 97.395561]],
        color: '#54A0FF'
      },
      { 
        name: 'Argentina', 
        bounds: [[-55.050000, -73.560000], [-21.780000, -53.650000]],
        color: '#5F27CD'
      }
    ];

    demoCountries.forEach(country => {
      // Create better styled polygons
      const rectangle = L.rectangle(country.bounds, {
        fillColor: country.color,
        weight: 2,
        opacity: 1,
        color: '#2c3e50',
        fillOpacity: 0.4,
        className: 'country-polygon'
      });

      rectangle.addTo(mapInstance);
      rectangle.countryName = country.name;
      
      // Add country label
      const center = rectangle.getBounds().getCenter();
      const label = L.marker(center, {
        icon: L.divIcon({
          className: 'country-label',
          html: `<div style="
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            border: 1px solid #ccc;
            white-space: nowrap;
            pointer-events: none;
          ">${country.name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        })
      }).addTo(mapInstance);

      rectangle.on({
        click: () => handleCountryClick({ properties: { NAME: country.name } }, rectangle),
        mouseover: (e) => {
          rectangle.setStyle({
            fillColor: '#FF6B35',
            fillOpacity: 0.8,
            weight: 3
          });
          // Show tooltip
          rectangle.bindTooltip(`Click to select ${country.name}`, {
            permanent: false,
            direction: 'center',
            className: 'country-tooltip'
          }).openTooltip();
        },
        mouseout: (e) => {
          if (!currentCountry || country.name !== currentCountry.name) {
            rectangle.setStyle({
              fillColor: country.color,
              fillOpacity: 0.4,
              weight: 2
            });
          }
          rectangle.closeTooltip();
        }
      });
    });
  };

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setTotalQuestions(0);
    setUsedCountries(new Set());
    selectRandomCountry();
  };

  const selectRandomCountry = () => {
    const availableCountries = gameCountries.filter(
      country => !usedCountries.has(country.name)
    );
    
    if (availableCountries.length === 0) {
      endGame();
      return;
    }

    const randomCountry = availableCountries[Math.floor(Math.random() * availableCountries.length)];
    setCurrentCountry(randomCountry);
    setFeedback('');
  };

  const handleCountryClick = (feature, layer) => {
    if (!gameStarted || !currentCountry) return;

    const clickedCountryName = feature.properties.NAME || layer.countryName;
    const isCorrect = clickedCountryName === currentCountry.name;

    setTotalQuestions(prev => prev + 1);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback('🎉 Correct! Well done!');
      layer.setStyle({
        fillColor: '#00ff00',
        fillOpacity: 0.8
      });
    } else {
      setFeedback(`❌ Wrong! That's ${clickedCountryName}. The correct answer was ${currentCountry.name}.`);
      layer.setStyle({
        fillColor: '#ff0000',
        fillOpacity: 0.8
      });
    }

    setUsedCountries(prev => new Set([...prev, currentCountry.name]));

    setTimeout(() => {
      layer.setStyle({
        fillColor: '#3388ff',
        fillOpacity: 0.3
      });
      selectRandomCountry();
    }, 2000);
  };

  const endGame = () => {
    setGameStarted(false);
    setFeedback(`🏆 Game Over! Final Score: ${score}/${totalQuestions} (${Math.round((score/totalQuestions) * 100)}%)`);
    setCurrentCountry(null);
  };

  const resetGame = () => {
    setGameStarted(false);
    setScore(0);
    setTotalQuestions(0);
    setCurrentCountry(null);
    setFeedback('');
    setUsedCountries(new Set());
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-100">
      {/* Game Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🌍 Country Guessing Game</h1>
          <div className="flex items-center space-x-4">
            <div className="text-lg">
              Score: <span className="font-bold">{score}/{totalQuestions}</span>
            </div>
            {gameStarted ? (
              <button
                onClick={resetGame}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Reset Game
              </button>
            ) : (
              <button
                onClick={startGame}
                className="bg-green-500 hover:bg-green-600 px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Info Panel */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-6xl mx-auto">
          {!gameStarted && !feedback && (
            <div className="text-center">
              <p className="text-lg text-gray-600 mb-2">
                Click "Start Game" to begin! You'll be asked to find countries on the map.
              </p>
              <p className="text-sm text-gray-500">
                Click on the correct country when prompted. Hover over countries to highlight them.
              </p>
            </div>
          )}
          
          {currentCountry && (
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Find: <span className="text-blue-600">{currentCountry.name}</span>
              </h2>
              <p className="text-gray-600 italic">Hint: {currentCountry.hint}</p>
            </div>
          )}
          
          {feedback && (
            <div className="text-center">
              <p className="text-lg font-semibold">{feedback}</p>
            </div>
          )}
        </div>
      </div>

      /* Map Container with better styling */
      <div className="flex-1 relative bg-blue-50">
        <div 
          ref={mapRef} 
          className="w-full h-full border-2 border-gray-300 rounded-lg shadow-inner"
          style={{ 
            minHeight: '500px',
            background: 'linear-gradient(180deg, #87CEEB 0%, #98D8E8 100%)'
          }}
        />
        
        {/* Game Instructions Overlay */}
        {!gameStarted && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
            <h3 className="font-bold text-lg mb-2">How to Play:</h3>
            <ul className="text-sm space-y-1">
              <li>• Click "Start Game" to begin</li>
              <li>• A country name will appear above</li>
              <li>• Click on that country on the map</li>
              <li>• Hover over countries to highlight them</li>
              <li>• Try to get the highest score possible!</li>
            </ul>
          </div>
        )}

        {/* Progress Indicator */}
        {gameStarted && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3">
            <div className="text-sm text-gray-600">
              Countries Found: {usedCountries.size}/{gameCountries.length}
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(usedCountries.size / gameCountries.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryGuessingGame;