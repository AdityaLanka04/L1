import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import GeometricGrid from '../components/GeometricGrid';
import './ProfilePage.css';
import './Games.css';
import './XPRoadmap.css';

// Built on the Profile page's layout and cards (.pf-page / .pnw-*), like Games.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATE_LABEL = { mastered: 'Reached', active: 'Next', locked: 'Locked' };

const PageBackground = () => (
  <div className="pf-bg-fx" aria-hidden="true">
    <div className="pf-bg-wash" />
    <div className="pf-bg-orb pf-bg-orb-1" />
    <div className="pf-bg-orb pf-bg-orb-2" />
    <GeometricGrid className="pf-bg-geo" linesClassName="pf-bg-geo-lines" numsClassName="pf-bg-geo-nums" />
    <div className="pf-bg-grain" />
    <div className="pf-bg-vignette" />
  </div>
);

const pad = (value) => String(value).padStart(2, '0');

export default function XPRoadmapWorkspace({
  loading,
  statsError,
  retryStats,
  navigate,
  drawerRef,
  drawerCloseRef,
  level,
  xp,
  levelProgress,
  levelWindow,
  masteredCount,
  nextNode,
  nextMissionAction,
  stats,
  quests,
  runMechanics,
  decayLabel,
  powerUps,
  powerUpLoading,
  powerNotice,
  handleUsePowerUp,
  streakChain,
  topicArcs,
  roadmapLoading,
  roadmapError,
  retryRoadmap,
  badgeCollection,
  handleNodeClick,
  openNextMission,
  setSelectedNode,
  selectedNodeDetails,
  missionRecommendations,
  activeMissionTopic,
  setSelectedMissionTopic,
  missionNotice,
  selectedMissionAction,
  selectedCtaLabel,
  missionLoading,
  handleContinueMission
}) {
  const [armedPowerUp, setArmedPowerUp] = useState(null);

  if (loading) {
    return (
      <div className="pf-page gm-page xr-page">
        <PageBackground />
        <div className="gm-loading" role="status">
          <div className="gm-loading-cubes" aria-hidden="true"><span /><span /><span /></div>
          <p>Loading your roadmap…</p>
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="pf-page gm-page xr-page">
        <PageBackground />
        <Link className="pf-back" to="/dashboard-cerbyl"><ChevronLeft size={16} aria-hidden="true" />Dashboard</Link>
        <div className="gm-loading" role="alert">
          <p>{statsError}</p>
          <button type="button" className="pnw-secondary-action" onClick={retryStats}>Try again</button>
        </div>
      </div>
    );
  }

  const xpToNextLevel = Math.max(0, levelWindow.end - xp);
  const streak = stats?.current_streak || 0;

  return (
    <div className="pf-page gm-page xr-page">
      <PageBackground />

      <Link className="pf-back" to="/dashboard-cerbyl"><ChevronLeft size={16} aria-hidden="true" />Dashboard</Link>

      <div className="pnw-main">
        <div className="pnw-canvas">
          <section className="pnw-identity gm-identity">
            <div className="pnw-identity-copy">
              <h1>XP Roadmap<span>.</span></h1>
              <p className="pnw-handle">
                {nextNode
                  ? `${Math.max(0, nextNode.xp - xp).toLocaleString()} XP to ${nextNode.title}, milestone ${pad(masteredCount + 1)} of ${pad(badgeCollection.length)}.`
                  : 'Every milestone reached. Keep learning to raise your level.'}
              </p>
              <div className="pnw-identity-actions">
                <button type="button" className="pnw-primary-action" onClick={openNextMission}>
                  {nextNode ? `Continue to ${nextNode.title}` : 'Open analytics'} <ChevronRight size={15} aria-hidden="true" />
                </button>
                <button type="button" className="pnw-secondary-action" onClick={() => navigate('/games')}>
                  Learning games
                </button>
              </div>
            </div>
          </section>

          <section className="pnw-status-band" aria-label="Level summary">
            <div><span>Level</span><strong>{pad(level)}</strong></div>
            <div><span>Total XP</span><strong>{xp.toLocaleString()}</strong></div>
            <div><span>Streak</span><strong>{streak} {streak === 1 ? 'day' : 'days'}</strong></div>
            <div><span>Level {level + 1}</span><strong>{xpToNextLevel.toLocaleString()} XP</strong></div>
          </section>

          <section className="pnw-panel">
            <div className="pnw-section-heading">
              <div>
                <span>Level {pad(level)}</span>
                <h2>Progress to level {pad(level + 1)}</h2>
              </div>
              <small>{Math.round(levelProgress)}%</small>
            </div>
            <div className="gm-progress">
              <div className="gm-bar"><i style={{ width: `${levelProgress}%` }} /></div>
              <span>{xp.toLocaleString()} / {levelWindow.end.toLocaleString()} XP</span>
            </div>
          </section>

          <section className="pnw-panel">
            <div className="pnw-section-heading">
              <div>
                <span>Milestones</span>
                <h2>The Roadmap</h2>
              </div>
              <small>{masteredCount} of {badgeCollection.length} reached</small>
            </div>
            <ol className="xr-milestones">
              {badgeCollection.map((node, index) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={`xr-milestone is-${node.state}`}
                    onClick={(event) => handleNodeClick(node, node.state, event)}
                  >
                    <span className="xr-index">{pad(index + 1)}</span>
                    <span className="xr-title">
                      <strong>{node.title}</strong>
                      <small>{node.reward}</small>
                    </span>
                    <span className="xr-xp">{node.xp.toLocaleString()} XP</span>
                    <span className="xr-state">{STATE_LABEL[node.state] || node.state}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="pnw-panel">
            <div className="pnw-section-heading">
              <div>
                <span>This week</span>
                <h2>Weekly Quests</h2>
              </div>
              <small>{runMechanics.completedQuests} of {quests.length || 4} done · resets in {decayLabel}</small>
            </div>
            {quests.length === 0 ? (
              <p className="gm-text">No weekly activity yet. Complete a learning activity to start this week.</p>
            ) : (
              <div className="xr-quests">
                {quests.map((quest, index) => (
                  <div key={quest.id} className={`gm-task${quest.done ? ' is-done' : ''}`}>
                    <div className="gm-task-head">
                      <strong><span className="xr-quest-index">{pad(index + 1)}</span>{quest.label}</strong>
                      <span>{quest.done ? 'Done' : `${quest.progress}%`}</span>
                    </div>
                    <div className="gm-progress">
                      <div className="gm-bar"><i style={{ width: `${quest.progress}%` }} /></div>
                      <span>{quest.current} / {quest.goal}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="gm-note">Finish all four quests in a week to earn a boost charge.</p>
          </section>

          <div className="pnw-work-grid">
            <section className="pnw-panel">
              <div className="pnw-section-heading">
                <div>
                  <span>Seven-day chain</span>
                  <h2>Study Streak</h2>
                </div>
                <small>{streak} {streak === 1 ? 'day' : 'days'}</small>
              </div>
              <div className="xr-chain" aria-label={`${streak} day streak`}>
                {streakChain.map((link, index) => (
                  <span key={link.id} className={`${link.active ? 'is-active' : ''} ${link.current ? 'is-current' : ''}`}>
                    <b>{pad(index + 1)}</b>
                    <small>{WEEKDAYS[index]}</small>
                  </span>
                ))}
              </div>
            </section>

            <section className="pnw-panel">
              <div className="pnw-section-heading">
                <div>
                  <span>Power-ups</span>
                  <h2>Available Tools</h2>
                </div>
              </div>
              <ul className="gm-list xr-tools">
                {powerUps.map((power) => {
                  const armed = armedPowerUp === power.id;
                  return (
                    <li key={power.id}>
                      <div>
                        <strong>{power.label} · {power.value}</strong>
                        <small>{power.description}</small>
                      </div>
                      <button
                        type="button"
                        className="pnw-secondary-action xr-tool-action"
                        disabled={power.disabled || powerUpLoading === power.id}
                        onClick={() => {
                          if (armed) {
                            setArmedPowerUp(null);
                            handleUsePowerUp(power);
                          } else {
                            setArmedPowerUp(power.id);
                          }
                        }}
                      >
                        {powerUpLoading === power.id ? 'Working' : armed ? 'Confirm' : 'Use'}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {powerNotice && <p className={`xr-notice is-${powerNotice.type}`} role="status">{powerNotice.text}</p>}
            </section>
          </div>

          <section className="pnw-panel">
            <div className="pnw-section-heading">
              <div>
                <span>Your topics</span>
                <h2>Topic Progress</h2>
              </div>
              {roadmapLoading && <small role="status">Refreshing</small>}
            </div>
            {!roadmapLoading && roadmapError ? (
              <div className="xr-empty">
                <p className="gm-text">{roadmapError}</p>
                <button type="button" className="pnw-secondary-action" onClick={retryRoadmap}>Try again</button>
              </div>
            ) : topicArcs.length === 0 ? (
              <div className="xr-empty">
                <p className="gm-text">No topics yet. Study a topic and its milestones will appear here.</p>
                <button type="button" className="pnw-secondary-action" onClick={() => navigate('/search-hub')}>Explore a topic</button>
              </div>
            ) : (
              <div className="xr-quests">
                {topicArcs.map((arc) => (
                  <div key={arc.topic} className="gm-task">
                    <div className="gm-task-head">
                      <strong>{arc.topic}</strong>
                      <span>{arc.progress}%</span>
                    </div>
                    <div className="gm-progress">
                      <div className="gm-bar"><i style={{ width: `${arc.progress}%` }} /></div>
                      <span>{arc.completed} / {arc.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedNodeDetails && (
        <div className="xr-drawer-layer">
          <button className="xr-drawer-backdrop" type="button" aria-label="Close milestone details" onClick={() => setSelectedNode(null)} />
          <aside ref={drawerRef} className="pnw-panel xr-drawer" role="dialog" aria-modal="true" aria-labelledby="xr-drawer-title">
            <div className="pnw-section-heading">
              <div>
                <span>{selectedNodeDetails.state === 'mastered' ? 'Reached' : selectedNodeDetails.state === 'active' ? 'Next milestone' : 'Locked'}</span>
                <h2 id="xr-drawer-title">{selectedNodeDetails.title}</h2>
              </div>
              <button ref={drawerCloseRef} type="button" className="xr-close" onClick={() => setSelectedNode(null)} aria-label="Close milestone details"><X size={18} /></button>
            </div>

            <dl className="xr-facts">
              <div><dt>Reward</dt><dd>{selectedNodeDetails.reward}</dd></div>
              <div><dt>Unlocks at</dt><dd>{selectedNodeDetails.xp.toLocaleString()} XP</dd></div>
              <div><dt>Remaining</dt><dd>{selectedNodeDetails.delta > 0 ? `${selectedNodeDetails.delta.toLocaleString()} XP` : 'None'}</dd></div>
            </dl>

            <span className="xr-label">{roadmapLoading ? 'Updating recommendations' : 'Study focus'}</span>
            <div className="xr-topics">
              {missionRecommendations.map((recommendation) => (
                <button
                  key={recommendation.topic}
                  type="button"
                  className={recommendation.topic === activeMissionTopic ? 'is-active' : ''}
                  onClick={() => setSelectedMissionTopic(recommendation.topic)}
                >
                  <strong>{recommendation.topic}</strong>
                  <small>{recommendation.reason}</small>
                </button>
              ))}
            </div>

            <p className={`xr-notice ${missionNotice ? `is-${missionNotice.type}` : ''}`} role="status">
              {missionNotice
                ? missionNotice.text
                : (selectedNodeDetails.state === 'locked' && nextNode
                  ? `Locked. Continue from ${nextNode.title} with ${activeMissionTopic}.`
                  : `${selectedMissionAction.label} with ${activeMissionTopic}.`)}
            </p>

            <button type="button" className="pnw-primary-action xr-cta" onClick={handleContinueMission} disabled={missionLoading}>
              {missionLoading ? 'Preparing' : (selectedCtaLabel || nextMissionAction?.label)}
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
