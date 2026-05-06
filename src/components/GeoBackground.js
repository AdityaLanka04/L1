import React from 'react';
import './GeoBackground.css';

const GeoBackground = () => (
  <div className="gbg-root" aria-hidden="true">
    <div className="gbg-orb gbg-orb-1" />
    <div className="gbg-orb gbg-orb-2" />
    <div className="gbg-orb gbg-orb-3" />
    <div className="gbg-dots" />
    <svg className="gbg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      {/* large rings left */}
      <circle cx="-60" cy="450" r="400" fill="none" strokeWidth="0.55" opacity="0.17" />
      <circle cx="-60" cy="450" r="560" fill="none" strokeWidth="0.28" opacity="0.09" />
      {/* large rings right */}
      <circle cx="1500" cy="440" r="360" fill="none" strokeWidth="0.5" opacity="0.15" />
      <circle cx="1500" cy="440" r="510" fill="none" strokeWidth="0.25" opacity="0.08" />
      {/* top center ring */}
      <circle cx="720" cy="-20" r="130" fill="none" strokeWidth="0.45" opacity="0.2" />
      {/* bottom right circle */}
      <circle cx="1060" cy="830" r="100" fill="none" strokeWidth="0.4" opacity="0.18" />
      {/* diamond */}
      <rect x="980" y="150" width="100" height="100" fill="none" strokeWidth="0.48" opacity="0.2" transform="rotate(45 1030 200)" />
      <rect x="970" y="140" width="120" height="120" fill="none" strokeWidth="0.24" opacity="0.11" transform="rotate(45 1030 200)" />
      {/* dashed grid H */}
      <line x1="0" y1="225" x2="1440" y2="225" strokeWidth="0.28" opacity="0.1" strokeDasharray="4 12" />
      <line x1="0" y1="450" x2="1440" y2="450" strokeWidth="0.28" opacity="0.1" strokeDasharray="4 12" />
      <line x1="0" y1="675" x2="1440" y2="675" strokeWidth="0.28" opacity="0.1" strokeDasharray="4 12" />
      {/* dashed grid V */}
      <line x1="360" y1="0" x2="360" y2="900" strokeWidth="0.28" opacity="0.1" strokeDasharray="4 12" />
      <line x1="720" y1="0" x2="720" y2="900" strokeWidth="0.28" opacity="0.1" strokeDasharray="4 12" />
      <line x1="1080" y1="0" x2="1080" y2="900" strokeWidth="0.28" opacity="0.1" strokeDasharray="4 12" />
      {/* diagonals */}
      <line x1="180" y1="0" x2="540" y2="450" strokeWidth="0.35" opacity="0.1" />
      <line x1="1260" y1="900" x2="900" y2="450" strokeWidth="0.35" opacity="0.09" />
      {/* cross markers at intersections */}
      {[[360,225],[720,225],[1080,225],[360,450],[720,450],[1080,450],[360,675],[720,675],[1080,675]].map(([x,y],i) => (
        <g key={i} opacity="0.26">
          <line x1={x-5} y1={y} x2={x+5} y2={y} strokeWidth="0.55" />
          <line x1={x} y1={y-5} x2={x} y2={y+5} strokeWidth="0.55" />
        </g>
      ))}
      {/* node dots */}
      {[[360,225],[720,450],[1080,225],[360,675],[1080,675],[720,225]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1.8" opacity="0.28" />
      ))}
      {/* node connections */}
      <line x1="360" y1="225" x2="720" y2="450" strokeWidth="0.35" opacity="0.1" strokeDasharray="2 9" />
      <line x1="720" y1="450" x2="1080" y2="225" strokeWidth="0.35" opacity="0.1" strokeDasharray="2 9" />
      <line x1="360" y1="675" x2="720" y2="450" strokeWidth="0.35" opacity="0.09" strokeDasharray="2 9" />
      <line x1="720" y1="450" x2="1080" y2="675" strokeWidth="0.35" opacity="0.09" strokeDasharray="2 9" />
      {/* corner brackets */}
      <g opacity="0.18">
        <polyline points="36,44 36,22 58,22" fill="none" strokeWidth="0.75" />
        <polyline points="1404,44 1404,22 1382,22" fill="none" strokeWidth="0.75" />
        <polyline points="36,856 36,878 58,878" fill="none" strokeWidth="0.75" />
        <polyline points="1404,856 1404,878 1382,878" fill="none" strokeWidth="0.75" />
      </g>
      {/* axis tick labels */}
      <g opacity="0.2" fontSize="9" fontFamily="'Inter', monospace" letterSpacing="0.04em">
        <text x="354" y="893" fill="currentColor">0.25</text>
        <text x="714" y="893" fill="currentColor">0.50</text>
        <text x="1074" y="893" fill="currentColor">0.75</text>
        <text x="1396" y="228" fill="currentColor">0.25</text>
        <text x="1396" y="453" fill="currentColor">0.50</text>
        <text x="1396" y="678" fill="currentColor">0.75</text>
      </g>
      {/* floating coordinate labels */}
      <g opacity="0.16" fontSize="10" fontFamily="'Inter', monospace" letterSpacing="0.04em">
        <text x="72" y="130" fill="currentColor">0.482</text>
        <text x="540" y="308" fill="currentColor">−1.337</text>
        <text x="880" y="105" fill="currentColor">2.094</text>
        <text x="1195" y="300" fill="currentColor">0.707</text>
        <text x="155" y="655" fill="currentColor">3.1416</text>
        <text x="1045" y="572" fill="currentColor">−0.892</text>
        <text x="635" y="805" fill="currentColor">1.618</text>
        <text x="310" y="375" fill="currentColor">0.071</text>
        <text x="815" y="562" fill="currentColor">−2.190</text>
        <text x="1272" y="715" fill="currentColor">0.333</text>
      </g>
      {/* large watermark indices */}
      <g opacity="0.06" fontSize="72" fontFamily="'Inter', sans-serif" fontWeight="800" letterSpacing="-0.04em">
        <text x="18" y="220" fill="currentColor" transform="rotate(-90 55 180)">01</text>
        <text x="1360" y="590" fill="currentColor">02</text>
      </g>
    </svg>
    <div className="gbg-vignette" />
  </div>
);

export default GeoBackground;
