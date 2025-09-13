import React, { useState, useEffect } from 'react';

function PeriodicTableChallenge() {
  // State variables
  const [input, setInput] = useState('');
  const [guessedElements, setGuessedElements] = useState([]);
  const [message, setMessage] = useState('Begin elemental identification');
  const [remainingCount, setRemainingCount] = useState(118);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [hint, setHint] = useState('');
  const [showLegend, setShowLegend] = useState(true);

  // Hardcoded periodic table data
  const periodicTableData = [
    { atomicNumber: 1, symbol: 'H', name: 'Hydrogen', category: 'nonmetal', group: 1, period: 1 },
    { atomicNumber: 2, symbol: 'He', name: 'Helium', category: 'noble gas', group: 18, period: 1 },
    { atomicNumber: 3, symbol: 'Li', name: 'Lithium', category: 'alkali metal', group: 1, period: 2 },
    { atomicNumber: 4, symbol: 'Be', name: 'Beryllium', category: 'alkaline earth metal', group: 2, period: 2 },
    { atomicNumber: 5, symbol: 'B', name: 'Boron', category: 'metalloid', group: 13, period: 2 },
    { atomicNumber: 6, symbol: 'C', name: 'Carbon', category: 'nonmetal', group: 14, period: 2 },
    { atomicNumber: 7, symbol: 'N', name: 'Nitrogen', category: 'nonmetal', group: 15, period: 2 },
    { atomicNumber: 8, symbol: 'O', name: 'Oxygen', category: 'nonmetal', group: 16, period: 2 },
    { atomicNumber: 9, symbol: 'F', name: 'Fluorine', category: 'halogen', group: 17, period: 2 },
    { atomicNumber: 10, symbol: 'Ne', name: 'Neon', category: 'noble gas', group: 18, period: 2 },
    { atomicNumber: 11, symbol: 'Na', name: 'Sodium', category: 'alkali metal', group: 1, period: 3 },
    { atomicNumber: 12, symbol: 'Mg', name: 'Magnesium', category: 'alkaline earth metal', group: 2, period: 3 },
    { atomicNumber: 13, symbol: 'Al', name: 'Aluminum', category: 'post-transition metal', group: 13, period: 3 },
    { atomicNumber: 14, symbol: 'Si', name: 'Silicon', category: 'metalloid', group: 14, period: 3 },
    { atomicNumber: 15, symbol: 'P', name: 'Phosphorus', category: 'nonmetal', group: 15, period: 3 },
    { atomicNumber: 16, symbol: 'S', name: 'Sulfur', category: 'nonmetal', group: 16, period: 3 },
    { atomicNumber: 17, symbol: 'Cl', name: 'Chlorine', category: 'halogen', group: 17, period: 3 },
    { atomicNumber: 18, symbol: 'Ar', name: 'Argon', category: 'noble gas', group: 18, period: 3 },
    { atomicNumber: 19, symbol: 'K', name: 'Potassium', category: 'alkali metal', group: 1, period: 4 },
    { atomicNumber: 20, symbol: 'Ca', name: 'Calcium', category: 'alkaline earth metal', group: 2, period: 4 },
    { atomicNumber: 21, symbol: 'Sc', name: 'Scandium', category: 'transition metal', group: 3, period: 4 },
    { atomicNumber: 22, symbol: 'Ti', name: 'Titanium', category: 'transition metal', group: 4, period: 4 },
    { atomicNumber: 23, symbol: 'V', name: 'Vanadium', category: 'transition metal', group: 5, period: 4 },
    { atomicNumber: 24, symbol: 'Cr', name: 'Chromium', category: 'transition metal', group: 6, period: 4 },
    { atomicNumber: 25, symbol: 'Mn', name: 'Manganese', category: 'transition metal', group: 7, period: 4 },
    { atomicNumber: 26, symbol: 'Fe', name: 'Iron', category: 'transition metal', group: 8, period: 4 },
    { atomicNumber: 27, symbol: 'Co', name: 'Cobalt', category: 'transition metal', group: 9, period: 4 },
    { atomicNumber: 28, symbol: 'Ni', name: 'Nickel', category: 'transition metal', group: 10, period: 4 },
    { atomicNumber: 29, symbol: 'Cu', name: 'Copper', category: 'transition metal', group: 11, period: 4 },
    { atomicNumber: 30, symbol: 'Zn', name: 'Zinc', category: 'transition metal', group: 12, period: 4 },
    { atomicNumber: 31, symbol: 'Ga', name: 'Gallium', category: 'post-transition metal', group: 13, period: 4 },
    { atomicNumber: 32, symbol: 'Ge', name: 'Germanium', category: 'metalloid', group: 14, period: 4 },
    { atomicNumber: 33, symbol: 'As', name: 'Arsenic', category: 'metalloid', group: 15, period: 4 },
    { atomicNumber: 34, symbol: 'Se', name: 'Selenium', category: 'nonmetal', group: 16, period: 4 },
    { atomicNumber: 35, symbol: 'Br', name: 'Bromine', category: 'halogen', group: 17, period: 4 },
    { atomicNumber: 36, symbol: 'Kr', name: 'Krypton', category: 'noble gas', group: 18, period: 4 },
    { atomicNumber: 37, symbol: 'Rb', name: 'Rubidium', category: 'alkali metal', group: 1, period: 5 },
    { atomicNumber: 38, symbol: 'Sr', name: 'Strontium', category: 'alkaline earth metal', group: 2, period: 5 },
    { atomicNumber: 39, symbol: 'Y', name: 'Yttrium', category: 'transition metal', group: 3, period: 5 },
    { atomicNumber: 40, symbol: 'Zr', name: 'Zirconium', category: 'transition metal', group: 4, period: 5 },
    { atomicNumber: 41, symbol: 'Nb', name: 'Niobium', category: 'transition metal', group: 5, period: 5 },
    { atomicNumber: 42, symbol: 'Mo', name: 'Molybdenum', category: 'transition metal', group: 6, period: 5 },
    { atomicNumber: 43, symbol: 'Tc', name: 'Technetium', category: 'transition metal', group: 7, period: 5 },
    { atomicNumber: 44, symbol: 'Ru', name: 'Ruthenium', category: 'transition metal', group: 8, period: 5 },
    { atomicNumber: 45, symbol: 'Rh', name: 'Rhodium', category: 'transition metal', group: 9, period: 5 },
    { atomicNumber: 46, symbol: 'Pd', name: 'Palladium', category: 'transition metal', group: 10, period: 5 },
    { atomicNumber: 47, symbol: 'Ag', name: 'Silver', category: 'transition metal', group: 11, period: 5 },
    { atomicNumber: 48, symbol: 'Cd', name: 'Cadmium', category: 'transition metal', group: 12, period: 5 },
    { atomicNumber: 49, symbol: 'In', name: 'Indium', category: 'post-transition metal', group: 13, period: 5 },
    { atomicNumber: 50, symbol: 'Sn', name: 'Tin', category: 'post-transition metal', group: 14, period: 5 },
    { atomicNumber: 51, symbol: 'Sb', name: 'Antimony', category: 'metalloid', group: 15, period: 5 },
    { atomicNumber: 52, symbol: 'Te', name: 'Tellurium', category: 'metalloid', group: 16, period: 5 },
    { atomicNumber: 53, symbol: 'I', name: 'Iodine', category: 'halogen', group: 17, period: 5 },
    { atomicNumber: 54, symbol: 'Xe', name: 'Xenon', category: 'noble gas', group: 18, period: 5 },
    { atomicNumber: 55, symbol: 'Cs', name: 'Cesium', category: 'alkali metal', group: 1, period: 6 },
    { atomicNumber: 56, symbol: 'Ba', name: 'Barium', category: 'alkaline earth metal', group: 2, period: 6 },
    { atomicNumber: 57, symbol: 'La', name: 'Lanthanum', category: 'lanthanoid', group: 3, period: 6 },
    { atomicNumber: 58, symbol: 'Ce', name: 'Cerium', category: 'lanthanoid', group: 4, period: 8 },
    { atomicNumber: 59, symbol: 'Pr', name: 'Praseodymium', category: 'lanthanoid', group: 5, period: 8 },
    { atomicNumber: 60, symbol: 'Nd', name: 'Neodymium', category: 'lanthanoid', group: 6, period: 8 },
    { atomicNumber: 61, symbol: 'Pm', name: 'Promethium', category: 'lanthanoid', group: 7, period: 8 },
    { atomicNumber: 62, symbol: 'Sm', name: 'Samarium', category: 'lanthanoid', group: 8, period: 8 },
    { atomicNumber: 63, symbol: 'Eu', name: 'Europium', category: 'lanthanoid', group: 9, period: 8 },
    { atomicNumber: 64, symbol: 'Gd', name: 'Gadolinium', category: 'lanthanoid', group: 10, period: 8 },
    { atomicNumber: 65, symbol: 'Tb', name: 'Terbium', category: 'lanthanoid', group: 11, period: 8 },
    { atomicNumber: 66, symbol: 'Dy', name: 'Dysprosium', category: 'lanthanoid', group: 12, period: 8 },
    { atomicNumber: 67, symbol: 'Ho', name: 'Holmium', category: 'lanthanoid', group: 13, period: 8 },
    { atomicNumber: 68, symbol: 'Er', name: 'Erbium', category: 'lanthanoid', group: 14, period: 8 },
    { atomicNumber: 69, symbol: 'Tm', name: 'Thulium', category: 'lanthanoid', group: 15, period: 8 },
    { atomicNumber: 70, symbol: 'Yb', name: 'Ytterbium', category: 'lanthanoid', group: 16, period: 8 },
    { atomicNumber: 71, symbol: 'Lu', name: 'Lutetium', category: 'lanthanoid', group: 17, period: 8 },
    { atomicNumber: 72, symbol: 'Hf', name: 'Hafnium', category: 'transition metal', group: 4, period: 6 },
    { atomicNumber: 73, symbol: 'Ta', name: 'Tantalum', category: 'transition metal', group: 5, period: 6 },
    { atomicNumber: 74, symbol: 'W', name: 'Tungsten', category: 'transition metal', group: 6, period: 6 },
    { atomicNumber: 75, symbol: 'Re', name: 'Rhenium', category: 'transition metal', group: 7, period: 6 },
    { atomicNumber: 76, symbol: 'Os', name: 'Osmium', category: 'transition metal', group: 8, period: 6 },
    { atomicNumber: 77, symbol: 'Ir', name: 'Iridium', category: 'transition metal', group: 9, period: 6 },
    { atomicNumber: 78, symbol: 'Pt', name: 'Platinum', category: 'transition metal', group: 10, period: 6 },
    { atomicNumber: 79, symbol: 'Au', name: 'Gold', category: 'transition metal', group: 11, period: 6 },
    { atomicNumber: 80, symbol: 'Hg', name: 'Mercury', category: 'transition metal', group: 12, period: 6 },
    { atomicNumber: 81, symbol: 'Tl', name: 'Thallium', category: 'post-transition metal', group: 13, period: 6 },
    { atomicNumber: 82, symbol: 'Pb', name: 'Lead', category: 'post-transition metal', group: 14, period: 6 },
    { atomicNumber: 83, symbol: 'Bi', name: 'Bismuth', category: 'post-transition metal', group: 15, period: 6 },
    { atomicNumber: 84, symbol: 'Po', name: 'Polonium', category: 'post-transition metal', group: 16, period: 6 },
    { atomicNumber: 85, symbol: 'At', name: 'Astatine', category: 'halogen', group: 17, period: 6 },
    { atomicNumber: 86, symbol: 'Rn', name: 'Radon', category: 'noble gas', group: 18, period: 6 },
    { atomicNumber: 87, symbol: 'Fr', name: 'Francium', category: 'alkali metal', group: 1, period: 7 },
    { atomicNumber: 88, symbol: 'Ra', name: 'Radium', category: 'alkaline earth metal', group: 2, period: 7 },
    { atomicNumber: 89, symbol: 'Ac', name: 'Actinium', category: 'actinoid', group: 3, period: 7 },
    { atomicNumber: 90, symbol: 'Th', name: 'Thorium', category: 'actinoid', group: 4, period: 9 },
    { atomicNumber: 91, symbol: 'Pa', name: 'Protactinium', category: 'actinoid', group: 5, period: 9 },
    { atomicNumber: 92, symbol: 'U', name: 'Uranium', category: 'actinoid', group: 6, period: 9 },
    { atomicNumber: 93, symbol: 'Np', name: 'Neptunium', category: 'actinoid', group: 7, period: 9 },
    { atomicNumber: 94, symbol: 'Pu', name: 'Plutonium', category: 'actinoid', group: 8, period: 9 },
    { atomicNumber: 95, symbol: 'Am', name: 'Americium', category: 'actinoid', group: 9, period: 9 },
    { atomicNumber: 96, symbol: 'Cm', name: 'Curium', category: 'actinoid', group: 10, period: 9 },
    { atomicNumber: 97, symbol: 'Bk', name: 'Berkelium', category: 'actinoid', group: 11, period: 9 },
    { atomicNumber: 98, symbol: 'Cf', name: 'Californium', category: 'actinoid', group: 12, period: 9 },
    { atomicNumber: 99, symbol: 'Es', name: 'Einsteinium', category: 'actinoid', group: 13, period: 9 },
    { atomicNumber: 100, symbol: 'Fm', name: 'Fermium', category: 'actinoid', group: 14, period: 9 },
    { atomicNumber: 101, symbol: 'Md', name: 'Mendelevium', category: 'actinoid', group: 15, period: 9 },
    { atomicNumber: 102, symbol: 'No', name: 'Nobelium', category: 'actinoid', group: 16, period: 9 },
    { atomicNumber: 103, symbol: 'Lr', name: 'Lawrencium', category: 'actinoid', group: 17, period: 9 },
    { atomicNumber: 104, symbol: 'Rf', name: 'Rutherfordium', category: 'transition metal', group: 4, period: 7 },
    { atomicNumber: 105, symbol: 'Db', name: 'Dubnium', category: 'transition metal', group: 5, period: 7 },
    { atomicNumber: 106, symbol: 'Sg', name: 'Seaborgium', category: 'transition metal', group: 6, period: 7 },
    { atomicNumber: 107, symbol: 'Bh', name: 'Bohrium', category: 'transition metal', group: 7, period: 7 },
    { atomicNumber: 108, symbol: 'Hs', name: 'Hassium', category: 'transition metal', group: 8, period: 7 },
    { atomicNumber: 109, symbol: 'Mt', name: 'Meitnerium', category: 'unknown', group: 9, period: 7 },
    { atomicNumber: 110, symbol: 'Ds', name: 'Darmstadtium', category: 'unknown', group: 10, period: 7 },
    { atomicNumber: 111, symbol: 'Rg', name: 'Roentgenium', category: 'unknown', group: 11, period: 7 },
    { atomicNumber: 112, symbol: 'Cn', name: 'Copernicium', category: 'transition metal', group: 12, period: 7 },
    { atomicNumber: 113, symbol: 'Nh', name: 'Nihonium', category: 'unknown', group: 13, period: 7 },
    { atomicNumber: 114, symbol: 'Fl', name: 'Flerovium', category: 'unknown', group: 14, period: 7 },
    { atomicNumber: 115, symbol: 'Mc', name: 'Moscovium', category: 'unknown', group: 15, period: 7 },
    { atomicNumber: 116, symbol: 'Lv', name: 'Livermorium', category: 'unknown', group: 16, period: 7 },
    { atomicNumber: 117, symbol: 'Ts', name: 'Tennessine', category: 'unknown', group: 17, period: 7 },
    { atomicNumber: 118, symbol: 'Og', name: 'Oganesson', category: 'unknown', group: 18, period: 7 }
  ];

  // Timer effect
  useEffect(() => {
    if (startTime && !gameComplete) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTime, gameComplete]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Process guesses
  const handleGuess = () => {
    if (!startTime) {
      setStartTime(Date.now());
    }

    const cleanInput = input.trim().toLowerCase();
    if (cleanInput === '') return;

    const foundElement = periodicTableData.find(
      elem => elem.name.toLowerCase() === cleanInput || elem.symbol.toLowerCase() === cleanInput
    );

    if (foundElement) {
      if (guessedElements.includes(foundElement.atomicNumber)) {
        setMessage(`Element ${foundElement.name} previously identified`);
      } else {
        setGuessedElements([...guessedElements, foundElement.atomicNumber]);
        setRemainingCount(remainingCount - 1);
        setMessage(`Confirmed: ${foundElement.name} (${foundElement.symbol}) | ${foundElement.category}`);

        if (remainingCount - 1 === 0) {
          setGameComplete(true);
          setMessage(`Complete periodic table identification | Duration: ${formatTime(elapsedTime)}`);
        }
      }
    } else {
      setMessage(`"${input}" is not a recognized element designation`);
    }

    setInput('');
    setHint('');
  };

  // Reset the game
  const resetGame = () => {
    setGuessedElements([]);
    setMessage('Begin elemental identification');
    setRemainingCount(118);
    setStartTime(null);
    setElapsedTime(0);
    setGameComplete(false);
    setInput('');
    setHint('');
  };

  // Provide a hint
  const getHint = () => {
    const unguessedElements = periodicTableData.filter(
      elem => !guessedElements.includes(elem.atomicNumber)
    );

    if (unguessedElements.length > 0) {
      const randomElement = unguessedElements[Math.floor(Math.random() * unguessedElements.length)];
      setHint(`Atomic number ${randomElement.atomicNumber} | Classification: ${randomElement.category}`);
    }
  };

  // Get color based on element category with purple chemistry theme
  const getCategoryColor = (category) => {
    const colors = {
      'nonmetal': 'rgba(123, 91, 139, 0.8)',
      'noble gas': 'rgba(159, 127, 175, 0.9)',
      'alkali metal': 'rgba(181, 159, 197, 0.7)',
      'alkaline earth metal': 'rgba(209, 193, 221, 0.8)',
      'metalloid': 'rgba(123, 91, 139, 0.6)',
      'post-transition metal': 'rgba(159, 127, 175, 0.7)',
      'transition metal': 'rgba(181, 159, 197, 0.8)',
      'halogen': 'rgba(123, 91, 139, 0.9)',
      'lanthanoid': 'rgba(159, 127, 175, 0.6)',
      'actinoid': 'rgba(181, 159, 197, 0.6)',
      'unknown': 'rgba(209, 193, 221, 0.5)'
    };
    return colors[category] || 'rgba(209, 193, 221, 0.5)';
  };

  // Create a mapping of elements by period and group for easier rendering
  const elementsByPosition = {};
  periodicTableData.forEach(element => {
    const key = `${element.period}-${element.group}`;
    elementsByPosition[key] = element;
  });

  // Generate the periodic table grid
  const renderPeriodicTable = () => {
    const grid = {};
    
    // Initialize grid with empty cells
    for (let period = 1; period <= 7; period++) {
      grid[period] = {};
      for (let group = 1; group <= 18; group++) {
        grid[period][group] = null;
      }
    }
    
    // Add special rows for lanthanides and actinides
    grid[8] = {};
    grid[9] = {};
    for (let group = 4; group <= 17; group++) {
      grid[8][group] = null;
      grid[9][group] = null;
    }
    
    // Fill in the elements
    periodicTableData.forEach(element => {
      grid[element.period][element.group] = element;
    });
    
    // Generate main table (periods 1-7)
    const mainTable = [];
    for (let period = 1; period <= 7; period++) {
      const row = [];
      for (let group = 1; group <= 18; group++) {
        const element = grid[period][group];
        row.push(
          <div 
            key={`${period}-${group}`} 
            className="w-12 h-12 flex flex-col items-center justify-center text-center p-1 m-0.5"
          >
            {element ? renderElement(element) : null}
          </div>
        );
      }
      mainTable.push(
        <div key={`period-${period}`} className="flex flex-row">
          {row}
        </div>
      );
    }
    
    // Generate lanthanide and actinide rows
    const specialRows = [];
    for (let period = 8; period <= 9; period++) {
      const row = [];
      
      // Add spacers for the first 3 columns
      for (let i = 1; i <= 3; i++) {
        row.push(
          <div key={`${period}-spacer-${i}`} className="w-8 h-12 m-0.5"></div>
        );
      }
      
      // Add elements
      for (let group = 4; group <= 17; group++) {
        const element = grid[period][group];
        row.push(
          <div 
            key={`${period}-${group}`} 
            className="w-12 h-12 flex flex-col items-center justify-center text-center p-1 m-0.5"
          >
            {element ? renderElement(element) : null}
          </div>
        );
      }
      
      specialRows.push(
        <div key={`period-${period}`} className="flex flex-row mt-2">
          {row}
        </div>
      );
    }
    
    return (
      <div className="pt-4 overflow-x-auto">
        <div className="mb-2 min-w-fit">{mainTable}</div>
        <div className="mt-4 min-w-fit">{specialRows}</div>
      </div>
    );
  };
  
  // Render individual element cell
  const renderElement = (element) => {
    const isGuessed = guessedElements.includes(element.atomicNumber);
    
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center border border-white border-opacity-30 rounded text-xs font-mono"
        style={{ 
          backgroundColor: isGuessed ? getCategoryColor(element.category) : 'rgba(255, 255, 255, 0.1)',
          color: isGuessed ? '#2D1B45' : 'rgba(255, 255, 255, 0.5)'
        }}
      >
        {isGuessed ? (
          <>
            <div className="text-xs font-bold">{element.atomicNumber}</div>
            <div className="text-sm font-bold">{element.symbol}</div>
          </>
        ) : (
          <div className="text-xs font-bold">{element.atomicNumber}</div>
        )}
      </div>
    );
  };

  // Legend for element categories
  const renderLegend = () => {
    const categories = [
      'nonmetal',
      'noble gas',
      'alkali metal',
      'alkaline earth metal',
      'metalloid',
      'post-transition metal',
      'transition metal',
      'halogen',
      'lanthanoid',
      'actinoid',
      'unknown'
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {categories.map(category => (
          <div key={category} className="flex items-center">
            <div 
              className="w-3 h-3 rounded mr-2 border border-white border-opacity-30"
              style={{ backgroundColor: getCategoryColor(category) }}
            ></div>
            <span className="text-xs text-white opacity-80 uppercase tracking-wide">{category.replace(' ', ' ')}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #7B5B8B 0%, #9F7FAF 35%, #B59FC5 70%, #D1BFD1 100%)',
      fontFamily: "'Lekton', 'Courier New', monospace" 
    }}>
      {/* Header */}
      <div className="border-b border-white border-opacity-20 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs uppercase tracking-wider text-white opacity-60 mb-1">
                Chemical Element Identification
              </div>
              <h1 className="text-3xl font-normal text-white">Periodic Table Challenge</h1>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowLegend(!showLegend)}
                className="flex items-center px-4 py-2 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
              >
                {showLegend ? 'Hide Legend' : 'Show Legend'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Control Panel */}
        <div className="mb-8 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-1">
                Remaining Elements
              </div>
              <div className="text-2xl font-mono text-gray-900">{remainingCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-1">
                Elements Identified
              </div>
              <div className="text-2xl font-mono text-gray-900">{guessedElements.length}</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-gray-800 opacity-70 mb-1">
                Elapsed Time
              </div>
              <div className="text-2xl font-mono text-gray-900">{formatTime(elapsedTime)}</div>
            </div>
          </div>

          <div className="flex mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGuess()}
              className="flex-grow p-3 border border-white border-opacity-30 rounded-l focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30 text-gray-900 font-mono"
              placeholder="Enter element name or symbol..."
              disabled={gameComplete}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
            />
            <button
              onClick={handleGuess}
              className="px-6 py-3 border border-white border-opacity-30 text-white rounded-r hover:bg-white hover:bg-opacity-10 transition uppercase tracking-wide"
              disabled={gameComplete}
            >
              Identify
            </button>
          </div>

          <div className="mb-4 text-center">
            <p className="text-gray-800 font-mono text-sm">
              {message}
            </p>
            {hint && (
              <p className="text-gray-700 font-mono text-xs mt-2 opacity-90">
                {hint}
              </p>
            )}
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={getHint}
              className="px-4 py-2 border border-white border-opacity-30 text-white rounded hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
              disabled={gameComplete}
            >
              Generate Hint
            </button>
            <button
              onClick={resetGame}
              className="px-4 py-2 border border-white border-opacity-30 text-white rounded hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
            >
              Reset Challenge
            </button>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mb-8 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <h3 className="text-lg font-medium text-white mb-4 uppercase tracking-wide">
              Element Classification
            </h3>
            {renderLegend()}
          </div>
        )}

        {/* Periodic Table */}
        <div className="p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
          <div className="text-xs uppercase tracking-wider text-white opacity-70 mb-4 text-center">
            Interactive Periodic Table | 118 Chemical Elements
          </div>
          <div className="flex justify-center">
            {renderPeriodicTable()}
          </div>
        </div>

        {/* Progress Statistics */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="text-lg font-mono text-white mb-1">
              {Math.round((guessedElements.length / periodicTableData.length) * 100)}%
            </div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Completion</div>
          </div>
          <div className="text-center p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="text-lg font-mono text-white mb-1">
              {guessedElements.filter(num => {
                const elem = periodicTableData.find(e => e.atomicNumber === num);
                return elem && elem.category === 'transition metal';
              }).length}
            </div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Transition Metals</div>
          </div>
          <div className="text-center p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="text-lg font-mono text-white mb-1">
              {guessedElements.filter(num => {
                const elem = periodicTableData.find(e => e.atomicNumber === num);
                return elem && elem.category === 'nonmetal';
              }).length}
            </div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Nonmetals</div>
          </div>
          <div className="text-center p-4 rounded-lg border border-white border-opacity-20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="text-lg font-mono text-white mb-1">
              {startTime ? Math.round(guessedElements.length / (elapsedTime / 60)) || 0 : 0}
            </div>
            <div className="text-xs uppercase tracking-wider text-white opacity-70">Elements/Min</div>
          </div>
        </div>

        {gameComplete && (
          <div className="mt-8 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-20 text-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
            <h3 className="text-2xl font-medium text-white mb-2 uppercase tracking-wide">
              Challenge Completed
            </h3>
            <p className="text-white opacity-90 mb-4">
              All 118 chemical elements successfully identified in {formatTime(elapsedTime)}
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-3 border border-white border-opacity-30 text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition text-sm uppercase tracking-wide"
            >
              New Challenge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PeriodicTableChallenge;