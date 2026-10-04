import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getSimilarQuestions, getTopicSuggestions, SimilarQuestion, TopicSuggestionsResponse } from '../services/api';
import GeoBackground from '../components/GeoBackground';
import HapticTouchable from '../components/HapticTouchable';
import PulseCubes from '../components/PulseCubes';
import MathText from '../components/MathText';
import { cbTileShadow } from '../components/NeumorphicTexture';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { WeaknessLinks } from './WeaknessPracticeScreen';

// One weak topic up close -- mobile counterpart of the web /weakness-tips/:topic
// page: accuracy, AI study recommendations and tips, the questions you missed,
// and a targeted quiz on just this topic.

type Props = { user: AuthUser; topic: string; onBack: () => void; links: WeaknessLinks };
type Difficulty = 'easy' | 'medium' | 'hard';

const PRIORITY_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

function statusBadge(accuracy: number, attempts: number) {
  if (!attempts) return 'not started';
  if (accuracy < 30) return 'critical';
  if (accuracy < 55) return 'needs practice';
  if (accuracy < 75) return 'improving';
  return 'progressing';
}

export default function WeaknessTipsScreen({ user, topic, onBack, links }: Props) {
  const { selectedTheme } = useAppTheme();
  const layout = useResponsiveLayout();
  const s = useMemo(() => createStyles(selectedTheme, layout), [selectedTheme, layout]);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<TopicSuggestionsResponse | null>(null);
  const [similar, setSimilar] = useState<{ total_found: number; similar_questions: SimilarQuestion[] } | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const load = useCallback(async () => {
    try {
      const [sug, sim] = await Promise.all([
        getTopicSuggestions(user.username, topic).catch(() => null),
        getSimilarQuestions(user.username, topic).catch(() => null),
      ]);
      setSuggestions(sug);
      setSimilar(sim);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username, topic]);

  useEffect(() => { load(); }, [load]);

  if (!fontsLoaded) return null;

  const accuracy = suggestions?.stats?.accuracy ?? 0;
  const attempts = suggestions?.stats?.attempts ?? 0;
  const pct = Math.min(100, Math.max(0, accuracy));
  const arcColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const hasContent = Boolean(suggestions?.suggestions?.length || similar?.similar_questions?.length);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
      <GeoBackground />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={selectedTheme.accent} />}
      >
        <View style={s.header}>
          <HapticTouchable onPress={onBack} haptic="selection" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={selectedTheme.accentHover} />
          </HapticTouchable>
          <Text style={s.headerTitle}>weak area</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={s.hero}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.kicker}>weakness analysis</Text>
            <Text style={s.topic}>{topic}</Text>
            <View style={s.heroMeta}>
              <View style={s.badge}><Text style={s.badgeText}>{statusBadge(accuracy, attempts)}</Text></View>
              {attempts > 0 ? <Text style={s.muted}>{attempts} attempt{attempts !== 1 ? 's' : ''}</Text> : null}
            </View>
          </View>
          <View style={s.meter}>
            <Svg width={92} height={92} viewBox="0 0 92 92">
              <Circle cx={46} cy={46} r={radius} fill="none" stroke={rgbaFromHex(selectedTheme.textSecondary, 0.15)} strokeWidth={8} />
              <Circle
                cx={46} cy={46} r={radius} fill="none" stroke={arcColor} strokeWidth={8} strokeLinecap="round"
                strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - pct / 100)}
                transform="rotate(-90 46 46)"
              />
            </Svg>
            <View style={s.meterLabel}>
              <Text style={s.meterNum}>{Math.round(pct)}%</Text>
              <Text style={s.meterCaption}>accuracy</Text>
            </View>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.kicker}>targeted practice</Text>
          <Text style={s.cardTitle}>Quiz locked to {topic}</Text>
          <View style={s.genRow}>
            <Text style={s.label}>questions</Text>
            <View style={s.counter}>
              <HapticTouchable style={s.countBtn} onPress={() => setQuestionCount((n) => Math.max(5, n - 5))} disabled={questionCount <= 5} haptic="selection" accessibilityLabel="Fewer questions">
                <Ionicons name="remove" size={16} color={selectedTheme.accentHover} />
              </HapticTouchable>
              <Text style={s.countVal}>{questionCount}</Text>
              <HapticTouchable style={s.countBtn} onPress={() => setQuestionCount((n) => Math.min(20, n + 5))} disabled={questionCount >= 20} haptic="selection" accessibilityLabel="More questions">
                <Ionicons name="add" size={16} color={selectedTheme.accentHover} />
              </HapticTouchable>
            </View>
          </View>
          <View style={s.genRow}>
            <Text style={s.label}>difficulty</Text>
            <View style={s.pills}>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <HapticTouchable key={d} style={[s.pill, difficulty === d && s.pillActive]} onPress={() => setDifficulty(d)} haptic="selection">
                  <Text style={[s.pillText, difficulty === d && s.pillTextActive]}>{d}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>
          <HapticTouchable style={s.primaryBtn} onPress={() => links.quiz({ topic, difficulty, questionCount })} haptic="medium">
            <Text style={s.primaryBtnText}>start practice</Text>
            <Ionicons name="arrow-forward" size={15} color={s.accentInk.color} />
          </HapticTouchable>
          <HapticTouchable
            style={s.ghostBtn}
            onPress={() => links.askChat(`Help me with ${topic}. I keep getting it wrong, so walk me through it step by step and check my understanding.`)}
            haptic="light"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={selectedTheme.accentHover} />
            <Text style={s.ghostBtnText}>explain it in ai chat</Text>
          </HapticTouchable>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 50, alignItems: 'center', gap: 12 }}>
            <PulseCubes color={selectedTheme.accent} size={14} />
            <Text style={s.muted}>building your recommendations</Text>
          </View>
        ) : (
          <>
            {suggestions?.suggestions?.length ? (
              <View style={s.card}>
                <Text style={s.kicker}>personalized</Text>
                <Text style={s.cardTitle}>Study recommendations</Text>
                {suggestions.suggestions.map((item, idx) => {
                  const color = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
                  return (
                    <View key={idx} style={s.recRow}>
                      <View style={[s.recNum, { backgroundColor: color }]}><Text style={s.recNumText}>{idx + 1}</Text></View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.recHead}>
                          <Text style={s.recTitle}>{item.title}</Text>
                          <Text style={[s.recPriority, { color, borderColor: color }]}>{item.priority === 'medium' ? 'med' : item.priority}</Text>
                        </View>
                        <Text style={s.body}>{item.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {suggestions?.study_tips?.length ? (
              <View style={s.card}>
                <Text style={s.kicker}>expert advice</Text>
                <Text style={s.cardTitle}>Study tips</Text>
                {suggestions.study_tips.map((tip, idx) => (
                  <View key={idx} style={s.tipRow}>
                    <Ionicons name="flash-outline" size={13} color={selectedTheme.accentHover} />
                    <Text style={[s.body, { flex: 1 }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {similar?.similar_questions?.length ? (
              <View style={s.card}>
                <Text style={s.kicker}>from your history</Text>
                <Text style={s.cardTitle}>Practice questions · {similar.total_found}</Text>
                {similar.similar_questions.slice(0, 10).map((q, idx) => (
                  <View key={idx} style={s.qCard}>
                    <View style={s.qHead}>
                      <Text style={s.qNum}>Q{idx + 1}</Text>
                      <Text style={s.qDiff}>{q.difficulty}</Text>
                      {q.is_new ? <Text style={s.qNew}>new</Text> : null}
                    </View>
                    <MathText style={s.qText}>{q.question_text}</MathText>
                    {!q.is_new && q.user_answer ? (
                      <View style={{ gap: 2 }}>
                        <Text style={[s.qAnswer, { color: selectedTheme.danger }]}>Your answer: {q.user_answer}</Text>
                        <Text style={[s.qAnswer, { color: selectedTheme.success }]}>Correct: {q.correct_answer}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {!hasContent ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 36 }]}>
                <Ionicons name="bulb-outline" size={30} color={selectedTheme.accentHover} />
                <Text style={s.cardTitle}>No data yet</Text>
                <Text style={[s.muted, { textAlign: 'center' }]}>Keep practicing and we'll generate personalized recommendations.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme'], layout: ReturnType<typeof useResponsiveLayout>) {
  const border = rgbaFromHex(theme.accentHover, theme.isLight ? 0.18 : 0.2);
  const accentInk = theme.isLight ? darkenColor(theme.accent, 38) : theme.bgPrimary;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bgPrimary },
    scroll: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 10, paddingBottom: 110, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 18, paddingBottom: 4 },
    headerTitle: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 22, letterSpacing: -0.5 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(theme.panel, 0.82), padding: 16, boxShadow: cbTileShadow(0.06) } as ViewStyle,
    kicker: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase' },
    topic: { fontFamily: 'Inter_900Black', color: theme.textPrimary, fontSize: 22, letterSpacing: -0.4 },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    badge: { borderRadius: 999, borderWidth: 1, borderColor: border, paddingHorizontal: 9, paddingVertical: 4 },
    badgeText: { fontFamily: 'Inter_700Bold', color: theme.accentHover, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase' },
    meter: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
    meterLabel: { position: 'absolute', alignItems: 'center' },
    meterNum: { fontFamily: 'Inter_900Black', color: theme.textPrimary, fontSize: 18 },
    meterCaption: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase' },
    card: { borderRadius: 20, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(theme.panel, 0.82), padding: 16, gap: 10, boxShadow: cbTileShadow(0.06) } as ViewStyle,
    cardTitle: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 17 },
    muted: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 11.5, lineHeight: 17 },
    body: { fontFamily: 'Inter_400Regular', color: theme.textPrimary, fontSize: 12, lineHeight: 18 },
    label: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
    genRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    countBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center' },
    countVal: { fontFamily: 'Inter_900Black', color: theme.textPrimary, fontSize: 16, minWidth: 24, textAlign: 'center' },
    pills: { flexDirection: 'row', gap: 6 },
    pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: border },
    pillActive: { backgroundColor: theme.accentHover, borderColor: theme.accentHover },
    pillText: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6 },
    pillTextActive: { color: accentInk },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 12, backgroundColor: theme.accentHover, marginTop: 4 },
    primaryBtnText: { fontFamily: 'Inter_700Bold', color: accentInk, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
    ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 11, borderWidth: 1, borderColor: border },
    ghostBtnText: { fontFamily: 'Inter_700Bold', color: theme.accentHover, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
    recRow: { flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: border },
    recNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    recNumText: { fontFamily: 'Inter_900Black', color: '#111111', fontSize: 11 },
    recHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    recTitle: { flex: 1, fontFamily: 'Inter_700Bold', color: theme.textPrimary, fontSize: 13 },
    recPriority: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
    tipRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    qCard: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: border },
    qHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qNum: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 12 },
    qDiff: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.8 },
    qNew: { fontFamily: 'Inter_700Bold', color: theme.success, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.8 },
    qText: { fontFamily: 'Inter_600SemiBold', color: theme.textPrimary, fontSize: 12.5, lineHeight: 18 },
    qAnswer: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    accentInk: { color: accentInk },
  });
}
