import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, Users } from 'lucide-react';
import './SocialHubChrome.css';

/* ─── geometric sidebar decoration ─── */
const SidebarGeo = () => (
  <svg
    className="shc-sidebar-geo"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 240 640"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    {/* corner brackets */}
    <path d="M8,28 L8,8 L28,8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M212,8 L232,8 L232,28" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M8,612 L8,632 L28,632" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M212,632 L232,632 L232,612" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5"/>

    {/* outer dashed orbit */}
    <circle cx="120" cy="320" r="68" fill="none" stroke="currentColor" strokeWidth="0.45" strokeDasharray="4 7" opacity="0.28"/>

    {/* central diamond */}
    <polygon points="120,272 178,318 120,364 62,318" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.52"/>
    <polygon points="120,294 150,318 120,342 90,318" fill="none" stroke="currentColor" strokeWidth="0.45" opacity="0.34"/>

    {/* axis lines from diamond corners */}
    <line x1="120" y1="272" x2="120" y2="110" stroke="currentColor" strokeWidth="0.4" opacity="0.28"/>
    <line x1="120" y1="364" x2="120" y2="526" stroke="currentColor" strokeWidth="0.4" opacity="0.28"/>
    <line x1="62"  y1="318" x2="8"   y2="318" stroke="currentColor" strokeWidth="0.4" opacity="0.28"/>
    <line x1="178" y1="318" x2="232" y2="318" stroke="currentColor" strokeWidth="0.4" opacity="0.28"/>

    {/* tick marks on axes */}
    <line x1="116" y1="195" x2="124" y2="195" stroke="currentColor" strokeWidth="0.5" opacity="0.32"/>
    <line x1="116" y1="441" x2="124" y2="441" stroke="currentColor" strokeWidth="0.5" opacity="0.32"/>
    <line x1="38"  y1="314" x2="38"  y2="322" stroke="currentColor" strokeWidth="0.5" opacity="0.32"/>
    <line x1="202" y1="314" x2="202" y2="322" stroke="currentColor" strokeWidth="0.5" opacity="0.32"/>

    {/* terminal squares on axes */}
    <rect x="115" y="105" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.42"/>
    <rect x="115" y="521" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.42"/>

    {/* terminal dots on horizontal axis */}
    <circle cx="8"   cy="318" r="2.2" fill="currentColor" opacity="0.45"/>
    <circle cx="232" cy="318" r="2.2" fill="currentColor" opacity="0.45"/>

    {/* centre dot */}
    <circle cx="120" cy="318" r="3.2" fill="currentColor" opacity="0.5"/>

    {/* diagonal accent lines (corner to diamond) */}
    <line x1="8"   y1="8"   x2="62"  y2="272" stroke="currentColor" strokeWidth="0.28" opacity="0.14"/>
    <line x1="232" y1="8"   x2="178" y2="272" stroke="currentColor" strokeWidth="0.28" opacity="0.14"/>
    <line x1="8"   y1="632" x2="62"  y2="364" stroke="currentColor" strokeWidth="0.28" opacity="0.14"/>
    <line x1="232" y1="632" x2="178" y2="364" stroke="currentColor" strokeWidth="0.28" opacity="0.14"/>

    {/* small satellite dots */}
    <circle cx="60"  cy="110" r="1.6" fill="currentColor" opacity="0.28"/>
    <circle cx="180" cy="110" r="1.6" fill="currentColor" opacity="0.28"/>
    <circle cx="60"  cy="526" r="1.6" fill="currentColor" opacity="0.28"/>
    <circle cx="180" cy="526" r="1.6" fill="currentColor" opacity="0.28"/>
  </svg>
);

/* ─── collapsed strip icon button ─── */
const StripBtn = ({ icon: Icon, label, onClick, active }) => (
  <button
    className={`shc-strip-btn ${active ? 'shc-strip-btn--active' : ''}`}
    type="button"
    onClick={onClick}
    data-tip={label}
  >
    <Icon size={18} />
  </button>
);

/* ─── footer nav items ─── */
const FOOTER_ITEMS = [
  { icon: Users,      label: 'Social Hub', path: '/social' },
  { icon: LayoutGrid, label: 'Dashboard',  path: '/dashboard-cerbyl' },
];

const SocialHubChrome = ({
  sideSections = [],   // [{ label, items: [{icon, label, onClick, active, count?}] }]
  noSidebar = false,
  children,
}) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="shc-shell">
      <div className="shc-topbar">
        <div className="shc-tagline">Learning, <span>Unified</span></div>
        <div className="shc-topbar-right">
          <button className="shc-top-btn" type="button" onClick={() => navigate('/dashboard-cerbyl')}>
            Dashboard
          </button>
        </div>
      </div>

      <div className={`shc-body ${noSidebar ? 'shc-body--no-sidebar' : collapsed ? 'shc-body--collapsed' : ''}`}>
        {!noSidebar && (
          <aside className={`shc-sidebar ${collapsed ? 'shc-sidebar--collapsed' : ''}`}>
            <SidebarGeo />

            {collapsed ? (
              /* ── icon strip (collapsed) ── */
              <div className="shc-strip">
                <button
                  className="shc-strip-btn shc-strip-btn--toggle"
                  type="button"
                  onClick={() => setCollapsed(false)}
                  data-tip="Expand"
                >
                  <ChevronRight size={18} />
                </button>

                <div className="shc-strip-spacer" />

                {sideSections.flatMap(s => s.items).map(item => (
                  <StripBtn
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    onClick={item.onClick}
                    active={item.active}
                  />
                ))}

                <div className="shc-strip-spacer" />

                {FOOTER_ITEMS.map(fi => (
                  <StripBtn key={fi.label} icon={fi.icon} label={fi.label} onClick={() => navigate(fi.path)} />
                ))}
              </div>
            ) : (
              /* ── full sidebar (expanded) ── */
              <>
                <div className="shc-sidebar-top">
                  <button
                    className="shc-collapse-btn"
                    type="button"
                    onClick={() => setCollapsed(true)}
                    title="Collapse"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>

                <div className="shc-side-sections">
                  {sideSections.map(section => (
                    <div key={section.label} className="shc-side-block">
                      <div className="shc-side-label">{section.label}</div>
                      <nav className="shc-view-nav">
                        {section.items.map(item => (
                          <button
                            key={item.label}
                            className={`shc-view-link ${item.active ? 'shc-view-link--active' : ''}`}
                            type="button"
                            onClick={item.onClick}
                          >
                            <item.icon size={16} />
                            <span>{item.label}</span>
                            {item.count != null && item.count > 0 && (
                              <span className="shc-nav-count">{item.count}</span>
                            )}
                          </button>
                        ))}
                      </nav>
                    </div>
                  ))}
                </div>

                <div className="shc-side-footer-nav">
                  {FOOTER_ITEMS.map(fi => (
                    <button
                      key={fi.label}
                      className="shc-view-link"
                      type="button"
                      onClick={() => navigate(fi.path)}
                      title={fi.label}
                    >
                      <fi.icon size={16} />
                      <span>{fi.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
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
