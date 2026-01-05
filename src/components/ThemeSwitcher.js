import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { THEMES } from '../utils/ThemeManager';
import { Palette, X, Sun, Moon, Check, Sparkles, Copy } from 'lucide-react';
import logo from '../assets/logo.svg';
import './ThemeSwitcher.css';

// Google-style Color Picker Component
const ColorPicker = ({ color, onChange, label }) => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [hexInput, setHexInput] = useState(color);
  const [isDragging, setIsDragging] = useState(false);
  const gradientRef = useRef(null);

  const hexToHSL = useCallback((hex) => {
    if (!hex || hex.length < 7) return { h: 0, s: 100, l: 50 };
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
        default: break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }, []);

  useEffect(() => {
    if (color) {
      const hsl = hexToHSL(color);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      setHexInput(color);
    }
  }, [color, hexToHSL]);

  const hslToHex = (h, s, l) => {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const updateColor = useCallback((newHue, newSat, newLight) => {
    const newHex = hslToHex(newHue, newSat, newLight);
    setHexInput(newHex);
    onChange(newHex);
  }, [onChange]);

  const handleGradientInteraction = useCallback((e) => {
    if (!gradientRef.current) return;
    const rect = gradientRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    const newSaturation = Math.round(x * 100);
    const newLightness = Math.round((1 - y) * 100);
    
    setSaturation(newSaturation);
    setLightness(newLightness);
    updateColor(hue, newSaturation, newLightness);
  }, [hue, updateColor]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleGradientInteraction(e);
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) handleGradientInteraction(e);
  }, [isDragging, handleGradientInteraction]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleHueChange = (e) => {
    const newHue = parseInt(e.target.value);
    setHue(newHue);
    updateColor(newHue, saturation, lightness);
  };

  const handleHexChange = (e) => {
    const value = e.target.value;
    setHexInput(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange(value);
      const hsl = hexToHSL(value);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
    }
  };

  const copyToClipboard = () => navigator.clipboard.writeText(hexInput);

  const cursorX = saturation;
  const cursorY = 100 - lightness;

  return (
    <div className="ts-picker-container">
      <label className="ts-label">{label}</label>
      
      <div 
        className="ts-gradient-box"
        ref={gradientRef}
        onMouseDown={handleMouseDown}
        style={{ 
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
          `
        }}
      >
        <div 
          className="ts-gradient-cursor"
          style={{ 
            left: `${cursorX}%`, 
            top: `${cursorY}%`,
            background: color,
            borderColor: lightness > 50 ? '#000' : '#fff'
          }}
        />
      </div>
      
      <div className="ts-hue-slider-container">
        <input
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={handleHueChange}
          className="ts-hue-slider"
        />
        <div 
          className="ts-hue-thumb"
          style={{ left: `${(hue / 360) * 100}%`, background: `hsl(${hue}, 100%, 50%)` }}
        />
      </div>
      
      <div className="ts-hex-input-row">
        <span className="ts-label">HEX</span>
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          className="ts-hex-input"
          maxLength={7}
        />
        <button className="ts-copy-btn" onClick={copyToClipboard}>
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
};

const ThemeSwitcher = () => {
  const { selectedThemeId, customTheme, changeTheme, applyCustomColors, selectedTheme } = useTheme();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [activeTab, setActiveTab] = useState('presets');
  
  // Pending selections
  const [pendingPresetId, setPendingPresetId] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#0b0b0c');
  const [accentColor, setAccentColor] = useState('#D7B38C');
  const [originalPrimary, setOriginalPrimary] = useState('#0b0b0c');
  const [originalAccent, setOriginalAccent] = useState('#D7B38C');
  
  const panelRef = useRef(null);

  // Initialize state when panel opens
  useEffect(() => {
    if (showThemePanel) {
      setPendingPresetId(selectedThemeId);
      const primary = customTheme?.primary || '#0b0b0c';
      const accent = customTheme?.accent || '#D7B38C';
      setPrimaryColor(primary);
      setAccentColor(accent);
      setOriginalPrimary(primary);
      setOriginalAccent(accent);
    }
  }, [showThemePanel, selectedThemeId, customTheme]);

  const handlePresetSelect = (themeId) => setPendingPresetId(themeId);

  const handleApplyPreset = () => {
    if (pendingPresetId) changeTheme(pendingPresetId);
    setShowThemePanel(false);
  };

  const handleCancelPreset = () => {
    setPendingPresetId(selectedThemeId);
    setShowThemePanel(false);
  };

  const handleApplyCustomTheme = () => {
    applyCustomColors(primaryColor, accentColor, 'dark');
    setShowThemePanel(false);
  };

  const handleCancelCustom = () => {
    setPrimaryColor(originalPrimary);
    setAccentColor(originalAccent);
    setShowThemePanel(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target) && 
          !event.target.closest('.ts-trigger-btn')) {
        setShowThemePanel(false);
      }
    };
    if (showThemePanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showThemePanel]);

  const getCurrentColors = () => {
    if (selectedThemeId === 'custom' && customTheme) {
      return { primary: customTheme.primary, accent: customTheme.accent };
    }
    const theme = THEMES[selectedThemeId] || THEMES['gold-dark'];
    return {
      primary: theme.mode === 'dark' ? '#0b0b0c' : '#fefefe',
      accent: theme.accent
    };
  };

  const currentColors = getCurrentColors();
  const darkThemes = Object.values(THEMES).filter(t => t.mode === 'dark');
  const lightThemes = Object.values(THEMES).filter(t => t.mode === 'light');
  const currentMode = selectedTheme?.mode || 'dark';

  const isColorDark = (hex) => {
    if (!hex) return true;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.3;
  };

  // Determine text color for preview based on primary brightness
  const getPreviewTextColor = () => {
    return isColorDark(primaryColor) ? '#EAECEF' : '#1a1a1a';
  };

  return (
    <div className="ts-container">
      <button className="ts-trigger-btn" onClick={() => setShowThemePanel(!showThemePanel)}>
        <Palette size={20} />
      </button>

      {showThemePanel && (
        <div 
          className={`ts-panel ${activeTab === 'custom' ? 'ts-panel-wide' : ''}`} 
          ref={panelRef} 
          data-theme-mode={currentMode}
        >
          <div className="ts-header">
            <div className="ts-current">
              <span className="ts-label">CURRENT THEME</span>
              <div className="ts-current-colors">
                <div 
                  className={`ts-swatch ${isColorDark(currentColors.primary) && currentMode === 'dark' ? 'ts-swatch-dark' : ''}`}
                  style={{ background: currentColors.primary }} 
                />
                <span className="ts-plus">+</span>
                <div className="ts-swatch" style={{ background: currentColors.accent }} />
              </div>
            </div>
            <button className="ts-close-btn" onClick={() => setShowThemePanel(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="ts-tabs">
            <button 
              className={`ts-tab ${activeTab === 'presets' ? 'active' : ''}`}
              onClick={() => setActiveTab('presets')}
            >
              PRESET THEMES
            </button>
            <button 
              className={`ts-tab ${activeTab === 'custom' ? 'active' : ''}`}
              onClick={() => setActiveTab('custom')}
            >
              <Sparkles size={14} />
              CUSTOM
            </button>
          </div>

          <div className="ts-content">
            {activeTab === 'presets' ? (
              <div className="ts-presets">
                <div className="ts-section">
                  <div className="ts-section-header">
                    <Moon size={14} />
                    <span>DARK THEMES</span>
                  </div>
                  <div className="ts-grid">
                    {darkThemes.map(theme => (
                      <button
                        key={theme.id}
                        className={`ts-preset-btn ${pendingPresetId === theme.id ? 'active' : ''}`}
                        onClick={() => handlePresetSelect(theme.id)}
                      >
                        <div className="ts-preset-colors">
                          <div 
                            className={`ts-preset-swatch ${currentMode === 'dark' ? 'ts-swatch-dark' : ''}`}
                            style={{ background: '#0b0b0c' }}
                          />
                          <div className="ts-preset-swatch" style={{ background: theme.accent }} />
                        </div>
                        <span className="ts-preset-name">{theme.name}</span>
                        {pendingPresetId === theme.id && <Check size={12} className="ts-check" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ts-section">
                  <div className="ts-section-header">
                    <Sun size={14} />
                    <span>LIGHT THEMES</span>
                  </div>
                  <div className="ts-grid">
                    {lightThemes.map(theme => (
                      <button
                        key={theme.id}
                        className={`ts-preset-btn ${pendingPresetId === theme.id ? 'active' : ''}`}
                        onClick={() => handlePresetSelect(theme.id)}
                      >
                        <div className="ts-preset-colors">
                          <div 
                            className="ts-preset-swatch ts-swatch-light"
                            style={{ background: '#fefefe' }}
                          />
                          <div className="ts-preset-swatch" style={{ background: theme.accent }} />
                        </div>
                        <span className="ts-preset-name">{theme.name}</span>
                        {pendingPresetId === theme.id && <Check size={12} className="ts-check" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ts-actions">
                  <button className="ts-cancel-btn" onClick={handleCancelPreset}>CANCEL</button>
                  <button className="ts-ok-btn" onClick={handleApplyPreset}>OK</button>
                </div>
              </div>
            ) : (
              <div className="ts-custom">
                {/* Side by side pickers */}
                <div className="ts-pickers-row">
                  <ColorPicker 
                    color={primaryColor}
                    onChange={setPrimaryColor}
                    label="PRIMARY"
                  />
                  <ColorPicker 
                    color={accentColor}
                    onChange={setAccentColor}
                    label="ACCENT"
                  />
                </div>

                {/* Live Preview with Cerbyl branding */}
                <div className="ts-live-preview">
                  <span className="ts-label">LIVE PREVIEW</span>
                  <div 
                    className="ts-preview-card"
                    style={{ background: primaryColor }}
                  >
                    <div className="ts-preview-header" style={{ borderColor: accentColor }}>
                      <div className="ts-preview-dots">
                        <span style={{ background: accentColor }}></span>
                        <span style={{ background: accentColor, opacity: 0.6 }}></span>
                        <span style={{ background: accentColor, opacity: 0.3 }}></span>
                      </div>
                    </div>
                    <div className="ts-preview-content">
                      <div className="ts-preview-logo-section">
                        <img 
                          src={logo} 
                          alt="Cerbyl" 
                          className="ts-preview-logo"
                          style={{ filter: isColorDark(primaryColor) ? 'brightness(0) invert(1)' : 'brightness(0)' }}
                        />
                        <div className="ts-preview-brand">
                          <span 
                            className="ts-preview-brand-name"
                            style={{ color: accentColor }}
                          >
                            cerbyl
                          </span>
                          <span 
                            className="ts-preview-tagline"
                            style={{ color: getPreviewTextColor() }}
                          >
                            Learn. Practice. Grow.
                          </span>
                        </div>
                      </div>
                      <div className="ts-preview-buttons">
                        <div 
                          className="ts-preview-btn-primary"
                          style={{ background: accentColor, color: primaryColor }}
                        >
                          BUTTON
                        </div>
                        <div 
                          className="ts-preview-btn-secondary"
                          style={{ borderColor: accentColor, color: accentColor }}
                        >
                          BUTTON
                        </div>
                      </div>
                      <div className="ts-preview-text-samples">
                        <span style={{ color: getPreviewTextColor() }}>Primary Text</span>
                        <span style={{ color: getPreviewTextColor(), opacity: 0.6 }}>Secondary Text</span>
                        <span style={{ color: accentColor }}>Accent Text</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ts-actions">
                  <button className="ts-cancel-btn" onClick={handleCancelCustom}>CANCEL</button>
                  <button 
                    className="ts-ok-btn"
                    onClick={handleApplyCustomTheme}
                    style={{ background: accentColor, color: primaryColor }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
