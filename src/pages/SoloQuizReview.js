import { useNavigate } from 'react-router-dom';
import '../components/SocialHubChrome.css';

const SoloQuizReview = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100dvh', padding: 'clamp(20px, 6vw, 40px)' }}>
      <div className="shc-topbar">
        <div className="shc-tagline"><span>LEARNING,</span> UNIFIED</div>
        <div className="shc-topbar-right">
          <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>Dashboard</button>
        </div>
      </div>
      <h1>Solo Quiz Review</h1>
      <p>Your review will appear here.</p>
    </div>
  );
};

export default SoloQuizReview;
