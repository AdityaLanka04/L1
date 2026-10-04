import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import {
  getWeaknessProfile, getWeaknessRecommendations,
  WeakArea, WeaknessProfile, WeaknessRecommendation,
} from '../services/api';
import HapticTouchable from './HapticTouchable';
import PulseCubes from './PulseCubes';
import { cbTileShadow } from './NeumorphicTexture';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';

// Mobile counterpart of the web Weak Areas "Intelligence" view
// (src/components/WeaknessTracker/WeaknessTracker.js): the BKT concept
// profile from /intelligence/weakness/profile plus today's recommendations,
// falling back to the live weakness-score signals when no profile exists yet.

type Props = {
  user: AuthUser;
  areas: WeakArea[];
  onOpenTopic: (topic: string) => void;
  onAskTutor: (concept: string) => void;
};

type Tab = 'overview' | 'heatmap' | 'charts' | 'badges';

const MASTERY_COLORS: Record<string, string> = {
  deep_red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  light_green: '#86efac',
  bright_green: '#22c55e',
};
const TREND_ICONS: Record<string, string> = { improving: '↑', declining: '↓', stable: '→' };
const RESOURCE_LABELS: Record<string, string> = { ask_tutor: 'Ask tutor', review_flashcards: 'Flashcards', try_a_quiz: 'Quiz' };

function masteryColor(p: number) {
  const pct = Math.round((p || 0) * 100);
  return pct < 30 ? MASTERY_COLORS.deep_red
    : pct < 50 ? MASTERY_COLORS.orange
    : pct < 70 ? MASTERY_COLORS.yellow
    : pct < 85 ? MASTERY_COLORS.light_green
    : MASTERY_COLORS.bright_green;
}

