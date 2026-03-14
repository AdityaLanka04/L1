import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SafetyLogin.css';

const SafetyLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const demoAccounts = [
    { username: 'demo_student1', password: 'BrainWave2024!', name: 'Alex Chen' },
    { username: 'bob', password: 'bob', name: 'Sarah Johnson' },
    { username: 'demo_student3', password: 'Study@456', name: 'Michael Brown' },
  ];

  const leadership = [
    { role: 'Director', name: 'Madhuri Hari' },
    { role: 'Co-Founder', name: 'Parthav Elangovan' },
    { role: 'Co-Founder', name: 'Aditya Lanka' },
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    const validAccount = demoAccounts.find(
      account => account.username === username && account.password === password
    );

    if (validAccount) {
      sessionStorage.setItem('demoUser', JSON.stringify({
        username: validAccount.username,
        name: validAccount.name,
        isDemo: true
      }));

      sessionStorage.setItem('safetyAccepted', 'true');

      sessionStorage.setItem('justAcceptedSafety', 'true');

      navigate('/search-hub');
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="safety-login">
      <div className="safety-login-container">
        <section className="safety-about-panel" aria-label="About Cerbyl">
          <p className="about-eyebrow">About Us</p>
          <h2 className="about-title">All-in contextual learning built around shared academic context.</h2>
          <p className="about-description">
            Cerbyl is a contextual learning system where every workflow stays connected. Notes, search,
            quizzes, flashcards, and review all operate on shared context, so each action carries forward
            the same topics, relationships, and learning history across the product.
          </p>

          <div className="about-team">
            {leadership.map((member) => (
              <div className="team-card" key={`${member.role}-${member.name}`}>
                <span className="team-role">{member.role}</span>
                <span className="team-name">{member.name}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="safety-login-panel">
          <h1 className="safety-title">
            <img src="/logo.svg" alt="" style={{ height: '28px', marginRight: '10px', verticalAlign: 'middle', filter: 'brightness(0) saturate(100%) invert(77%) sepia(48%) saturate(456%) hue-rotate(359deg) brightness(95%) contrast(89%)' }} />
            cerbyl
          </h1>
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
