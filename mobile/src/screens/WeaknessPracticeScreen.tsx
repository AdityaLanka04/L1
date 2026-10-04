import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import {
  getRecentMistakes, explainMistake, getWeakAreas, getStudyActivityFeed,
  RecentMistake, RecentMistakeSource, WeakArea, StudyActivity,
} from '../services/api';
import GeoBackground from '../components/GeoBackground';
import HapticTouchable from '../components/HapticTouchable';
import PulseCubes from '../components/PulseCubes';
import MathText from '../components/MathText';
import MarkdownText from '../components/MarkdownText';
import WeaknessIntelligence from '../components/WeaknessIntelligence';
import { cbTileShadow, cbTileBorder } from '../components/NeumorphicTexture';
import SectionSidebar, { SidebarItem } from '../components/SectionSidebar';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { MissedCardsDeck } from './FlashcardsScreen';
import type { SoloQuizAutoStart } from './social/SoloQuizScreen';

// Where weakness screens send the student next (wired in TabNavigator).
export type WeaknessLinks = {
  openTopic: (topic: string) => void;
  quiz: (autoStart: SoloQuizAutoStart) => void;
  askChat: (prompt: string) => void;
  reviewCards: (deck: MissedCardsDeck) => void;
  flashcards: () => void;
  topicsHub: () => void;
  rlInsights: () => void;
};

type Props = { user: AuthUser; onBack: () => void; links: WeaknessLinks };
type View_ = 'weak-areas' | 'intelligence' | 'activity';

// Topic mastery and How I learn are their own screens on mobile.
const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'weak-areas', label: 'Priority diagnosis' },
  { key: 'topics-hub', label: 'Topic mastery' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'how-i-learn', label: 'How I learn' },
  { key: 'activity', label: 'Activity' },
];

const VIEW_TITLES: Record<View_, string> = {
  'weak-areas': 'weak areas',
  intelligence: 'insights',
  activity: 'activity',
};

const SCORE_SOURCE_LABELS: Record<string, string> = { flashcard: 'flashcards', quiz: 'quizzes', chat: 'tutor chat' };
const TREND_LABELS: Record<string, string> = { improving: 'improving', slipping: 'slipping', steady: 'holding steady' };

const MISTAKE_SOURCE_META: Record<RecentMistakeSource, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  question_bank: { label: 'Practice', icon: 'book-outline' },
  solo_quiz: { label: 'Quiz', icon: 'book-outline' },
  flashcard: { label: 'Flashcard', icon: 'layers-outline' },
  chat: { label: 'AI Chat', icon: 'chatbubble-ellipses-outline' },
};

const ACTIVITY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  chat: 'chatbubble-ellipses-outline',
  note: 'document-text-outline',
  flashcard: 'layers-outline',
  quiz: 'checkmark-circle-outline',
  weak_area: 'locate-outline',
};

function normalizeTopicKey(topic: string | null | undefined): string {
  return String(topic || '').trim().toLowerCase();
}

function displayTopic(topic: string | null | undefined): string {
  const normalized = String(topic || '').trim();
  if (!normalized || ['none', 'null'].includes(normalized.toLowerCase())) return 'Unclassified concept';
  // Set titles carry a source prefix ("Flashcards: Implicit differentiation").
  return normalized.replace(/^(flashcards?|ai generated|quiz)\s*:\s*/i, '') || normalized;
}

function scoreOf(area: WeakArea) {
  return Math.max(0, Math.min(100, Math.round(area.weakness_score || 0)));
}

function scoreTone(score: number): 'critical' | 'practice' | 'improving' {
  return score >= 70 ? 'critical' : score >= 40 ? 'practice' : 'improving';
}

type NextAction = { key: string; label: string; run: () => void };

