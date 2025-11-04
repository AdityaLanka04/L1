import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css';
import { API_URL } from '../config/api';

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

  if (!formData.username || !formData.password || 
      !formData.firstName || !formData.lastName || !formData.email) {
    alert("Please fill in all required fields");
    return;
  }

  setLoading(true);
  try {
    // build JSON payload matching backend's RegisterPayload model
    const registrationData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      username: formData.username,
      password: formData.password,
      ...(formData.age && { age: parseInt(formData.age) }),
      ...(formData.fieldOfStudy && { field_of_study: formData.fieldOfStudy }),
      ...(formData.learningStyle && { learning_style: formData.learningStyle }),
      ...(formData.school && { school_university: formData.school })
    };

    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registrationData),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }

    console.log("Registration successful:", data);
    localStorage.setItem("userProfile", JSON.stringify({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      username: formData.username,
    }));

    alert("Registration successful! Please log in.");
    navigate("/login");
  } catch (err) {
    console.error("Registration error:", err);
    alert("Registration failed: " + err.message);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="register-page">
      <div className="register-scroll-container">
        <div className="register-container">
          <div className="register-header">
            <h1 className="register-title">cerbyl</h1>
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
                placeholder="EMAIL ADDRESS *"
                value={formData.email}
                onChange={handleChange}
                className="register-input"
                required
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