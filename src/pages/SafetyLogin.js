import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SafetyLogin.css';

const SafetyLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 20 Default Demo Accounts
  const demoAccounts = [
    { username: 'demo_student1', password: 'BrainWave2024!', name: 'Alex Chen' },
    { username: 'bob', password: 'bob', name: 'Sarah Johnson' },
    { username: 'demo_student3', password: 'Study@456', name: 'Michael Brown' },
    
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    // Check if credentials match any demo account
    const validAccount = demoAccounts.find(
      account => account.username === username && account.password === password
    );

    if (validAccount) {
      // Store demo session
      sessionStorage.setItem('demoUser', JSON.stringify({
        username: validAccount.username,
        name: validAccount.name,
        isDemo: true
      }));
      
      // Set safety acceptance flag in sessionStorage (clears when browser closes)
      sessionStorage.setItem('safetyAccepted', 'true');
      console.log('Safety accepted, navigating to /login');
      
      // Navigate to LOGIN page
      navigate('/login');
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="safety-login">
      <div className="safety-login-container">
        <div className="login-box">
          <h1 className="safety-title">cerbyl</h1>
          <p className="safety-subtitle">SAFETY VERIFICATION</p>
        
          
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="login-button">
              Enter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SafetyLogin;