export default function WeaknessIntelligence({ user, areas, onOpenTopic, onAskTutor }: Props) {
  const { selectedTheme } = useAppTheme();
  const s = useMemo(() => createStyles(selectedTheme), [selectedTheme]);
  const [profile, setProfile] = useState<WeaknessProfile | null>(null);
  const [recommendations, setRecommendations] = useState<WeaknessRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [chartWidth, setChartWidth] = useState(300);

  const load = useCallback(async () => {
    if (!user.username) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [p, r] = await Promise.all([
        getWeaknessProfile(user.username),
        getWeaknessRecommendations(user.username),
      ]);
      setProfile(p);
      setRecommendations(r.recommendations || []);
    } catch {
      setError('Failed to load intelligence data. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <PulseCubes color={selectedTheme.accent} size={14} />
        <Text style={s.muted}>loading your intelligence profile</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.card}>
        <Text style={s.muted}>{error}</Text>
        <HapticTouchable style={s.primaryBtn} onPress={load} haptic="light"><Text style={s.primaryBtnText}>retry</Text></HapticTouchable>
      </View>
    );
  }
  if (!profile) return <Fallback areas={areas} styles={s} onOpenTopic={onOpenTopic} />;

  const stats = profile.stats || {};
  const weakConcepts = profile.weak_concepts || [];
  const badges = profile.badges || [];
  const weekly = profile.weekly_activity || [];
  const masteryOverTime = profile.mastery_over_time || [];
  const heatmap = profile.heatmap || [];
  const strugglingToday = profile.struggling_today || [];
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  const maxWeekly = Math.max(1, ...weekly.map((d) => d.interactions || 0));
  const conceptLabel = (c: { concept_name?: string; concept_id: string }) => c.concept_name || c.concept_id;

  return (
    <View style={{ gap: 12 }}>
      {strugglingToday.length > 0 && (
        <View style={s.banner}>
          <Ionicons name="flash-outline" size={14} color={selectedTheme.warning} />
          <Text style={s.bannerText} numberOfLines={2}>Struggling today: {strugglingToday.slice(0, 3).join(', ')}</Text>
        </View>
      )}

      <View style={s.statsGrid}>
        {([
          ['total points', (stats.total_points || 0).toLocaleString()],
          ['this week', `+${(stats.weekly_points || 0).toLocaleString()}`],
          ['streak', `${stats.daily_streak || 0} days`],
          ['mastered', String(stats.concepts_mastered || 0)],
          ['in progress', String(stats.concepts_in_progress || 0)],
          ['study hours', String(Math.round(stats.total_study_time_hours || 0))],
        ] as [string, string][]).map(([label, value]) => (
          <View key={label} style={s.statCell}>
            <Text style={s.statLabel}>{label}</Text>
            <Text style={s.statValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabs}>
        {(['overview', 'heatmap', 'charts', 'badges'] as Tab[]).map((key) => (
          <HapticTouchable key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)} haptic="selection">
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{key}</Text>
          </HapticTouchable>
        ))}
      </View>

      {tab === 'overview' && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>priority study list</Text>
            {weakConcepts.length === 0 ? (
              <Text style={s.muted}>No weak concepts tracked yet. Start studying!</Text>
            ) : weakConcepts.slice(0, 5).map((c, i) => (
              <View key={c.concept_id || i} style={s.conceptRow}>
                <View style={s.conceptHead}>
                  <Text style={s.conceptName} numberOfLines={1}>{conceptLabel(c)}</Text>
                  <Text style={s.trend}>{TREND_ICONS[c.mastery_trend_label || ''] || '→'}</Text>
                </View>
                <MasteryBar value={c.p_mastery} styles={s} />
                {c.evidence ? <Text style={s.evidence} numberOfLines={3}>“{c.evidence}”</Text> : null}
                <View style={s.conceptFoot}>
                  <Text style={s.muted}>{(c.struggle_sources || []).join(' · ')}</Text>
                  <HapticTouchable style={s.ghostBtn} onPress={() => onAskTutor(conceptLabel(c))} haptic="light">
                    <Text style={s.ghostBtnText}>ask tutor</Text>
                  </HapticTouchable>
                </View>
              </View>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>today's recommendations</Text>
            {recommendations.length === 0 ? (
              <Text style={s.muted}>No recommendations yet. Keep studying!</Text>
            ) : recommendations.slice(0, 3).map((r, i) => (
              <View key={r.concept_id || i} style={s.recRow}>
                <Text style={s.recRank}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.conceptName} numberOfLines={1}>{r.concept_name || r.concept_id}</Text>
                  <Text style={s.muted}>
                    mastery {Math.round((r.p_mastery || 0) * 100)}% · ~{r.estimated_time_minutes}min · {TREND_ICONS[r.trend_label] || '→'}
                  </Text>
                </View>
                <HapticTouchable
                  style={s.primaryBtn}
                  onPress={() => (r.recommended_resource === 'ask_tutor' ? onAskTutor(r.concept_name || r.concept_id) : onOpenTopic(r.concept_name || r.concept_id))}
                  haptic="light"
                >
                  <Text style={s.primaryBtnText}>{RESOURCE_LABELS[r.recommended_resource] || 'Practice'}</Text>
                </HapticTouchable>
              </View>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>weekly activity</Text>
            {weekly.length === 0 ? <Text style={s.muted}>No activity data.</Text> : (
              <View style={s.bars}>
                {weekly.map((d) => {
                  const v = d.interactions || 0;
                  return (
                    <View key={d.date} style={s.barCol}>
                      <Text style={s.barValue}>{v > 0 ? v : ''}</Text>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { height: `${Math.max(v > 0 ? 6 : 0, (v / maxWeekly) * 100)}%` }]} />
                      </View>
                      <Text style={s.barLabel}>{String(d.date).slice(5)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {tab === 'heatmap' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>concept mastery heatmap</Text>
          <View style={s.legend}>
            {([['deep_red', '<30%'], ['orange', '30–50%'], ['yellow', '50–70%'], ['light_green', '70–85%'], ['bright_green', '85%+']] as [string, string][]).map(([color, label]) => (
              <View key={color} style={s.legendItem}>
                <View style={[s.legendSwatch, { backgroundColor: MASTERY_COLORS[color] }]} />
                <Text style={s.muted}>{label}</Text>
              </View>
            ))}
          </View>
          {heatmap.length === 0 ? <Text style={s.muted}>No concepts tracked yet.</Text> : (
            <View style={s.heatGrid}>
              {heatmap.map((node, i) => (
                <HapticTouchable
                  key={node.concept_id || i}
                  style={[s.heatNode, { backgroundColor: MASTERY_COLORS[node.color || ''] || masteryColor(node.p_mastery) }]}
                  onPress={() => onAskTutor(node.concept_name || node.concept_id)}
                  haptic="selection"
                >
                  <Text style={s.heatLabel} numberOfLines={2}>{(node.concept_name || node.concept_id).substring(0, 24)}</Text>
                  <Text style={s.heatPct}>{Math.round((node.p_mastery || 0) * 100)}%</Text>
                </HapticTouchable>
              ))}
            </View>
          )}
        </View>
      )}

      {tab === 'charts' && (
        <>
          <View style={s.card} onLayout={(e) => setChartWidth(Math.max(200, e.nativeEvent.layout.width - 32))}>
            <Text style={s.cardTitle}>mastery over time (30 days)</Text>
            {masteryOverTime.length === 0 ? <Text style={s.muted}>No trend data yet.</Text> : (
              <LineChart data={masteryOverTime} width={chartWidth} color={selectedTheme.accentHover} grid={rgbaFromHex(selectedTheme.textSecondary, 0.2)} label={selectedTheme.textSecondary} />
            )}
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>performance stats</Text>
            {([
              ['weakest subject', stats.weakest_subject || 'N/A'],
              ['strongest subject', stats.strongest_subject || 'N/A'],
              ['avg session', `${stats.avg_session_length_min || 0} min`],
              ['improvement rate', `${(stats.improvement_rate || 0) > 0 ? '+' : ''}${((stats.improvement_rate || 0) * 100).toFixed(1)}%/session`],
            ] as [string, string][]).map(([label, value]) => (
              <View key={label} style={s.perfRow}>
                <Text style={s.muted}>{label}</Text>
                <Text style={s.perfValue} numberOfLines={1}>{value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {tab === 'badges' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>badges earned ({earned.length})</Text>
          <View style={s.badgeGrid}>
            {earned.map((b) => (
              <View key={b.badge_id} style={s.badge}>
                <Text style={s.badgeIcon}>{b.icon || '🏅'}</Text>
                <Text style={s.badgeName} numberOfLines={2}>{b.name}</Text>
              </View>
            ))}
            {earned.length === 0 ? <Text style={s.muted}>None yet.</Text> : null}
          </View>
          {locked.length > 0 && (
            <>
              <Text style={[s.cardTitle, { marginTop: 12 }]}>locked ({locked.length})</Text>
              <View style={s.badgeGrid}>
                {locked.slice(0, 8).map((b) => (
                  <View key={b.badge_id} style={[s.badge, { opacity: 0.6 }]}>
                    <Text style={s.badgeIcon}>🔒</Text>
                    <Text style={s.badgeName} numberOfLines={2}>{b.name}</Text>
                    {b.description ? <Text style={s.badgeDesc} numberOfLines={3}>{b.description}</Text> : null}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function MasteryBar({ value, styles }: { value: number; styles: ReturnType<typeof createStyles> }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <View style={styles.masteryWrap}>
      <View style={styles.masteryTrack}><View style={[styles.masteryFill, { width: `${pct}%`, backgroundColor: masteryColor(value) }]} /></View>
      <Text style={styles.masteryPct}>{pct}%</Text>
    </View>
  );
}

function LineChart({ data, width, color, grid, label }: { data: { date: string; avg_p_mastery: number }[]; width: number; color: string; grid: string; label: string }) {
  const height = 190;
  const pad = { top: 10, right: 8, bottom: 26, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const toX = (i: number) => pad.left + (i / (data.length - 1 || 1)) * innerW;
  const toY = (v: number) => pad.top + innerH - Math.max(0, Math.min(1, v)) * innerH;
  const points = data.map((d, i) => `${toX(i)},${toY(d.avg_p_mastery || 0)}`).join(' ');
  const every = Math.ceil(data.length / 5);
  return (
    <Svg width={width} height={height}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <Line key={v} x1={pad.left} x2={width - pad.right} y1={toY(v)} y2={toY(v)} stroke={grid} strokeWidth={1} />
      ))}
      {[0, 0.5, 1].map((v) => (
        <SvgText key={`t${v}`} x={pad.left - 5} y={toY(v) + 3} fontSize={9} fill={label} textAnchor="end">{`${Math.round(v * 100)}%`}</SvgText>
      ))}
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => (
        <Circle key={d.date} cx={toX(i)} cy={toY(d.avg_p_mastery || 0)} r={2.5} fill={color} />
      ))}
      {data.map((d, i) => (i % every === 0 ? (
        <SvgText key={`l${d.date}`} x={toX(i)} y={height - 8} fontSize={9} fill={label} textAnchor="middle">{String(d.date).slice(5)}</SvgText>
      ) : null))}
    </Svg>
  );
}

// No BKT concept profile yet: show the live weakness-score signals instead,
// like the web IntelligenceFallback.
function Fallback({ areas, styles, onOpenTopic }: { areas: WeakArea[]; styles: ReturnType<typeof createStyles>; onOpenTopic: (topic: string) => void }) {
  const signals = areas.filter((a) => String(a.topic || '').trim()).slice(0, 3);
  const attempts = areas.reduce((sum, a) => sum + (Number(a.total_attempts) || 0), 0);
  const wrong = areas.reduce((sum, a) => sum + (Number(a.total_wrong) || 0), 0);
  const critical = areas.filter((a) => a.category === 'critical').length;
  const practice = areas.filter((a) => a.category === 'needs_practice').length;
  const label = (a: WeakArea) => a.label || a.topic;

  if (!areas.length) {
    return (
      <View style={[styles.card, { alignItems: 'center', paddingVertical: 40 }]}>
        <Text style={styles.cardTitle}>building your pattern map</Text>
        <Text style={styles.bigTitle}>Keep learning to unlock intelligence.</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>Cerbyl needs a few more answered questions before it can identify reliable learning patterns.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>live diagnosis signals</Text>
        <Text style={styles.bigTitle}>Your pattern profile is taking shape.</Text>
        <Text style={styles.muted}>These signals are already strong enough to guide your next recovery session. Deeper trend analysis appears as your study history grows.</Text>
        {signals[0] ? (
          <HapticTouchable style={[styles.primaryBtn, { alignSelf: 'flex-start', marginTop: 6 }]} onPress={() => onOpenTopic(label(signals[0]))} haptic="light">
            <Text style={styles.primaryBtnText}>practice priority gaps</Text>
          </HapticTouchable>
        ) : null}
      </View>
      <View style={styles.statsGrid}>
        {([['active signals', areas.length], ['critical gaps', critical], ['needs practice', practice], ['attempts', attempts]] as [string, number][]).map(([l, v]) => (
          <View key={l} style={styles.statCell}>
            <Text style={styles.statLabel}>{l}</Text>
            <Text style={styles.statValue}>{v}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.conceptHead}>
          <Text style={styles.cardTitle}>strongest current signals</Text>
          <Text style={styles.muted}>{wrong} missed</Text>
        </View>
        {signals.map((a, i) => (
          <HapticTouchable key={`${a.topic}-${i}`} style={styles.recRow} onPress={() => onOpenTopic(label(a))} haptic="selection">
            <Text style={styles.recRank}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.conceptName} numberOfLines={1}>{label(a)}</Text>
              <Text style={styles.muted} numberOfLines={2}>{a.total_attempts || 0} attempts have flagged this topic for focused recovery.</Text>
            </View>
            <Text style={styles.perfValue}>{Math.round(a.accuracy || 0)}%</Text>
          </HapticTouchable>
        ))}
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  const border = rgbaFromHex(theme.accentHover, theme.isLight ? 0.18 : 0.2);
  const accentInk = theme.isLight ? darkenColor(theme.accent, 38) : theme.bgPrimary;
  return StyleSheet.create({
    center: { paddingVertical: 70, alignItems: 'center', gap: 14 },
    muted: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 11, lineHeight: 16 },
    card: { borderRadius: 20, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(theme.panel, 0.82), padding: 16, gap: 10, boxShadow: cbTileShadow(0.06) } as ViewStyle,
    cardTitle: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase' },
    bigTitle: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 18, textAlign: 'left' },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: rgbaFromHex(theme.warning, 0.4), backgroundColor: rgbaFromHex(theme.warning, 0.08), padding: 12 },
    bannerText: { flex: 1, fontFamily: 'Inter_600SemiBold', color: theme.textPrimary, fontSize: 11.5 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCell: { flexGrow: 1, flexBasis: '30%', borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(theme.panel, 0.82), paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
    statLabel: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase' },
    statValue: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 17 },
    tabs: { flexDirection: 'row', gap: 6 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: border },
    tabActive: { backgroundColor: theme.accentHover, borderColor: theme.accentHover },
    tabText: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
    tabTextActive: { color: accentInk },
    conceptRow: { gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: border },
    conceptHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    conceptName: { flex: 1, fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 13 },
    trend: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 14 },
    evidence: { fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: theme.textSecondary, fontSize: 11, lineHeight: 16 },
    conceptFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    masteryWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    masteryTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: rgbaFromHex(theme.textSecondary, 0.15) },
    masteryFill: { height: '100%', borderRadius: 3 },
    masteryPct: { fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 11, minWidth: 34, textAlign: 'right' },
    recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: border },
    recRank: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 15, minWidth: 22 },
    primaryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.accentHover },
    primaryBtnText: { fontFamily: 'Inter_700Bold', color: accentInk, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
    ghostBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: border },
    ghostBtnText: { fontFamily: 'Inter_700Bold', color: theme.accentHover, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 140 },
    barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
    barValue: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 9, height: 12 },
    barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 4, backgroundColor: theme.accentHover, opacity: 0.85 },
    barLabel: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 9 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendSwatch: { width: 10, height: 10, borderRadius: 2 },
    heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    heatNode: { flexBasis: '30%', flexGrow: 1, minHeight: 64, borderRadius: 12, padding: 8, justifyContent: 'space-between' },
    heatLabel: { fontFamily: 'Inter_700Bold', color: '#111111', fontSize: 10.5 },
    heatPct: { fontFamily: 'Inter_900Black', color: '#111111', fontSize: 13 },
    perfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: border },
    perfValue: { flexShrink: 1, fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 12 },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 4, borderRadius: 14, borderWidth: 1, borderColor: border, padding: 10 },
    badgeIcon: { fontSize: 22 },
    badgeName: { fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 10.5, textAlign: 'center' },
    badgeDesc: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 9.5, textAlign: 'center' },
  });
}
