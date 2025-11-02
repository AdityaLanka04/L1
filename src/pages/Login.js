import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import './Login.css';
import { API_URL } from '../config';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const checkAndRedirect = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/check_profile_quiz?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('Quiz check response:', response.data);

      if (response.data.completed) {
        console.log('Quiz completed - going to dashboard');
        navigate('/dashboard');
      } else {
        console.log('Quiz not completed - going to profile-quiz');
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
      
      const backendResponse = await axios.post('${API_URL}/firebase-auth', {
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
      const response = await axios.post('${API_URL}/token',
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
      
      await checkAndRedirect(username);
    } catch (err) {
      console.error(err);
      alert('Login failed: ' + (err.response?.data?.detail || 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">brainwave</h1>
        </div>
        
        <div className="login-form-container">
          <h2 className="form-title">LOGIN</h2>
          
          <div className="google-signin-container">
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="google-signin-button"
            >
              {googleLoading ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="google-spinner"></div>
                  Signing in...
                </div>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    style={{ marginRight: '8px' }}
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
                  Sign in with Google
                </>
              )}
            </button>
          </div>
          
          <div className="divider">
            <span>OR</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="text"
              placeholder="USERNAME"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="login-input"
              required
              disabled={loading || googleLoading}
            />

            <input
              type="password"
              placeholder="PASSWORD"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              required
              disabled={loading || googleLoading}
            />

            <button
              type="submit"
              className="login-button"
              disabled={loading || googleLoading}
            >
              {loading ? "PROCESSING..." : "LOGIN"}
            </button>
          </form>
          
          <div className="login-switch">
            <span onClick={() => navigate('/register')}>
              CREATE ACCOUNT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;