// What to do next for one weak topic, from its score and which mistakes are
// still open -- same rules as the web Weak Areas page.
function topicNextSteps(
  area: WeakArea,
  label: string,
  openMistakes: RecentMistake[],
  fixedCount: number,
  links: WeaknessLinks,
): { headline: string; actions: NextAction[] } {
  const score = Math.round(area.weakness_score || 0);
  const sources = area.sources || [];
  const openCardMistakes = openMistakes.filter((m) => m.source === 'flashcard');
  const openCards = openCardMistakes.length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  let headline: string;
  if (openMistakes.length === 0 && fixedCount > 0) {
    headline = score < 40
      ? `You've fixed all ${plural(fixedCount, 'mistake')} here. A quick quiz will confirm it sticks.`
      : `You've fixed the ${plural(fixedCount, 'mistake')} you made, but the model wants more evidence before it trusts this topic. Test yourself on new questions.`;
  } else if (score >= 70) {
    headline = openMistakes.length
      ? `Priority topic. Start with the ${plural(openMistakes.length, 'mistake')} you haven't fixed yet, then get it explained step by step.`
      : 'Priority topic. Get it explained step by step, then test yourself.';
  } else if (score >= 40) {
    headline = openMistakes.length
      ? `Partly there. Clear the ${plural(openMistakes.length, 'open mistake')}, then a short quiz will show whether it's sticking.`
      : "Partly there. A short quiz will show whether it's sticking.";
  } else {
    headline = 'Nearly mastered. Keep it fresh with a quick review every few days.';
  }
  if (area.trend === 'slipping' && score >= 40) headline += ' Your recent answers are trending the wrong way.';

  const actions: NextAction[] = [];
  if (openCards > 0) {
    const seen = new Set<number>();
    const cards = openCardMistakes
      .filter((m) => m.flashcard_id && !seen.has(m.flashcard_id) && seen.add(m.flashcard_id))
      .map((m) => ({ id: m.flashcard_id as number, question: m.question_text, answer: m.correct_answer || '' }));
    actions.push({
      key: 'cards',
      label: `Review ${plural(openCards, 'missed card')}`,
      run: () => (cards.length ? links.reviewCards({ title: `Review: ${label}`, cards }) : links.flashcards()),
    });
  }
  if (score >= 40 || !sources.includes('quiz')) {
    actions.push({
      key: 'quiz',
      label: 'Quiz me on it',
      run: () => links.quiz({ topic: label, difficulty: score >= 70 ? 'easy' : 'medium', questionCount: 5 }),
    });
  }
  if (score >= 40) {
    actions.push({
      key: 'chat',
      label: 'Explain it in AI Chat',
      run: () => links.askChat(`Help me with ${label}. I keep getting it wrong, so walk me through it step by step and check my understanding.`),
    });
  }
  return { headline, actions: actions.slice(0, 3) };
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function WeaknessPracticeScreen({ user, onBack, links }: Props) {
  const { selectedTheme } = useAppTheme();
  const layout = useResponsiveLayout();
  const s = useMemo(() => createStyles(selectedTheme, layout), [selectedTheme, layout]);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black });
  const [activeView, setActiveView] = useState<View_>('weak-areas');
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');

  const [areas, setAreas] = useState<WeakArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasFailed, setAreasFailed] = useState(false);
  const [mistakes, setMistakes] = useState<RecentMistake[]>([]);
  const [mistakesLoading, setMistakesLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFixed, setShowFixed] = useState<Set<string>>(new Set());
  const [explainModal, setExplainModal] = useState<{ mistake: RecentMistake; loading: boolean; content: string; error: string } | null>(null);

  const [activity, setActivity] = useState<StudyActivity[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [intelligenceKey, setIntelligenceKey] = useState(0);

  const loadWeakAreas = useCallback(async () => {
    if (!user.username) { setAreasLoading(false); return; }
    setAreasLoading(true);
    setAreasFailed(false);
    try {
      const data = await getWeakAreas(user.username);
      const groups = data.weak_areas || {};
      setAreas([...(groups.critical || []), ...(groups.needs_practice || []), ...(groups.improving || [])]);
    } catch (e) {
      setAreasFailed(true);
      setError(e instanceof Error ? e.message : 'Your diagnosis could not be refreshed.');
    } finally {
      setAreasLoading(false);
    }
  }, [user.username]);

  const loadMistakes = useCallback(async () => {
    if (!user.username) { setMistakesLoading(false); return; }
    setMistakesLoading(true);
    try {
      const data = await getRecentMistakes(user.username, 40);
      setMistakes(data.mistakes || []);
    } catch (e) {
      setMistakes([]);
      setError(e instanceof Error ? e.message : 'Your recent mistakes could not be loaded.');
    } finally {
      setMistakesLoading(false);
    }
  }, [user.username]);

  const loadActivity = useCallback(async () => {
    if (!user.username) return;
    setActivityLoading(true);
    try {
      const data = await getStudyActivityFeed(user.username);
      setActivity(data.activities || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recent learning activity is unavailable right now.');
    } finally {
      setActivityLoading(false);
    }
  }, [user.username]);

  useEffect(() => {
    loadWeakAreas();
    loadMistakes();
  }, [loadWeakAreas, loadMistakes]);

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    if (activeView === 'weak-areas') await Promise.all([loadWeakAreas(), loadMistakes()]);
    else if (activeView === 'activity') await loadActivity();
    else setIntelligenceKey((k) => k + 1);
    setRefreshing(false);
  };

  const selectSection = (key: string) => {
    setSidebarOpen(false);
    setError('');
    if (key === 'topics-hub') { links.topicsHub(); return; }
    if (key === 'how-i-learn') { links.rlInsights(); return; }
    setActiveView(key as View_);
    if (key === 'activity' && !activity) loadActivity();
  };

  const openExplain = async (mistake: RecentMistake) => {
    setExplainModal({ mistake, loading: true, content: '', error: '' });
    try {
      const data = await explainMistake(user.username, mistake.id, mistake.source);
      setExplainModal({ mistake, loading: false, content: data.content, error: '' });
    } catch (e) {
      setExplainModal({ mistake, loading: false, content: '', error: e instanceof Error ? e.message : 'Could not generate an explanation.' });
    }
  };

  const toggleSet = (setter: typeof setExpanded, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const mistakesByTopic = useMemo(() => {
    const map = new Map<string, RecentMistake[]>();
    mistakes.forEach((mistake) => {
      const key = normalizeTopicKey(mistake.topic);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(mistake);
    });
    return map;
  }, [mistakes]);

  const counts = useMemo(() => ({
    critical: areas.filter((a) => a.category === 'critical').length,
    practice: areas.filter((a) => a.category === 'needs_practice').length,
    improving: areas.filter((a) => a.category === 'improving').length,
    attempts: areas.reduce((sum, a) => sum + (a.total_attempts || 0), 0),
  }), [areas]);

  const priorityFocus = areas.find((a) => {
    const t = normalizeTopicKey(a.topic);
    return t && t !== 'none' && t !== 'null';
  }) || areas[0];

  if (!fontsLoaded) return null;

  const loadingDiagnosis = areasLoading || mistakesLoading;

  const renderMistake = (mistake: RecentMistake) => {
    const meta = MISTAKE_SOURCE_META[mistake.source] || { label: mistake.source, icon: 'help-circle-outline' as const };
    return (
      <HapticTouchable key={`${mistake.source}-${mistake.id}`} style={s.mistakeRow} onPress={() => openExplain(mistake)} haptic="selection">
        <View style={[s.mistakeIcon, mistake.resolved && s.mistakeIconFixed]}>
          <Ionicons name={mistake.resolved ? 'checkmark-circle-outline' : meta.icon} size={14} color={mistake.resolved ? selectedTheme.success : selectedTheme.accentHover} />
        </View>
        <View style={{ flex: 1 }}>
          <MathText style={[s.mistakeText, mistake.resolved && s.mistakeTextFixed]} numberOfLines={2}>{mistake.question_text || ''}</MathText>
        </View>
        <Ionicons name="chevron-forward" size={15} color={selectedTheme.textSecondary} />
      </HapticTouchable>
    );
  };

  const renderDiagnosis = () => {
    if (loadingDiagnosis) return <Loading label="analyzing your performance" styles={s} color={selectedTheme.accent} />;
    if (areasFailed && !areas.length) {
      return <EmptyState icon="alert-circle-outline" title="we could not read your diagnosis" copy="Your existing learning data has not been replaced or cleared. Pull to retry." styles={s} />;
    }
    if (!areas.length) {
      return <EmptyState icon="checkmark-circle-outline" title="no weak topics detected" copy="Your tracked topics are holding steady. Keep studying to give Cerbyl more evidence." styles={s} />;
    }
    return (
      <>
        <View style={s.queueHead}>
          <Text style={s.sectionTitle}>weak topics</Text>
          <Text style={s.queueMeta}>{areas.length} tracked · ranked by weakness score</Text>
        </View>
        <Text style={s.explainer}>
          <Text style={s.explainerStrong}>Weakness score</Text> (0–100, higher is weaker) is how unlikely it is that you've mastered a topic.
          A knowledge-tracing model updates it after every graded flashcard, quiz, practice question and tutor answer,
          trusting quiz and tutor-checked answers more than self-graded flashcards and hard questions more than easy ones.
          It's balanced against your full history so one lucky streak can't hide a pattern, and it creeps back up as time
          passes without practice. The AI tutor and note generator see the same number.
        </Text>
        <View style={s.listCard}>
          {areas.map((area) => {
            const key = normalizeTopicKey(area.topic);
            const isOpen = expanded.has(key);
            const topicMistakes = mistakesByTopic.get(key) || [];
            const score = scoreOf(area);
            const tone = scoreTone(score);
            const toneColor = tone === 'critical' ? selectedTheme.danger : tone === 'practice' ? selectedTheme.warning : selectedTheme.success;
            const attempts = area.total_attempts || 0;
            const correct = Math.max(0, attempts - (area.total_wrong || 0));
            const sources = (area.sources || []).map((src) => SCORE_SOURCE_LABELS[src] || src).join(', ');
            const label = area.label || displayTopic(area.topic);
            const meta = [
              `${correct}/${attempts} correct${sources ? ` · ${sources}` : ''}`,
              area.score_model === 'bkt' ? `model mastery ${Math.round((area.mastery || 0) * 100)}%` : '',
              area.confidence ? `${area.confidence} confidence` : '',
              area.trend && TREND_LABELS[area.trend] ? TREND_LABELS[area.trend] : '',
            ].filter(Boolean).join(' · ');
            const openMistakes = topicMistakes.filter((m) => !m.resolved);
            const fixedMistakes = topicMistakes.filter((m) => m.resolved);
            const plan = isOpen ? topicNextSteps(area, label, openMistakes, fixedMistakes.length, links) : null;
            const fixedVisible = showFixed.has(key);
            return (
              <View key={key}>
                <HapticTouchable style={s.topicRow} onPress={() => toggleSet(setExpanded, key)} haptic="selection" accessibilityLabel={`${label}, weakness ${score} of 100`}>
                  <View style={s.topicBody}>
                    <Text style={s.topicTitle} numberOfLines={2}>{label}</Text>
                    <View style={s.topicTrack}><View style={[s.topicFill, { width: `${Math.max(3, score)}%`, backgroundColor: toneColor }]} /></View>
                    <Text style={s.topicMeta} numberOfLines={2}>{meta}</Text>
                  </View>
                  <View style={s.scoreBox}>
                    <Text style={[s.scoreValue, { color: toneColor }]}>{score}</Text>
                    <Text style={s.scoreUnit}>/100 weak</Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={17} color={selectedTheme.textSecondary} />
                </HapticTouchable>

                {isOpen && plan && (
                  <View style={s.topicMistakes}>
                    <View style={s.nextStep}>
                      <Text style={s.nextStepKicker}>next step</Text>
                      <Text style={s.nextStepText}>{plan.headline}</Text>
                      <View style={s.nextStepActions}>
                        {plan.actions.map((action) => (
                          <HapticTouchable key={action.key} style={s.nextStepBtn} onPress={action.run} haptic="light">
                            <Text style={s.nextStepBtnText}>{action.label}</Text>
                          </HapticTouchable>
                        ))}
                        <HapticTouchable style={[s.nextStepBtn, s.nextStepBtnGhost]} onPress={() => links.openTopic(label)} haptic="light">
                          <Text style={[s.nextStepBtnText, s.nextStepBtnGhostText]}>Topic tips</Text>
                        </HapticTouchable>
                      </View>
                    </View>

                    <Text style={s.groupLabel}>{openMistakes.length ? `still missing · ${openMistakes.length}` : 'no open mistakes'}</Text>
                    {openMistakes.length === 0 ? (
                      <Text style={s.emptyInline}>
                        {fixedMistakes.length ? 'Every mistake on this topic has since been answered correctly.' : 'No recorded mistakes for this topic yet.'}
                      </Text>
                    ) : openMistakes.map(renderMistake)}

                    {fixedMistakes.length > 0 && (
                      <>
                        <HapticTouchable style={s.fixedToggle} onPress={() => toggleSet(setShowFixed, key)} haptic="selection">
                          <Ionicons name={fixedVisible ? 'chevron-down' : 'chevron-forward'} size={13} color={selectedTheme.textSecondary} />
                          <Text style={s.fixedToggleText}>fixed since · {fixedMistakes.length}</Text>
                        </HapticTouchable>
                        {fixedVisible && fixedMistakes.map(renderMistake)}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </>
    );
  };

  const renderActivity = () => {
    if (activityLoading) return <Loading label="loading recent activity" styles={s} color={selectedTheme.accent} />;
    if (!activity?.length) {
      return <EmptyState icon="pulse-outline" title="no learning activity yet" copy="Your study actions will appear here as evidence for future diagnoses." styles={s} />;
    }
    return (
      <>
        <View style={s.queueHead}>
          <Text style={s.sectionTitle}>recent evidence</Text>
          <Text style={s.queueMeta}>{activity.length} events</Text>
        </View>
        <View style={s.listCard}>
          {activity.map((item, index) => (
            <View key={`${item.ts}-${index}`} style={s.activityRow}>
              <View style={s.mistakeIcon}><Ionicons name={ACTIVITY_ICONS[item.type] || 'pulse-outline'} size={14} color={selectedTheme.accentHover} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.activityTitle} numberOfLines={1}>{item.topic || 'Learning activity'}</Text>
                <Text style={s.activityDetail} numberOfLines={1}>{item.detail || item.type}</Text>
              </View>
              <Text style={s.activityTime}>{formatTimestamp(item.ts)}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  const total = areas.length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
      <GeoBackground />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={selectedTheme.accent} />}
      >
        <View style={s.header}>
          <HapticTouchable onPress={onBack} haptic="selection" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={selectedTheme.accentHover} />
          </HapticTouchable>
          <Text style={s.title}>{VIEW_TITLES[activeView]}</Text>
          <HapticTouchable onPress={() => setSidebarOpen(true)} haptic="selection" accessibilityLabel="Open menu">
            <Ionicons name="menu-outline" size={24} color={selectedTheme.accentHover} />
          </HapticTouchable>
        </View>

        {!user.username ? (
          <EmptyState icon="person-circle-outline" title="reload your session" copy="Your account needs to refresh before weaknesses can load." styles={s} />
        ) : (
          <>
            {activeView === 'weak-areas' && total > 0 && !loadingDiagnosis ? (
              <View style={s.signalCard}>
                <View style={s.signalTop}>
                  <View>
                    <Text style={s.signalKicker}>current diagnosis</Text>
                    <Text style={s.signalValue}>{total} <Text style={s.signalUnit}>signals · {counts.attempts} attempts</Text></Text>
                  </View>
                  <HapticTouchable
                    style={[s.practiceBtn, !priorityFocus && { opacity: 0.5 }]}
                    onPress={() => priorityFocus && links.openTopic(priorityFocus.label || displayTopic(priorityFocus.topic))}
                    disabled={!priorityFocus}
                    haptic="medium"
                  >
                    <Ionicons name="play" size={13} color={s.accentInk.color} />
                    <Text style={s.practiceBtnText}>practice now</Text>
                  </HapticTouchable>
                </View>
                <View style={s.signalTrack}>
                  <View style={{ flex: counts.critical || 0.001, backgroundColor: selectedTheme.danger }} />
                  <View style={{ flex: counts.practice || 0.001, backgroundColor: selectedTheme.warning }} />
                  <View style={{ flex: counts.improving || 0.001, backgroundColor: selectedTheme.success }} />
                </View>
                <View style={s.signalLegend}>
                  <Text style={s.signalLegendText}>critical <Text style={s.signalLegendNum}>{counts.critical}</Text></Text>
                  <Text style={s.signalLegendText}>practice <Text style={s.signalLegendNum}>{counts.practice}</Text></Text>
                  <Text style={s.signalLegendText}>improving <Text style={s.signalLegendNum}>{counts.improving}</Text></Text>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={s.errorBar}>
                <Ionicons name="alert-circle-outline" size={15} color={selectedTheme.danger} />
                <Text style={s.errorText} numberOfLines={2}>{error}</Text>
                <HapticTouchable onPress={() => setError('')} haptic="light" accessibilityLabel="Dismiss error">
                  <Ionicons name="close" size={15} color={selectedTheme.textSecondary} />
                </HapticTouchable>
              </View>
            ) : null}

            {activeView === 'weak-areas' && renderDiagnosis()}
            {activeView === 'activity' && renderActivity()}
            {activeView === 'intelligence' && (
              <WeaknessIntelligence
                key={intelligenceKey}
                user={user}
                areas={areas}
                onOpenTopic={links.openTopic}
                onAskTutor={(concept) => links.askChat(`Help me understand ${concept}. Walk me through it step by step and check my understanding.`)}
              />
            )}
          </>
        )}
      </ScrollView>

      <SectionSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pageTitle="weak areas"
        items={SIDEBAR_ITEMS.map((item) => (item.key === 'weak-areas' && total ? { ...item, badge: total } : item))}
        activeKey={activeView}
        onSelect={selectSection}
      />

      <Modal visible={!!explainModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExplainModal(null)}>
        <View style={s.modalRoot}>
          <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{explainModal ? displayTopic(explainModal.mistake.topic) : ''}</Text>
            <HapticTouchable onPress={() => setExplainModal(null)} haptic="light" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={selectedTheme.accent} />
            </HapticTouchable>
          </View>
          {explainModal && (
            <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={s.modalSource}>
                {(MISTAKE_SOURCE_META[explainModal.mistake.source]?.label || explainModal.mistake.source)}
                {explainModal.mistake.resolved ? ' · fixed since' : ''}
              </Text>
              <MathText style={s.modalQuestion}>{explainModal.mistake.question_text || ''}</MathText>
              {!!explainModal.mistake.user_answer && (
                <View style={s.modalAnswers}>
                  <View style={s.modalAnswerCol}>
                    <Text style={s.modalAnswerLabel}>your answer</Text>
                    <MathText style={s.modalAnswerValue}>{explainModal.mistake.user_answer}</MathText>
                  </View>
                  {!!explainModal.mistake.correct_answer && (
                    <View style={s.modalAnswerCol}>
                      <Text style={s.modalAnswerLabel}>correct answer</Text>
                      <MathText style={s.modalAnswerValue}>{explainModal.mistake.correct_answer}</MathText>
                    </View>
                  )}
                </View>
              )}
              {explainModal.loading ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}><PulseCubes color={selectedTheme.accent} size={13} /></View>
              ) : explainModal.error ? (
                <Text style={s.modalError}>{explainModal.error}</Text>
              ) : (
                <MarkdownText>{explainModal.content}</MarkdownText>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Loading({ label, styles, color }: { label: string; styles: ReturnType<typeof createStyles>; color: string }) {
  return (
    <View style={{ paddingVertical: 70, alignItems: 'center', gap: 14 }}>
      <PulseCubes color={color} size={14} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, copy, styles }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; copy: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={styles.iconColor.color} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{copy}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme'], layout: ReturnType<typeof useResponsiveLayout>) {
  const surface = theme.panel;
  const border = rgbaFromHex(theme.accentHover, theme.isLight ? 0.18 : 0.2);
  const accentInk = theme.isLight ? darkenColor(theme.accent, 38) : theme.bgPrimary;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bgPrimary },
    scroll: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 10, paddingBottom: 110, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 18, paddingBottom: 12 },
    title: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 26, letterSpacing: -0.6 },
    sectionTitle: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginLeft: 2 },

    signalCard: { borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(surface, 0.82), padding: 16, gap: 12, boxShadow: cbTileShadow(0.06) } as ViewStyle,
    signalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    signalKicker: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase' },
    signalValue: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 24, marginTop: 4 },
    signalUnit: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 11 },
    signalTrack: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', gap: 2 },
    signalLegend: { flexDirection: 'row', justifyContent: 'space-between' },
    signalLegendText: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8 },
    signalLegendNum: { fontFamily: 'Inter_900Black', color: theme.textPrimary },
    practiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: theme.accentHover },
    practiceBtnText: { fontFamily: 'Inter_700Bold', color: accentInk, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },

    errorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: rgbaFromHex(theme.danger, 0.35), backgroundColor: rgbaFromHex(theme.danger, 0.08), paddingHorizontal: 12, paddingVertical: 10 },
    errorText: { flex: 1, fontFamily: 'Inter_600SemiBold', color: theme.textPrimary, fontSize: 11.5 },

    queueHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 4 },
    queueMeta: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 10.5 },
    explainer: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 11, lineHeight: 16.5, paddingHorizontal: 4 },
    explainerStrong: { fontFamily: 'Inter_700Bold', color: theme.textPrimary },

    listCard: { borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(surface, 0.82), overflow: 'hidden', boxShadow: cbTileShadow(0.06) } as ViewStyle,

    topicRow: { minHeight: 72, borderBottomWidth: 1, borderBottomColor: border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    topicBody: { flex: 1, gap: 7 },
    topicTitle: { fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 13.5 },
    topicTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: rgbaFromHex(theme.accent, 0.12) },
    topicFill: { height: '100%', borderRadius: 2 },
    topicMeta: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 10.5, lineHeight: 15 },
    scoreBox: { alignItems: 'flex-end', minWidth: 48 },
    scoreValue: { fontFamily: 'Inter_900Black', fontSize: 20, letterSpacing: -0.4 },
    scoreUnit: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.6 },

    topicMistakes: { backgroundColor: rgbaFromHex(theme.textSecondary, 0.05), paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: border, gap: 2 },
    nextStep: { borderRadius: 14, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(surface, 0.7), padding: 12, gap: 8, marginBottom: 8 },
    nextStepKicker: { fontFamily: 'Inter_700Bold', color: theme.accentHover, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase' },
    nextStepText: { fontFamily: 'Inter_400Regular', color: theme.textPrimary, fontSize: 12, lineHeight: 18 },
    nextStepActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    nextStepBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.accentHover },
    nextStepBtnText: { fontFamily: 'Inter_700Bold', color: accentInk, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
    nextStepBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: border },
    nextStepBtnGhostText: { color: theme.accentHover },
    groupLabel: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4, marginBottom: 2 },
    fixedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    fixedToggleText: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase' },
    mistakeRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    mistakeIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: rgbaFromHex(theme.accent, 0.12), alignItems: 'center', justifyContent: 'center' },
    mistakeIconFixed: { backgroundColor: rgbaFromHex(theme.success, 0.12) },
    mistakeText: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 11.5 },
    mistakeTextFixed: { opacity: 0.7 },

    activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: border },
    activityTitle: { fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 12.5 },
    activityDetail: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 10.5, marginTop: 2 },
    activityTime: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 10 },

    empty: { borderRadius: 24, backgroundColor: rgbaFromHex(surface, 0.82), alignItems: 'center', paddingVertical: 54, paddingHorizontal: 24, gap: 9, overflow: 'hidden', boxShadow: cbTileShadow(0.06), ...cbTileBorder(0.14) },
    emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: rgbaFromHex(theme.accent, 0.12), alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 21, textAlign: 'center' },
    emptyText: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
    emptyInline: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 11, paddingVertical: 10 },
    iconColor: { color: theme.accentHover },

    modalRoot: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
    modalTitle: { flex: 1, fontFamily: 'Inter_900Black', fontSize: 20, color: theme.accentHover },
    modalBody: { paddingHorizontal: 20, paddingBottom: 40, gap: 6 },
    modalSource: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase' },
    modalQuestion: { fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 4 },
    modalAnswers: { flexDirection: 'row', gap: 14, paddingBottom: 14, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: border },
    modalAnswerCol: { flex: 1 },
    modalAnswerLabel: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },
    modalAnswerValue: { fontFamily: 'Inter_600SemiBold', color: theme.textPrimary, fontSize: 12, marginTop: 4 },
    modalError: { fontFamily: 'Inter_400Regular', color: theme.danger, fontSize: 12.5 },
    accentInk: { color: accentInk },
  });
}
