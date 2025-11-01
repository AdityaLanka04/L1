import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    age: '',
    fieldOfStudy: '',
    learningStyle: '',
    school: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.password.trim() || !formData.firstName.trim() || !formData.lastName.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Create FormData object that matches backend expectations
      const registrationFormData = new FormData();
      registrationFormData.append('first_name', formData.firstName);
      registrationFormData.append('last_name', formData.lastName);
      registrationFormData.append('email', formData.email);
      registrationFormData.append('username', formData.username);
      registrationFormData.append('password', formData.password);
      
      // Add optional fields only if they have values
      if (formData.age) {
        registrationFormData.append('age', formData.age);
      }
      if (formData.fieldOfStudy) {
        registrationFormData.append('field_of_study', formData.fieldOfStudy);
      }
      if (formData.learningStyle) {
        registrationFormData.append('learning_style', formData.learningStyle);
      }
      if (formData.school) {
        registrationFormData.append('school_university', formData.school);
      }

      // Fixed: Correct port (8001) and removed Content-Type header for FormData
      const res = await fetch('${API_URL}/register', {
        method: 'POST',
        body: registrationFormData,  // FormData, not JSON
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await res.json();
      console.log('Registration successful:', data);
      
      // Store user profile for later use
      localStorage.setItem('userProfile', JSON.stringify(formData));
      
      alert('Registration successful! Please log in.');
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="register-page">
      <div className="register-scroll-container">
        <div className="register-container">
          <div className="register-header">
            <h1 className="register-title">brainwave</h1>
          </div>
          
          <div className="register-form-container">
            <h2 className="form-title">REGISTER</h2>
            <form onSubmit={handleRegister} className="register-form">
              <div className="form-row">
                <input
                  type="text"
                  name="firstName"
                  placeholder="FIRST NAME *"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="register-input"
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="LAST NAME *"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="register-input"
                  required
                  disabled={loading}
                />
              </div>
              
              <input
                type="email"
                name="email"
                placeholder="EMAIL ADDRESS"
                value={formData.email}
                onChange={handleChange}
                className="register-input"
                disabled={loading}
              />
              
              <div className="form-row">
                <input
                  type="text"
                  name="username"
                  placeholder="USERNAME *"
                  value={formData.username}
                  onChange={handleChange}
                  className="register-input"
                  required
                  disabled={loading}
                />
                <input
                  type="password"
                  name="password"
                  placeholder="PASSWORD *"
                  value={formData.password}
                  onChange={handleChange}
                  className="register-input"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="form-row">
                <input
                  type="number"
                  name="age"
                  placeholder="AGE"
                  value={formData.age}
                  onChange={handleChange}
                  className="register-input"
                  disabled={loading}
                />
                <select
                  name="fieldOfStudy"
                  value={formData.fieldOfStudy}
                  onChange={handleChange}
                  className="register-input register-select"
                  disabled={loading}
                >
                  <option value="">FIELD OF STUDY</option>
                  <option value="science">SCIENCE</option>
                  <option value="mathematics">MATHEMATICS</option>
                  <option value="engineering">ENGINEERING</option>
                  <option value="medicine">MEDICINE</option>
                  <option value="business">BUSINESS</option>
                  <option value="arts">ARTS & HUMANITIES</option>
                  <option value="social_sciences">SOCIAL SCIENCES</option>
                  <option value="computer_science">COMPUTER SCIENCE</option>
                  <option value="other">OTHER</option>
                </select>
              </div>
              
              <select
                name="learningStyle"
                value={formData.learningStyle}
                onChange={handleChange}
                className="register-input register-select"
                disabled={loading}
              >
                <option value="">LEARNING STYLE</option>
                <option value="visual">VISUAL LEARNER</option>
                <option value="auditory">AUDITORY LEARNER</option>
                <option value="kinesthetic">KINESTHETIC LEARNER</option>
                <option value="reading">READING/WRITING LEARNER</option>
              </select>
              
              <input
                type="text"
                name="school"
                placeholder="SCHOOL/UNIVERSITY"
                value={formData.school}
                onChange={handleChange}
                className="register-input"
                disabled={loading}
              />
              
              <button 
                type="submit" 
                className="register-button"
                disabled={loading}
              >
                {loading ? "PROCESSING..." : "REGISTER"}
              </button>
            </form>
            
            <div className="register-switch">
              <span onClick={() => navigate('/login')}>
                ALREADY HAVE ACCOUNT
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;