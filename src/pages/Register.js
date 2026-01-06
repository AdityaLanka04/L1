import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import './Register.css';
import { API_URL } from '../config/api';

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const safetyAccepted = sessionStorage.getItem('safetyAccepted');
    if (!safetyAccepted) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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
      navigate('/profile-quiz');
    } catch (error) {
            if (error.code === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
              } else {
        alert('Google sign-in failed: ' + (error.message || 'Unknown error'));
      }
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.password || !formData.confirmPassword) {
      alert("Please fill in all fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const registrationData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        username: formData.email,
        password: formData.password
      };

      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      localStorage.setItem("userProfile", JSON.stringify({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
      }));

      alert("Registration successful! Please log in.");
      navigate("/login");
    } catch (err) {
            alert("Registration failed: " + err.message);
    } finally {
      setLoading(false);
    }
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
          className={`rg-pattern-dot ${speed}`}
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
          className={`rg-pattern-dot ${speed}`}
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
      dots.push(<div key={`top-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: `${progress * 100}%`, top: '0%' }} />);
      dots.push(<div key={`right-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: '100%', top: `${progress * 100}%` }} />);
      dots.push(<div key={`bottom-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: `${(1 - progress) * 100}%`, top: '100%' }} />);
      dots.push(<div key={`left-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: '0%', top: `${(1 - progress) * 100}%` }} />);
    }
    
    return dots;
  };

  const renderTriangleDots = (count, speed = 'medium') => {
    const dots = [];
    const perSide = Math.floor(count / 3);
    
    for (let i = 0; i < perSide; i++) {
      const progress = i / (perSide - 1);
      dots.push(<div key={`side1-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: `${50 + progress * 50}%`, top: `${100 - progress * 100}%` }} />);
      dots.push(<div key={`side2-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: `${50 - progress * 50}%`, top: `${100 - progress * 100}%` }} />);
      dots.push(<div key={`base-${i}`} className={`rg-pattern-dot ${speed}`} style={{ left: `${progress * 100}%`, top: '100%' }} />);
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
          className={`rg-pattern-dot ${speed}`}
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
      <div className="rg-page">
        <div className="rg-geometric-dots">
          <div className="rg-dot-pattern rg-circle-1">
            {renderCircleDots(14, 100, 'slow')}
          </div>
          <div className="rg-dot-pattern rg-circle-2">
            {renderCircleDots(12, 90, 'fast')}
          </div>
          <div className="rg-dot-pattern rg-circle-3">
            {renderCircleDots(10, 75, 'medium')}
          </div>
          <div className="rg-dot-pattern rg-circle-4">
            {renderCircleDots(13, 95, 'slow')}
          </div>
          <div className="rg-dot-pattern rg-circle-5">
            {renderCircleDots(9, 65, 'fast')}
          </div>
          <div className="rg-dot-pattern rg-circle-6">
            {renderCircleDots(8, 50, 'medium')}
          </div>
          <div className="rg-dot-pattern rg-line-1">
            {renderLineDots(9, 'slow')}
          </div>
          <div className="rg-dot-pattern rg-line-2">
            {renderLineDots(7, 'fast')}
          </div>
          <div className="rg-dot-pattern rg-line-3">
            {renderLineDots(6, 'medium')}
          </div>
          <div className="rg-dot-pattern rg-square-1">
            {renderSquareDots(12, 'medium')}
          </div>
          <div className="rg-dot-pattern rg-square-2">
            {renderSquareDots(10, 'fast')}
          </div>
          <div className="rg-dot-pattern rg-triangle-1">
            {renderTriangleDots(12, 'slow')}
          </div>
          <div className="rg-dot-pattern rg-arc-1">
            {renderArcDots(11, 'fast')}
          </div>
        </div>

        <div className="rg-left">
          <div className="rg-glow-orb-1"></div>
          <div className="rg-glow-orb-2"></div>
          
          <div className="rg-brand-graphic">
            <div className="rg-concentric-ring-1"></div>
            <div className="rg-concentric-ring-2"></div>
            <div className="rg-concentric-ring-3"></div>
            <div className="rg-brand-bar-top"></div>
            <div className="rg-brand-circle"></div>
            <div className="rg-brand-bar-bottom"></div>
            <div className="rg-brand-text-overlay">
              <div className="rg-brand-name">cerbyl</div>
              <div className="rg-brand-tagline">Learning, Unified</div>
            </div>
          </div>

          <div className="rg-brand-description">
            <div className="rg-description-label">Our Philosophy</div>
            <div className="rg-description-text">
              Cerbyl merges AI with learning science. Education adapts to you through 
              personalized pathways and intelligent tutoring.
            </div>
          </div>
        </div>

        <div className="rg-right">
          <div className="rg-container">
            <div className="rg-header">
              <h1 className="rg-subtitle">JOIN CERBYL</h1>
            </div>

            <div className="rg-google-signin-container">
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="rg-google-signin-button"
              >
                {googleLoading ? (
                  <>
                    <div className="rg-google-spinner"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="rg-google-icon"
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

            <div className="rg-divider">
              <span>Or</span>
            </div>

            <form onSubmit={handleSubmit} className="rg-form">
              <div className="rg-input-group">
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="rg-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="rg-input-label">First Name</label>
              </div>

              <div className="rg-input-group">
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="rg-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="rg-input-label">Last Name</label>
              </div>

              <div className="rg-input-group">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="rg-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="rg-input-label">Email</label>
              </div>

              <div className="rg-input-group">
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="rg-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="rg-input-label">Password</label>
              </div>

              <div className="rg-input-group">
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="rg-input"
                  placeholder=" "
                  required
                  disabled={loading || googleLoading}
                />
                <label className="rg-input-label">Confirm Password</label>
              </div>

              <button
                type="submit"
                className="rg-button"
                disabled={loading || googleLoading}
              >
                <span className="rg-button-text">
                  {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
                </span>
              </button>
            </form>

            <div className="rg-footer">
              <div className="rg-switch">
                Already have an account?
                <span
                  className="rg-switch-link"
                  onClick={() => navigate('/login')}
                >
                  SIGN IN
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Register;

