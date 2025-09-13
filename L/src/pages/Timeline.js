import React, { useState, useEffect, useRef } from 'react';
import { Clock, Trophy, Star, RotateCcw, CheckCircle, XCircle, Calendar, Zap } from 'lucide-react';

const TimelineBuilderGame = () => {
  const [currentLevel, setCurrentLevel] = useState('easy');
  const [currentCategory, setCurrentCategory] = useState('mixed');
  const [gameStarted, setGameStarted] = useState(false);
  const [events, setEvents] = useState([]);
  const [placedEvents, setPlacedEvents] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [draggedItem, setDraggedItem] = useState(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [attempts, setAttempts] = useState(0);
  const dragRef = useRef(null);

  // Historical Events Database
  const historicalEvents = {
    ancient: [
      { id: 1, title: "Great Pyramid of Giza Built", year: -2580, era: "Ancient Egypt", description: "Construction of the last remaining Wonder of the Ancient World", image: "🏺", category: "Architecture" },
      { id: 2, title: "Homer writes the Iliad", year: -750, era: "Ancient Greece", description: "Epic poem about the Trojan War", image: "📜", category: "Literature" },
      { id: 3, title: "Rome Founded", year: -753, era: "Ancient Rome", description: "Legendary founding of Rome by Romulus", image: "🏛️", category: "Political" },
      { id: 4, title: "Buddha's Enlightenment", year: -528, era: "Ancient India", description: "Siddhartha Gautama achieves enlightenment", image: "🕉️", category: "Religion" },
      { id: 5, title: "Democracy in Athens", year: -508, era: "Ancient Greece", description: "Cleisthenes establishes democratic reforms", image: "🗳️", category: "Political" },
      { id: 6, title: "Alexander the Great conquers Persia", year: -334, era: "Ancient Greece", description: "Beginning of Alexander's conquest of the Persian Empire", image: "⚔️", category: "Wars" },
      { id: 7, title: "Great Wall of China begun", year: -220, era: "Ancient China", description: "Qin Dynasty starts connecting defensive walls", image: "🏯", category: "Architecture" },
      { id: 8, title: "Julius Caesar assassinated", year: -44, era: "Ancient Rome", description: "End of the Roman Republic era", image: "🗡️", category: "Political" }
    ],
    medieval: [
      { id: 9, title: "Fall of Western Roman Empire", year: 476, era: "Late Antiquity", description: "End of the Western Roman Empire", image: "🏛️", category: "Political" },
      { id: 10, title: "Islam Founded", year: 622, era: "Medieval Arabia", description: "Muhammad's Hijra marks beginning of Islamic calendar", image: "☪️", category: "Religion" },
      { id: 11, title: "Charlemagne Crowned Emperor", year: 800, era: "Medieval Europe", description: "Revival of the Western Roman Empire", image: "👑", category: "Political" },
      { id: 12, title: "Viking raids on England", year: 793, era: "Medieval Europe", description: "Attack on Lindisfarne monastery", image: "🛡️", category: "Wars" },
      { id: 13, title: "First Crusade begins", year: 1095, era: "Medieval Europe", description: "Pope Urban II calls for holy war", image: "✝️", category: "Wars" },
      { id: 14, title: "Magna Carta signed", year: 1215, era: "Medieval England", description: "Limits on royal power established", image: "📋", category: "Political" },
      { id: 15, title: "Black Death arrives in Europe", year: 1347, era: "Medieval Europe", description: "Plague devastates European population", image: "💀", category: "Disasters" },
      { id: 16, title: "Printing Press invented", year: 1440, era: "Medieval Europe", description: "Gutenberg's invention revolutionizes communication", image: "📚", category: "Inventions" }
    ],
    renaissance: [
      { id: 17, title: "Columbus reaches America", year: 1492, era: "Age of Exploration", description: "European contact with the New World", image: "🌍", category: "Discoveries" },
      { id: 18, title: "Leonardo da Vinci paints Mona Lisa", year: 1503, era: "Renaissance", description: "Creation of the world's most famous painting", image: "🎨", category: "Arts" },
      { id: 19, title: "Protestant Reformation begins", year: 1517, era: "Renaissance", description: "Martin Luther posts his 95 Theses", image: "⛪", category: "Religion" },
      { id: 20, title: "Magellan's voyage begins", year: 1519, era: "Age of Exploration", description: "First attempt to circumnavigate the globe", image: "⛵", category: "Discoveries" },
      { id: 21, title: "Copernicus publishes heliocentric theory", year: 1543, era: "Scientific Revolution", description: "Sun-centered model of the solar system", image: "🌞", category: "Science" },
      { id: 22, title: "Shakespeare writes Hamlet", year: 1600, era: "Renaissance", description: "Peak of English Renaissance literature", image: "🎭", category: "Literature" },
      { id: 23, title: "Galileo improves telescope", year: 1609, era: "Scientific Revolution", description: "Revolutionary astronomical observations", image: "🔭", category: "Science" },
      { id: 24, title: "Mayflower arrives in America", year: 1620, era: "Colonial America", description: "Pilgrims establish Plymouth Colony", image: "🚢", category: "Discoveries" }
    ],
    modern: [
      { id: 25, title: "American Declaration of Independence", year: 1776, era: "Age of Revolution", description: "Birth of the United States", image: "🗽", category: "Political" },
      { id: 26, title: "French Revolution begins", year: 1789, era: "Age of Revolution", description: "Storming of the Bastille", image: "🇫🇷", category: "Political" },
      { id: 27, title: "Napoleon becomes Emperor", year: 1804, era: "Napoleonic Era", description: "Rise of the French Empire", image: "👑", category: "Political" },
      { id: 28, title: "Steam locomotive invented", year: 1814, era: "Industrial Revolution", description: "George Stephenson's revolutionary transport", image: "🚂", category: "Inventions" },
      { id: 29, title: "Photography invented", year: 1839, era: "Industrial Revolution", description: "Louis Daguerre perfects daguerreotype process", image: "📷", category: "Inventions" },
      { id: 30, title: "American Civil War begins", year: 1861, era: "19th Century America", description: "Conflict over slavery and states' rights", image: "⚔️", category: "Wars" },
      { id: 31, title: "Telephone invented", year: 1876, era: "Industrial Revolution", description: "Alexander Graham Bell's communication breakthrough", image: "📞", category: "Inventions" },
      { id: 32, title: "World War I begins", year: 1914, era: "20th Century", description: "The Great War starts in Europe", image: "💥", category: "Wars" }
    ]
  };

  const difficultySettings = {
    easy: { eventCount: 5, timeLimit: 300, points: 10 },
    medium: { eventCount: 8, timeLimit: 240, points: 15 },
    hard: { eventCount: 12, timeLimit: 180, points: 25 },
    expert: { eventCount: 20, timeLimit: 120, points: 50 }
  };

  const categories = {
    mixed: "Mixed Events",
    wars: "Wars & Conflicts",
    inventions: "Inventions & Science",
    political: "Political Events",
    discoveries: "Discoveries & Exploration",
    arts: "Arts & Culture"
  };

  // Initialize game
  const startGame = () => {
    const difficulty = difficultySettings[currentLevel];
    let availableEvents = [];

    // Collect events based on category
    Object.values(historicalEvents).forEach(eraEvents => {
      if (currentCategory === 'mixed') {
        availableEvents.push(...eraEvents);
      } else {
        availableEvents.push(...eraEvents.filter(event => 
          event.category.toLowerCase().includes(currentCategory) ||
          (currentCategory === 'wars' && event.category === 'Wars') ||
          (currentCategory === 'inventions' && (event.category === 'Inventions' || event.category === 'Science')) ||
          (currentCategory === 'political' && event.category === 'Political') ||
          (currentCategory === 'discoveries' && event.category === 'Discoveries') ||
          (currentCategory === 'arts' && (event.category === 'Arts' || event.category === 'Literature'))
        ));
      }
    });

    // Randomly select events for the game
    const shuffledEvents = availableEvents.sort(() => Math.random() - 0.5);
    const selectedEvents = shuffledEvents.slice(0, difficulty.eventCount);
    
    setEvents(selectedEvents.sort(() => Math.random() - 0.5)); // Shuffle for display
    setPlacedEvents([]);
    setScore(0);
    setTimeLeft(difficulty.timeLimit);
    setGameStarted(true);
    setGameComplete(false);
    setFeedback('');
    setAttempts(0);
  };

  // Timer effect
  useEffect(() => {
    if (gameStarted && timeLeft > 0 && !gameComplete) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameStarted) {
      endGame();
    }
  }, [gameStarted, timeLeft, gameComplete]);

  // Drag and drop handlers
  const handleDragStart = (e, event) => {
    setDraggedItem(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newPlacedEvents = [...placedEvents];
    
    // Remove item if it was already placed
    const existingIndex = newPlacedEvents.findIndex(item => item && item.id === draggedItem.id);
    if (existingIndex !== -1) {
      newPlacedEvents[existingIndex] = null;
    }

    // Place item at new position
    newPlacedEvents[index] = draggedItem;
    setPlacedEvents(newPlacedEvents);
    setDraggedItem(null);

    // Remove from events list
    setEvents(prev => prev.filter(event => event.id !== draggedItem.id));
  };

  const handleEventReturn = (eventToReturn) => {
    // Remove from timeline
    const newPlacedEvents = placedEvents.map(event => 
      event && event.id === eventToReturn.id ? null : event
    );
    setPlacedEvents(newPlacedEvents);
    
    // Add back to events list
    setEvents(prev => [...prev, eventToReturn]);
  };

  const checkAnswer = () => {
    setAttempts(prev => prev + 1);
    const filledEvents = placedEvents.filter(event => event !== null);
    
    if (filledEvents.length !== difficultySettings[currentLevel].eventCount) {
      setFeedback('❌ Please place all events on the timeline first!');
      return;
    }

    // Check if timeline is correct
    let correctPlacements = 0;
    const sortedCorrectOrder = filledEvents.slice().sort((a, b) => a.year - b.year);
    
    for (let i = 0; i < filledEvents.length; i++) {
      if (filledEvents[i] && filledEvents[i].id === sortedCorrectOrder[i].id) {
        correctPlacements++;
      }
    }

    const accuracy = (correctPlacements / filledEvents.length) * 100;
    const basePoints = difficultySettings[currentLevel].points;
    const timeBonus = Math.floor(timeLeft / 10);
    const accuracyBonus = Math.floor(accuracy * 2);
    const earnedScore = Math.floor((basePoints + timeBonus + accuracyBonus) * (accuracy / 100));

    setScore(prev => prev + earnedScore);

    if (accuracy === 100) {
      setFeedback(`🎉 Perfect! All events in correct order! +${earnedScore} points`);
      setGameComplete(true);
    } else {
      setFeedback(`📊 ${accuracy.toFixed(0)}% correct (${correctPlacements}/${filledEvents.length}). +${earnedScore} points. Try again!`);
    }
  };

  const endGame = () => {
    setGameStarted(false);
    setGameComplete(true);
    if (timeLeft === 0) {
      setFeedback('⏰ Time\'s up! Check how you did.');
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameComplete(false);
    setEvents([]);
    setPlacedEvents([]);
    setScore(0);
    setFeedback('');
    setAttempts(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimelineSlots = () => {
    return Array(difficultySettings[currentLevel].eventCount).fill(null);
  };

  if (!gameStarted && !gameComplete) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-600 mb-4">📅 Timeline Builder Challenge</h1>
          <p className="text-lg text-gray-600 mb-6">
            Arrange historical events in chronological order. Test your knowledge of when things happened!
          </p>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Choose Difficulty Level</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(difficultySettings).map(([level, settings]) => (
              <button
                key={level}
                onClick={() => setCurrentLevel(level)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  currentLevel === level
                    ? 'border-purple-500 bg-purple-100 text-purple-800'
                    : 'border-gray-300 bg-white hover:border-purple-300'
                }`}
              >
                <div className="font-bold capitalize">{level}</div>
                <div className="text-sm text-gray-600">{settings.eventCount} events</div>
                <div className="text-sm text-gray-600">{formatTime(settings.timeLimit)}</div>
                <div className="text-sm font-semibold text-green-600">{settings.points} pts</div>
              </button>
            ))}
          </div>
        </div>

        {/* Category Selection */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-3">Choose Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(categories).map(([key, name]) => (
              <button
                key={key}
                onClick={() => setCurrentCategory(key)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  currentCategory === key
                    ? 'border-blue-500 bg-blue-100 text-blue-800'
                    : 'border-gray-300 bg-white hover:border-blue-300'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-3">🎯 How to Play</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• <strong>Drag events</strong> from the bottom onto the timeline</li>
            <li>• <strong>Arrange them</strong> from earliest to latest (left to right)</li>
            <li>• <strong>Click "Check Timeline"</strong> when you're done</li>
            <li>• <strong>Score points</strong> for accuracy and speed</li>
            <li>• <strong>Time bonus</strong> for quick completion</li>
          </ul>
        </div>

        <div className="text-center">
          <button
            onClick={startGame}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105"
          >
            🚀 Start Timeline Challenge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white rounded-lg shadow-lg">
      {/* Game Header */}
      <div className="flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
        <div className="flex items-center space-x-4">
          <Calendar className="w-8 h-8 text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-purple-600">Timeline Builder</h2>
            <p className="text-sm text-gray-600">{categories[currentCategory]} - {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto" />
            <div className="font-bold text-lg">{score}</div>
            <div className="text-xs text-gray-600">Score</div>
          </div>
          <div className="text-center">
            <Clock className={`w-6 h-6 mx-auto ${timeLeft <= 30 ? 'text-red-500' : 'text-green-500'}`} />
            <div className={`font-bold text-lg ${timeLeft <= 30 ? 'text-red-500' : 'text-green-500'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="text-xs text-gray-600">Time</div>
          </div>
          <div className="text-center">
            <Zap className="w-6 h-6 text-blue-500 mx-auto" />
            <div className="font-bold text-lg">{attempts}</div>
            <div className="text-xs text-gray-600">Attempts</div>
          </div>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-4 text-center">📍 Drop Events Here (Earliest → Latest)</h3>
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border-2 border-dashed border-yellow-300">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {getTimelineSlots().map((_, index) => (
              <div
                key={index}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className="min-w-48 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-all"
              >
                {placedEvents[index] ? (
                  <div 
                    className="w-full h-full p-2 bg-gradient-to-br from-blue-400 to-purple-500 text-white rounded-lg cursor-pointer hover:from-blue-500 hover:to-purple-600 transition-all"
                    onClick={() => handleEventReturn(placedEvents[index])}
                  >
                    <div className="text-2xl text-center mb-1">{placedEvents[index].image}</div>
                    <div className="text-xs font-bold text-center leading-tight">{placedEvents[index].title}</div>
                    <div className="text-xs text-center opacity-90">{placedEvents[index].era}</div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-center">
                    <div className="text-2xl mb-1">📍</div>
                    <div className="text-xs">Drop Here</div>
                    <div className="text-xs">Position {index + 1}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Available Events */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-4">🎯 Available Events (Drag to Timeline)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-64 overflow-y-auto p-4 bg-gray-50 rounded-lg">
          {events.map((event) => (
            <div
              key={event.id}
              draggable
              onDragStart={(e) => handleDragStart(e, event)}
              className="p-3 bg-white border-2 border-gray-200 rounded-lg cursor-move hover:border-blue-400 hover:shadow-md transition-all transform hover:scale-105"
            >
              <div className="text-3xl text-center mb-2">{event.image}</div>
              <div className="text-sm font-bold text-center leading-tight mb-1">{event.title}</div>
              <div className="text-xs text-gray-600 text-center mb-1">{event.era}</div>
              <div className="text-xs text-blue-600 text-center font-semibold">{event.category}</div>
              <div className="text-xs text-gray-500 text-center italic mt-1">{event.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center space-x-4 mb-4">
        <button
          onClick={checkAnswer}
          disabled={gameComplete}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold flex items-center space-x-2 transition-all"
        >
          <CheckCircle className="w-5 h-5" />
          <span>Check Timeline</span>
        </button>
        <button
          onClick={resetGame}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold flex items-center space-x-2 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="text-center p-4 bg-blue-100 rounded-lg mb-4">
          <p className="text-lg font-semibold">{feedback}</p>
        </div>
      )}

      {/* Game Complete */}
      {gameComplete && (
        <div className="text-center p-6 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg">
          <h3 className="text-2xl font-bold mb-4">🏆 Challenge Complete!</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{score}</div>
              <div className="text-sm text-gray-600">Final Score</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{attempts}</div>
              <div className="text-sm text-gray-600">Attempts</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{difficultySettings[currentLevel].timeLimit - timeLeft}s</div>
              <div className="text-sm text-gray-600">Time Used</div>
            </div>
          </div>
          <div className="space-x-4">
            <button
              onClick={resetGame}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineBuilderGame;