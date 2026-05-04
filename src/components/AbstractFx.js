import React from 'react';
import './AbstractFx.css';

const CirclesBg = () => (
  <div className="afx afx--circles" aria-hidden>
    <svg className="afx-circles-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
      <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
      <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
      <circle cx="600" cy="400" r="90"  fill="none" stroke="currentColor" strokeWidth="0.6"/>
      <line x1="600" y1="0"   x2="600"  y2="800" stroke="currentColor" strokeWidth="0.5"/>
      <line x1="0"   y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
      <line x1="0"   y1="800" x2="500"  y2="0"   stroke="currentColor" strokeWidth="0.4"/>
      <line x1="1200" y1="0"  x2="700"  y2="800" stroke="currentColor" strokeWidth="0.4"/>
      <circle cx="600" cy="40"  r="5"   fill="currentColor"/>
      <circle cx="600" cy="760" r="5"   fill="currentColor"/>
      <circle cx="240" cy="400" r="5"   fill="currentColor"/>
      <circle cx="960" cy="400" r="5"   fill="currentColor"/>
      <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
      <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
      <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
      <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
      <rect x="24"   y="24"  width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
      <rect x="44"   y="44"  width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
      <circle cx="60"   cy="60"  r="3" fill="currentColor"/>
      <rect x="1104" y="704" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
      <rect x="1124" y="724" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
      <circle cx="1140" cy="740" r="3" fill="currentColor"/>
      <circle cx="120"  cy="200" r="2"   fill="currentColor"/>
      <circle cx="160"  cy="160" r="1.5" fill="currentColor"/>
      <circle cx="200"  cy="200" r="2"   fill="currentColor"/>
      <circle cx="160"  cy="240" r="1.5" fill="currentColor"/>
      <circle cx="1080" cy="600" r="2"   fill="currentColor"/>
      <circle cx="1040" cy="640" r="1.5" fill="currentColor"/>
      <circle cx="1000" cy="600" r="2"   fill="currentColor"/>
      <circle cx="1040" cy="560" r="1.5" fill="currentColor"/>
    </svg>
  </div>
);

const AbstractFx = ({ variant = 'default' }) => {
  if (variant === 'circles') return <CirclesBg />;
  return (
    <div className={`afx afx--${variant}`} aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="afx-svg">
        <defs>
          <linearGradient id="afx-l1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0"/>
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="afx-l2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id="afx-r1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="afx-r2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </radialGradient>
          <pattern id="afx-dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="var(--accent)" fillOpacity="0.18"/>
          </pattern>
          <mask id="afx-dot-mask">
            <radialGradient id="afx-dot-mask-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1"/>
              <stop offset="65%" stopColor="#fff" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
            </radialGradient>
            <rect width="100%" height="100%" fill="url(#afx-dot-mask-grad)"/>
          </mask>
        </defs>

        {/* Soft accent halos */}
        <circle cx="220" cy="180" r="280" fill="url(#afx-r1)"/>
        <circle cx="1380" cy="720" r="320" fill="url(#afx-r1)"/>
        <circle cx="900" cy="450" r="260" fill="url(#afx-r2)"/>

        {/* Dot field with radial fade */}
        <rect width="1600" height="900" fill="url(#afx-dots)" mask="url(#afx-dot-mask)"/>

        {/* Thin sweeping S curves */}
        <g fill="none" strokeLinecap="round">
          <path
            d="M -80 220 C 320 80, 720 480, 1100 280 S 1700 360, 1800 220"
            stroke="url(#afx-l1)" strokeWidth="1"/>
          <path
            d="M -80 540 C 280 700, 700 320, 1080 600 S 1660 480, 1800 640"
            stroke="url(#afx-l1)" strokeWidth="1"/>
          <path
            d="M -80 780 C 360 660, 760 900, 1180 720 S 1640 820, 1800 780"
            stroke="url(#afx-l1)" strokeWidth="0.9" strokeOpacity="0.55"/>
          <path
            d="M -80 380 C 260 280, 660 580, 1080 420 S 1600 320, 1800 380"
            stroke="url(#afx-l1)" strokeWidth="0.8" strokeOpacity="0.5"/>
        </g>

        {/* Diagonal accent slashes */}
        <g fill="none" stroke="url(#afx-l2)" strokeLinecap="round">
          <path d="M 1200 -40 L 1600 380" strokeWidth="1.1" strokeOpacity="0.55"/>
          <path d="M 1280 -40 L 1680 380" strokeWidth="0.9" strokeOpacity="0.4"/>
          <path d="M 100 940 L 520 540" strokeWidth="1" strokeOpacity="0.5"/>
        </g>

        {/* Floating tiny circles */}
        <g fill="var(--accent)">
          <circle cx="320" cy="140" r="2.2" fillOpacity="0.65"/>
          <circle cx="780" cy="220" r="1.6" fillOpacity="0.5"/>
          <circle cx="1240" cy="160" r="2" fillOpacity="0.55"/>
          <circle cx="180" cy="640" r="1.8" fillOpacity="0.5"/>
          <circle cx="1380" cy="540" r="2.2" fillOpacity="0.6"/>
          <circle cx="940" cy="760" r="1.6" fillOpacity="0.45"/>
          <circle cx="600" cy="500" r="1.4" fillOpacity="0.4"/>
        </g>
      </svg>
    </div>
  );
};

export default AbstractFx;
