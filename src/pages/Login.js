import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import LoadingSpinner from '../components/LoadingSpinner';
import './Login.css';
import { API_URL } from '../config/api';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const safetyAccepted = sessionStorage.getItem('safetyAccepted');
    
    if (!safetyAccepted) {
      navigate('/', { replace: true });
      return;
    }
    
    const justAcceptedSafety = sessionStorage.getItem('justAcceptedSafety');
    
    if (justAcceptedSafety) {
      sessionStorage.removeItem('justAcceptedSafety');
      return;
    }
    
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
      navigate('/search-hub', { replace: true });
      return;
    }
  }, [navigate]);

  const checkAndRedirect = async (username) => {
    try {
      const token = localStorage.getItem('token');
      
      try {
        const profileResponse = await axios.get(`${API_URL}/get_comprehensive_profile?user_id=${username}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (profileResponse.data) {
          const profileData = profileResponse.data;
          const existingProfile = localStorage.getItem('userProfile');
          let mergedProfile = {};
          if (existingProfile) {
            try {
              mergedProfile = JSON.parse(existingProfile);
            } catch (e) {}
          }
          
          mergedProfile = {
            ...mergedProfile,
            firstName: profileData.firstName || mergedProfile.firstName || '',
            lastName: profileData.lastName || mergedProfile.lastName || '',
            email: profileData.email || mergedProfile.email || '',
            fieldOfStudy: profileData.fieldOfStudy || '',
            brainwaveGoal: profileData.brainwaveGoal || '',
            preferredSubjects: profileData.preferredSubjects || [],
            difficultyLevel: profileData.difficultyLevel || 'intermediate',
            learningPace: profileData.learningPace || 'moderate',
            primaryArchetype: profileData.primaryArchetype || '',
            secondaryArchetype: profileData.secondaryArchetype || '',
            archetypeDescription: profileData.archetypeDescription || '',
            showStudyInsights: profileData.showStudyInsights !== false
          };
          
          localStorage.setItem('userProfile', JSON.stringify(mergedProfile));
        }
      } catch (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      
      const response = await axios.get(`${API_URL}/check_profile_quiz?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.completed) {
        sessionStorage.setItem('justLoggedIn', 'true');
        navigate('/search-hub');
      } else {
        navigate('/profile-quiz');
      }
    } catch (error) {
      console.error('Error checking quiz status:', error);
      navigate('/profile-quiz');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const idToken = await user.getIdToken();
      
      const backendResponse = await axios.post(`${API_URL}/firebase-auth`, {
        idToken: idToken,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        uid: user.uid
      });

      const { access_token, user: userData } = backendResponse.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('username', userData.email);
      localStorage.setItem('userProfile', JSON.stringify({
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        picture: userData.picture_url,
        googleUser: true
      }));
      
      sessionStorage.setItem('safetyAccepted', 'true');
      sessionStorage.setItem('justLoggedIn', 'true');

      await checkAndRedirect(userData.email);
    } catch (error) {
      console.error('Firebase Google sign-in error:', error);
      
      if (error.code === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('User cancelled sign-in');
      } else {
        alert('Google sign-in failed: ' + (error.message || 'Unknown error'));
      }
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      alert("Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/token`,
        new URLSearchParams({
          username,
          password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        }
      );

      const token = response.data.access_token;
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      
      sessionStorage.setItem('safetyAccepted', 'true');
      sessionStorage.setItem('justLoggedIn', 'true');
      
      await checkAndRedirect(username);
    } catch (err) {
      console.error(err);
      alert('Login failed: ' + (err.response?.data?.detail || 'Unknown error'));
    }
    setLoading(false);
  };

  const renderCircleDots = (count, radius, speed = 'medium') => {
    const dots = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      dots.push(
        <div
          key={i}
          className={`pattern-dot ${speed}`}
          style={{
            left: `${50 + (x / radius) * 50}%`,
            top: `${50 + (y / radius) * 50}%`,
          }}
        />
      );
    }
    return dots;
  };

  const renderLineDots = (count, speed = 'medium') => {
    const dots = [];
    for (let i = 0; i < count; i++) {
      dots.push(
        <div
          key={i}
          className={`pattern-dot ${speed}`}
          style={{
            left: `${(i / (count - 1)) * 100}%`,
            top: '50%',
          }}
        />
      );
    }
    return dots;
  };

  const renderSquareDots = (count, speed = 'medium') => {
    const dots = [];
    const perSide = Math.floor(count / 4);
    
    for (let i = 0; i < perSide; i++) {
      const progress = i / (perSide - 1);
      dots.push(<div key={`top-${i}`} className={`pattern-dot ${speed}`} style={{ left: `${progress * 100}%`, top: '0%' }} />);
      dots.push(<div key={`right-${i}`} className={`pattern-dot ${speed}`} style={{ left: '100%', top: `${progress * 100}%` }} />);
      dots.push(<div key={`bottom-${i}`} className={`pattern-dot ${speed}`} style={{ left: `${(1 - progress) * 100}%`, top: '100%' }} />);
      dots.push(<div key={`left-${i}`} className={`pattern-dot ${speed}`} style={{ left: '0%', top: `${(1 - progress) * 100}%` }} />);
    }
    
    return dots;
  };

  const renderTriangleDots = (count, speed = 'medium') => {
    const dots = [];
    const perSide = Math.floor(count / 3);
    
    for (let i = 0; i < perSide; i++) {
      const progress = i / (perSide - 1);
      dots.push(<div key={`side1-${i}`} className={`pattern-dot ${speed}`} style={{ left: `${50 + progress * 50}%`, top: `${100 - progress * 100}%` }} />);
      dots.push(<div key={`side2-${i}`} className={`pattern-dot ${speed}`} style={{ left: `${50 - progress * 50}%`, top: `${100 - progress * 100}%` }} />);
      dots.push(<div key={`base-${i}`} className={`pattern-dot ${speed}`} style={{ left: `${progress * 100}%`, top: '100%' }} />);
    }
    
    return dots;
  };

  const renderArcDots = (count, speed = 'medium') => {
    const dots = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / (count - 1)) * Math.PI;
      const x = 50 + 50 * Math.cos(angle);
      const y = 100 - 100 * Math.sin(angle);
      dots.push(
        <div
          key={i}
          className={`pattern-dot ${speed}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
          }}
        />
      );
    }
    return dots;
  };

  return (
    <>
      {(loading || googleLoading) && <LoadingSpinner />}
      <div className="login-page">
        <div className="geometric-dots">
          <div className="dot-pattern circle-1">
            {renderCircleDots(14, 100, 'slow')}
          </div>
          <div className="dot-pattern circle-2">
            {renderCircleDots(12, 90, 'fast')}
          </div>
          <div className="dot-pattern circle-3">
            {renderCircleDots(10, 75, 'medium')}
          </div>
          <div className="dot-pattern circle-4">
            {renderCircleDots(13, 95, 'slow')}
          </div>
          <div className="dot-pattern circle-5">
            {renderCircleDots(9, 65, 'fast')}
          </div>
          <div className="dot-pattern circle-6">
            {renderCircleDots(8, 50, 'medium')}
          </div>
          <div className="dot-pattern line-1">
            {renderLineDots(9, 'slow')}
          </div>
          <div className="dot-pattern line-2">
            {renderLineDots(7, 'fast')}
          </div>
          <div className="dot-pattern line-3">
            {renderLineDots(6, 'medium')}
          </div>
          <div className="dot-pattern square-1">
            {renderSquareDots(12, 'medium')}
          </div>
          <div className="dot-pattern square-2">
            {renderSquareDots(10, 'fast')}
          </div>
          <div className="dot-pattern triangle-1">
            {renderTriangleDots(12, 'slow')}
          </div>
          <div className="dot-pattern arc-1">
            {renderArcDots(11, 'fast')}
          </div>
        </div>

        <div className="login-left">
          <div className="glow-orb-1"></div>
          <div className="glow-orb-2"></div>
          
          <div className="brand-graphic">
            <div className="concentric-ring-1"></div>
            <div className="concentric-ring-2"></div>
            <div className="concentric-ring-3"></div>
            <div className="brand-bar-top"></div>
            <div className="brand-circle"></div>
            <div className="brand-bar-bottom"></div>
            <div className="brand-text-overlay">
              <div className="brand-name">cerbyl</div>
              <div className="brand-tagline">Learning, Unified</div>
            </div>
          </div>

          <div className="brand-description">
            <div className="description-label">Our Philosophy</div>
            <div className="description-text">
              Cerbyl merges AI with learning science. Education adapts to you through 
              personalized pathways and intelligent tutoring.
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-container">
            <div className="login-header">
              <h1 className="login-subtitle">Sign in to continue</h1>
            </div>

            <div className="google-signin-container">
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="google-signin-button"
              >
                {googleLoading ? (
                  <>
                    <div className="google-spinner"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="google-icon"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>

            <div className="divider">
              <span>Or</span>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="login-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="input-label">Username</label>
              </div>

              <div className="input-group">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="login-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="input-label">Password</label>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={loading || googleLoading}
              >
                <span className="button-text">
                  {loading ? "Signing In..." : "Sign In"}
                </span>
              </button>
            </form>

            <div className="login-footer">
              <div className="login-switch">
                Don't have an account?
                <span
                  className="login-switch-link"
                  onClick={() => navigate('/register')}
                >
                  Create one
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;