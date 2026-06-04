import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronLeft,
  LayoutGrid,
  LogOut,
  Share2,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import './SocialHubChrome.css';

const SOCIAL_HUB_LINKS = [
  { key: 'social', label: 'Social Hub', path: '/social', icon: LayoutGrid },
  { key: 'friends', label: 'Friends', path: '/friends', icon: Users },
  { key: 'shared', label: 'Shared Content', path: '/shared', icon: Share2 },
  { key: 'activity', label: 'Activity Feed', path: '/activity-feed', icon: Activity },
  { key: 'leaderboards', label: 'Leaderboards', path: '/leaderboards', icon: Trophy },
  { key: 'challenges', label: 'Challenges', path: '/challenges', icon: Target },
];

const SocialHubChrome = ({
  title = 'Social Hub',
  tagline = 'connect your learning',
  activeKey,
  primaryAction,
  topActions = [],
  sideSections = [],
  stats = [],
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  ));

  const isActiveLink = (link) => {
    if (activeKey) return activeKey === link.key;
    if (link.path === '/social') return location.pathname === '/social';
    return location.pathname === link.path || location.pathname.startsWith(`${link.path}/`);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/');
  };

  return (
    <div className="shc-shell">
      <div className="shc-topbar">
        <div className="shc-tagline">accelerate <span>{tagline}</span></div>
        <div className="shc-topbar-right">
          <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>
            Dashboard
          </button>
          {topActions.map((action) => (
            <button
              key={action.label}
              className="shc-top-btn"
              type="button"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
          <button className="shc-top-btn" type="button" onClick={() => setSidebarCollapsed(prev => !prev)}>
            {sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
          </button>
          {primaryAction && (
            <button className="shc-top-btn shc-top-btn--accent" type="button" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      <div className={`shc-body ${sidebarCollapsed ? 'shc-body--collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <aside className="shc-sidebar" aria-label={`${title} navigation`}>
            <div className="shc-side-brand">
              <div className="shc-brand-wrap">
                <div className="shc-brand">cerbyl</div>
                <div className="shc-current-title">{title}</div>
              </div>
              <button
                className="shc-side-close-btn"
                type="button"
                title="Close sidebar"
                aria-label="Close social hub sidebar"
                onClick={() => setSidebarCollapsed(true)}
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="shc-side-block">
              <div className="shc-side-label">Social Hub</div>
              <nav className="shc-view-nav" aria-label="Social Hub pages">
                {SOCIAL_HUB_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.key}
                      className={`shc-view-link ${isActiveLink(link) ? 'shc-view-link--active' : ''}`}
                      type="button"
                      onClick={() => navigate(link.path)}
                    >
                      <Icon size={16} />
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {sideSections.map((section) => (
              <div key={section.label} className={`shc-side-block ${section.grow ? 'shc-side-block--grow' : ''}`}>
                <div className="shc-side-label">{section.label}</div>
                {section.children}
              </div>
            ))}

            {stats.length > 0 && (
              <div className="shc-side-block">
                <div className="shc-side-label">Quick Stats</div>
                <div className="shc-stat-grid">
                  {stats.map((stat) => (
                    <div className="shc-stat-card" key={stat.label}>
                      <span>{stat.value}</span>
                      <small>{stat.label}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="shc-side-actions">
              {primaryAction && (
                <button className="shc-action-btn" type="button" onClick={primaryAction.onClick}>
                  {primaryAction.icon}
                  <span>{primaryAction.label}</span>
                </button>
              )}
              <button className="shc-action-btn shc-action-btn--ghost" type="button" onClick={() => navigate('/dashboard-cerbyl')}>
                <LayoutGrid size={14} />
                <span>Dashboard</span>
              </button>
              <button className="shc-action-btn shc-action-btn--ghost" type="button" onClick={logout}>
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        )}

        <main className="shc-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SocialHubChrome;
