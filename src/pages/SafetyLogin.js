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
    { username: 'demo_student2', password: 'Learning#123', name: 'Sarah Johnson' },
    { username: 'demo_student3', password: 'Study@456', name: 'Michael Brown' },
    { username: 'demo_student4', password: 'Education$789', name: 'Emily Davis' },
    { username: 'demo_student5', password: 'Knowledge%012', name: 'James Wilson' },
    { username: 'demo_student6', password: 'Scholar&345', name: 'Maria Garcia' },
    { username: 'demo_student7', password: 'Tutor*678', name: 'David Martinez' },
    { username: 'demo_student8', password: 'Learn^901', name: 'Lisa Anderson' },
    { username: 'demo_student9', password: 'Genius#234', name: 'Robert Taylor' },
    { username: 'demo_student10', password: 'Wisdom@567', name: 'Jennifer Thomas' },
    { username: 'demo_student11', password: 'Smart$890', name: 'William Moore' },
    { username: 'demo_student12', password: 'Brain%123', name: 'Jessica Jackson' },
    { username: 'demo_student13', password: 'Wave&456', name: 'Christopher White' },
    { username: 'demo_student14', password: 'AI*789', name: 'Amanda Harris' },
    { username: 'demo_student15', password: 'Neural^012', name: 'Matthew Martin' },
    { username: 'demo_student16', password: 'Think#345', name: 'Ashley Thompson' },
    { username: 'demo_student17', password: 'Quest@678', name: 'Daniel Garcia' },
    { username: 'demo_student18', password: 'Mind$901', name: 'Stephanie Robinson' },
    { username: 'demo_student19', password: 'Logic%234', name: 'Andrew Clark' },
    { username: 'demo_student20', password: 'Reason&567', name: 'Nicole Rodriguez' }
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
      
      // Navigate to homepage
      navigate('/homepage');
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="safety-login">
      <div className="safety-login-container">
        <div className="login-box">
          <h1 className="safety-title">brainwave</h1>
          <p className="safety-subtitle">SAFETY PAGE</p>
          
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