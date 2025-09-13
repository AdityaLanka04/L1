// CustomPopup.js - Add this component to your project
import React, { useState, useEffect } from 'react';

const CustomPopup = ({ isOpen, onClose, message, title = "Notification" }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Quicksand, sans-serif'
      }}
      onClick={handleClose}
    >
      <div 
        style={{
          background: 'rgba(0, 0, 0, 0.95)',
          border: '2px solid rgba(76, 175, 80, 0.4)',
          padding: '40px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: 'rgba(215, 179, 140, 0.6)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '5px'
          }}
        >
          
        </button>

        {/* Success icon */}
        <div style={{
          fontSize: '48px',
          color: 'rgba(76, 175, 80, 0.9)',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}>
          
        </div>

        {/* Title */}
        <h3 style={{
          color: '#D7B38C',
          fontSize: '24px',
          fontWeight: '600',
          margin: '0 0 15px 0',
          letterSpacing: '0.5px'
        }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{
          color: 'rgba(215, 179, 140, 0.9)',
          fontSize: '16px',
          lineHeight: '1.6',
          margin: '0 0 25px 0',
          letterSpacing: '0.3px'
        }}>
          {message}
        </p>

        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(215, 179, 140, 0.1)',
            border: '1px solid rgba(215, 179, 140, 0.3)',
            color: '#D7B38C',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontFamily: 'Quicksand, sans-serif',
            letterSpacing: '0.5px'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default CustomPopup;