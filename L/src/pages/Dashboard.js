import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
      <p className="mb-6 text-lg">
        Welcome to your dashboard. Select a simulation to get started:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link 
          to="/physics" 
          className="p-4 bg-purple-100 rounded-lg shadow hover:bg-purple-200 transition"
        >
          Physics Simulations
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
