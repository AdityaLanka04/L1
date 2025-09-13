import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const navigate = useNavigate();

  const handleAsk = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/ask/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`, // ✅ Send token here
        },
        body: JSON.stringify({ query: question }),
      });

      if (res.status === 401) {
        // Token invalid or expired, redirect to login
        navigate('/login');
        return;
      }

      const data = await res.json();
      setAnswer(data.answer);
    } catch (err) {
      console.error("Error fetching answer:", err);
      setAnswer("An error occurred while fetching the answer.");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Ask the AI</h1>
      <textarea
        rows="4"
        cols="50"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Type your question here..."
      />
      <br />
      <button onClick={handleAsk}>Ask</button>
      <div style={{ marginTop: '20px' }}>
        <strong>Answer:</strong>
        <p>{answer}</p>
      </div>
    </div>
  );
};

export default Home;
