import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, BookOpen, MessageSquare, Calendar, Users, BarChart3,
  Target, Award, Zap, FileText, Layers, Map, Brain, Trophy,
  TrendingUp, Activity, Clock, Bell, Star, Sparkles, Grid,
  ChevronDown, ChevronRight, X, Search, Settings, LogOut,
  GraduationCap, Lightbulb, BookMarked, PenTool, CheckSquare,
  Gamepad2, Share2, Eye, Flame, Heart, Bookmark
} from 'lucide-react';
import './GlobalNavSidebar.css';

const GlobalNavSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(['main']);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (sectionId) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const navigationStructure = [
    {
      id: 'main',
      title: 'Main',
      icon: Home,
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: Home, description: 'Your learning hub' },
        { path: '/search-hub', label: 'Search Hub', icon: Search, description: 'Find anything instantly' },
      ]
    },
    {
      id: 'learning',
      title: 'Learning Tools',
      icon: GraduationCap,
      items: [
        { path: '/ai-chat', label: 'AI Chat', icon: MessageSquare, description: 'Chat with AI tutor' },
        { path: '/notes-redesign', label: 'Notes', icon: FileText, description: 'Smart note-taking' },
        { path: '/flashcards', label: 'Flashcards', icon: BookMarked, description: 'Master key concepts' },
        { path: '/quiz-hub', label: 'Quiz Hub', icon: CheckSquare, description: 'Test your knowledge' },
        { path: '/slide-explorer', label: 'Slide Explorer', icon: Layers, description: 'AI slide analysis' },
        { path: '/ai-media-notes', label: 'Media Notes', icon: Eye, description: 'Audio/video learning' },
      ]
    },
    {
      id: 'practice',
      title: 'Practice & Assessment',
      icon: Target,
      items: [
        { path: '/question-bank', label: 'Question Bank', icon: Lightbulb, description: 'Practice questions' },
        { path: '/solo-quiz', label: 'Solo Quiz', icon: PenTool, description: 'Individual practice' },
        { path: '/quiz-battle', label: 'Quiz Battle', icon: Zap, description: 'Compete with friends' },
        { path: '/weaknesses', label: 'Weak Areas', icon: TrendingUp, description: 'Identify & improve' },
        { path: '/weakness-practice', label: 'Weakness Practice', icon: Target, description: 'Targeted practice' },
        { path: '/challenges', label: 'Challenges', icon: Trophy, description: 'Daily challenges' },
      ]
    },
    {
      id: 'progress',
      title: 'Progress & Analytics',
      icon: BarChart3,
      items: [
        { path: '/analytics', label: 'Analytics', icon: BarChart3, description: 'Detailed insights' },
        { path: '/study-insights', label: 'Study Insights', icon: Brain, description: 'Learning patterns' },
        { path: '/xp-roadmap', label: 'XP Roadmap', icon: Map, description: 'Your learning journey' },
        { path: '/knowledge-roadmap', label: 'Knowledge Roadmap', icon: Sparkles, description: 'Concept mastery' },
        { path: '/activity-timeline', label: 'Activity Timeline', icon: Clock, description: 'Calendar & reminders' },
      ]
    },
    {
      id: 'learning-paths',
      title: 'Learning Paths',
      icon: Map,
      items: [
        { path: '/learning-paths', label: 'All Paths', icon: Map, description: 'Structured courses' },
        { path: '/playlists', label: 'Playlists', icon: BookOpen, description: 'Curated content' },
        { path: '/concept-web', label: 'Concept Web', icon: Grid, description: 'Knowledge graph' },
        { path: '/learning-review-hub', label: 'Review Hub', icon: Bookmark, description: 'Review materials' },
      ]
    },
    {
      id: 'social',
      title: 'Social & Gamification',
      icon: Users,
      items: [
        { path: '/social', label: 'Social Hub', icon: Users, description: 'Connect with learners' },
        { path: '/friends-dashboard', label: 'Friends', icon: Heart, description: 'Your study buddies' },
        { path: '/leaderboards', label: 'Leaderboards', icon: Trophy, description: 'Top performers' },
        { path: '/games', label: 'Games', icon: Gamepad2, description: 'Learning games' },
        { path: '/shared-content', label: 'Shared Content', icon: Share2, description: 'Community resources' },
      ]
    },
    {
      id: 'profile',
      title: 'Profile & Settings',
      icon: Settings,
      items: [
        { path: '/profile', label: 'Profile', icon: Star, description: 'Your profile' },
        { path: '/customize-dashboard', label: 'Customize', icon: Settings, description: 'Personalize dashboard' },
      ]
    }
  ];

  const filteredNavigation = searchQuery
    ? navigationStructure.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.items.length > 0)
    : navigationStructure;

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="global-nav-overlay" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div className={`global-nav-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="global-nav-header">
          <div className="global-nav-logo">
            <div className="global-nav-logo-icon" />
            <span>cerbyl</span>
          </div>
          <button className="global-nav-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="global-nav-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Navigation */}
        <div className="global-nav-content">
          {filteredNavigation.map(section => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.id);

            return (
              <div key={section.id} className="global-nav-section">
                <button
                  className="global-nav-section-header"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="global-nav-section-title">
                    <SectionIcon size={18} />
                    <span>{section.title}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                  <div className="global-nav-section-items">
                    {section.items.map(item => {
                      const ItemIcon = item.icon;
                      return (
                        <button
                          key={item.path}
                          className={`global-nav-item ${isActive(item.path) ? 'active' : ''}`}
                          onClick={() => handleNavigate(item.path)}
                        >
                          <ItemIcon size={18} />
                          <div className="global-nav-item-content">
                            <span className="global-nav-item-label">{item.label}</span>
                            <span className="global-nav-item-desc">{item.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="global-nav-footer">
          <button
            className="global-nav-footer-btn"
            onClick={() => {
              localStorage.clear();
              navigate('/login');
              onClose();
            }}
          >
            <LogOut size={18} />
            <span>LOGOUT</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default GlobalNavSidebar;
