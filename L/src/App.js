import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Physics from './pages/Physics';
import PhysicsForce from './pages/PhysicsForce';
import PhysicsFriction from './pages/PhysicsFriction';
import PhysicsMass from './pages/PhysicsMass';
import Geography from './pages/Geography';
import Countries from './pages/Countries';
import History from './pages/History';
import Timeline from './pages/Timeline';
import Chemistry from './pages/Chemistry';
import Periodictable from './pages/Periodictable';
import NeuroScience from './pages/Neuroscience';
import BrainWave from './pages/BrainWave';
import Nuclear from './pages/Nuclear';
import RacingGame from './pages/RacingGame';
import Holograms from './pages/Hologram';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/physics" element={<Physics />} />
        <Route path="/physics/force" element={<PhysicsForce />} />
        <Route path="/physics/friction" element={<PhysicsFriction />} />
        <Route path="/physics/mass" element={<PhysicsMass />} />
        <Route path="/geography" element={<Geography />} />
        <Route path="/geography/countries" element={<Countries />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/timeline" element={<Timeline />} />
        <Route path="/chemistry" element={<Chemistry />} />
        <Route path="/chemistry/periodictable" element={<Periodictable />} />
        <Route path="/chemistry/neuroscience" element={<NeuroScience />} />
        <Route path="/chemistry/brainwave" element={<BrainWave />} />
        <Route path="/physics/nuclear" element={<Nuclear />} />
        <Route path="/physics/racinggame" element={<RacingGame />} />
        <Route path="/physics/hologram" element={<Holograms />} />
        {/* Add more routes as needed */}
      </Routes>
    </div>
  );
}

export default App;
