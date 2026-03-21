import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Animated, PanResponder, Easing } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import RingProgress from '../components/RingProgress';
import HapticTouchable from '../components/HapticTouchable';
import { AuthUser } from '../services/auth';
import { getEnhancedStats } from '../services/api';
import { triggerHaptic } from '../utils/haptics';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const AnimatedView = Animated.createAnimatedComponent(View);

type HomeTarget = 'flashcards' | 'notes' | 'aimedia';
type Props = {
  user: AuthUser;
  onNavigate?: (screen: HomeTarget) => void;
  onNavigateToAI?: () => void;
  onSwipeLeftPage?: () => void;
  onSwipeRightPage?: () => void;
};

type Stats = {
  streak: number;
  hours: number;
  totalChatSessions: number;
  totalFlashcards: number;
  totalNotes: number;
  weeklyHours?: number;
  weeklyInteractions?: number;
  weeklyMastered?: number;
};

function MetricCapsule({ label, value }: { label: string; value: string }) {
  const { selectedTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(selectedTheme), [selectedTheme]);
  return (
    <View style={styles.metricCapsule}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen({ user, onNavigate, onNavigateToAI, onSwipeLeftPage, onSwipeRightPage }: Props) {
  const { selectedTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(selectedTheme), [selectedTheme]);
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [stats, setStats] = useState<Stats | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSwap = useRef(new Animated.Value(1)).current;
  const heroAnimating = useRef(false);
  const cycleHeroRef = useRef<() => void>(() => {});

  const pageSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 36 || Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) return;
        if (gestureState.dx < 0) {
          onSwipeLeftPage?.();
          return;
        }
        onSwipeRightPage?.();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const heroSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const isTap = Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10;
        const isSwipe = Math.abs(gestureState.dx) > 34 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        if (isTap || isSwipe) cycleHeroRef.current();
      },
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  useEffect(() => {
    getEnhancedStats(user.username).then((data) => setStats(data)).catch(() => {});
  }, [user.username]);

  const streak = stats?.streak ?? 0;
  const GOLD_XL = selectedTheme.textPrimary;
  const GOLD_L = selectedTheme.accentHover;
  const GOLD_MID = selectedTheme.accent;
  const GOLD_SOFT = selectedTheme.textPrimary;
  const accentDark = darkenColor(selectedTheme.accent, selectedTheme.isLight ? 16 : 34);
  const weeklyHours = stats?.weeklyHours ?? stats?.hours ?? 0;
  const weeklyInteractions = stats?.weeklyInteractions ?? stats?.totalChatSessions ?? 0;
  const weeklyMastered = stats?.weeklyMastered ?? stats?.totalFlashcards ?? 0;
  const totalChats = stats?.totalChatSessions ?? 0;
  const totalFlashcards = stats?.totalFlashcards ?? 0;
  const totalNotes = stats?.totalNotes ?? 0;
  const todayProgress =
    Math.min(
      99,
      Math.round(((Math.min(weeklyHours / 4, 1) + Math.min(weeklyInteractions / 8, 1) + Math.min(weeklyMastered / 6, 1)) / 3) * 100)
    ) || 0;

  const hour = new Date().getHours();
  const todayDate = new Date();
  const dayLabel = todayDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateLabel = todayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  const heroSlides = [
    { key: 'streak', eyebrow: 'daily signal', title: 'streak', value: String(streak), unit: 'days active', subcopy: 'keep the chain alive', accent: GOLD_L },
    { key: 'hours', eyebrow: 'focus depth', title: 'study time', value: weeklyHours.toFixed(1), unit: 'hours this week', subcopy: 'time invested in real work', accent: GOLD_L },
    { key: 'chat', eyebrow: 'thinking loop', title: 'ai chats', value: String(totalChats), unit: 'total sessions', subcopy: 'questions, iterations, answers', accent: GOLD_MID },
    { key: 'flashcards', eyebrow: 'memory system', title: 'flashcards', value: String(totalFlashcards), unit: 'cards created', subcopy: 'repeat and retain', accent: GOLD_MID },
    { key: 'notes', eyebrow: 'knowledge base', title: 'notes', value: String(totalNotes), unit: 'notes saved', subcopy: 'captured ideas and lessons', accent: accentDark },
    { key: 'progress', eyebrow: 'today', title: 'progress', value: `${todayProgress}%`, unit: 'momentum score', subcopy: 'how the day is moving', accent: GOLD_L },
  ] as const;

  const hero = heroSlides[heroIndex];
  const heroFontSize = Math.min(240, Math.floor((SCREEN_W * 0.75) / Math.max(hero.value.length * 0.62, 1)));

  const nextAction =
    streak === 0
      ? {
          eyebrow: 'next action',
          title: 'Start a session',
          detail: 'Open flashcards and put today on the board.',
          cta: 'open flashcards',
          target: 'flashcards' as const,
          icon: 'layers-outline' as const,
        }
      : weeklyMastered < 8
        ? {
            eyebrow: 'next action',
            title: 'Review your cards',
            detail: `${Math.max(6, 12 - weeklyMastered)} more cards would sharpen the week.`,
            cta: 'review now',
            target: 'flashcards' as const,
            icon: 'layers-outline' as const,
          }
        : weeklyInteractions < 4
          ? {
              eyebrow: 'next action',
              title: 'Think with AI',
              detail: 'Open AI chat and keep the loop moving.',
              cta: 'open ai',
              target: 'ai' as const,
              icon: 'sparkles-outline' as const,
            }
          : totalNotes < 3
            ? {
                eyebrow: 'next action',
                title: 'Capture a note',
                detail: 'Save what you learned while it is still fresh.',
                cta: 'open notes',
                target: 'notes' as const,
                icon: 'document-text-outline' as const,
              }
            : {
                eyebrow: 'next action',
                title: 'Build media notes',
                detail: 'Turn a lecture or video into a cleaner study asset.',
                cta: 'open media notes',
                target: 'aimedia' as const,
                icon: 'videocam-outline' as const,
              };

  const rings = [
    { label: 'HRS\nFOCUS', value: weeklyHours.toFixed(1), progress: Math.min(weeklyHours / 10, 1) },
    { label: 'AI\nLOOPS', value: String(weeklyInteractions), progress: Math.min(weeklyInteractions / 50, 1) },
    { label: 'CARDS\nMASTERED', value: String(weeklyMastered), progress: Math.min(weeklyMastered / 30, 1) },
  ];

  const greeting = hour < 12 ? 'good morning' : hour < 18 ? 'good afternoon' : 'good evening';
  const firstName = user.first_name || user.username;
  const momentumLabel =
    todayProgress >= 75 ? 'high momentum' :
    todayProgress >= 45 ? 'on track' :
    streak > 0 ? 'keep pushing' :
    'ready to start';

  const cycleHero = () => {
    if (stats === null || heroAnimating.current) return;
    heroAnimating.current = true;
    Animated.timing(heroSwap, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
      triggerHaptic('selection');
      Animated.timing(heroSwap, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        heroAnimating.current = false;
      });
    });
  };
  cycleHeroRef.current = cycleHero;

  const handleNextAction = () => {
    if (nextAction.target === 'ai') {
      onNavigateToAI?.();
      return;
    }
    onNavigate?.(nextAction.target);
  };

  const heroStats = [
    { label: 'streak', value: `${streak}` },
    { label: 'hours', value: weeklyHours.toFixed(1) },
    { label: 'chats', value: `${weeklyInteractions}` },
  ];

  const quickActions = [
    { label: 'ai chat', detail: 'ask, draft, iterate', icon: 'sparkles-outline' as const, action: () => onNavigateToAI?.() },
    { label: 'flashcards', detail: 'review memory', icon: 'layers-outline' as const, action: () => onNavigate?.('flashcards') },
    { label: 'notes', detail: 'save the lesson', icon: 'document-text-outline' as const, action: () => onNavigate?.('notes') },
    { label: 'media notes', detail: 'from video to notes', icon: 'videocam-outline' as const, action: () => onNavigate?.('aimedia') },
  ];

  const todayRows = [
    { label: 'focus time', value: `${weeklyHours.toFixed(1)}h`, note: 'this week', progress: Math.min(weeklyHours / 4, 1) },
    { label: 'ai chats', value: String(weeklyInteractions), note: 'this week', progress: Math.min(weeklyInteractions / 8, 1) },
    { label: 'mastered', value: String(weeklyMastered), note: 'this week', progress: Math.min(weeklyMastered / 6, 1) },
  ];

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.glowTop, { backgroundColor: rgbaFromHex(selectedTheme.accent, 0.08) }]} pointerEvents="none" />
      <View style={[styles.glowBottom, { backgroundColor: rgbaFromHex(selectedTheme.accent, 0.09) }]} pointerEvents="none" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false} alwaysBounceVertical={false}>
        <View style={styles.topBar} {...pageSwipeResponder.panHandlers}>
          <View>
            <Text style={styles.appName}>cerbyl</Text>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          </View>
          <View style={styles.topDateChip}>
            <Text style={styles.topDateDay}>{dayLabel}</Text>
            <Text style={styles.topDateText}>{dateLabel}</Text>
          </View>
        </View>

        <View style={styles.heroWrap}>
          <View {...heroSwipeResponder.panHandlers}>
            <View style={styles.heroSection}>
              <LinearGradient colors={[rgbaFromHex(selectedTheme.accent, 0.10), rgbaFromHex(selectedTheme.panel, 0.985), rgbaFromHex(selectedTheme.bgPrimary, 0.995)]} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFillObject} />
              <View style={styles.heroBorder} />
              <View style={[styles.heroOrb, styles.heroOrbPrimary, { backgroundColor: rgbaFromHex(hero.accent, 0.08) }]} />
              <View style={[styles.heroOrb, styles.heroOrbSecondary, { backgroundColor: rgbaFromHex(darkenColor(selectedTheme.accent, selectedTheme.isLight ? 16 : 34), 0.14) }]} />

              <View style={styles.heroTopRow}>
                <View style={[styles.phaseChip, { borderColor: rgbaFromHex(hero.accent, 0.33), backgroundColor: rgbaFromHex(selectedTheme.panelAlt, 0.86) }]}>
                  <Text style={styles.phaseChipText}>{hero.eyebrow}</Text>
                </View>
                <View style={styles.heroStatusPill}>
                  <Text style={styles.heroStatusText}>{momentumLabel}</Text>
                </View>
              </View>

              {stats === null ? (
                <ActivityIndicator color={selectedTheme.accent} size="large" style={{ marginTop: 40 }} />
              ) : (
                <AnimatedView style={[styles.heroContent, { opacity: heroSwap, transform: [{ scale: heroSwap.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
                  <Text style={styles.heroLabel}>{hero.title}</Text>
                  <Text style={[styles.bigNum, { fontSize: heroFontSize, lineHeight: heroFontSize + 10 }]}>{hero.value}</Text>
                  <Text style={styles.heroUnit}>{hero.unit}</Text>
                  <Text style={styles.heroHint}>{hero.subcopy}</Text>

                  <View style={styles.heroStatsRow}>
                    {heroStats.map((item) => (
                      <MetricCapsule key={item.label} label={item.label} value={item.value} />
                    ))}
                  </View>

                  <View style={styles.heroDots}>
                    {heroSlides.map((_, index) => (
                      <View key={index} style={[styles.heroDot, index === heroIndex && styles.heroDotActive]} />
                    ))}
                  </View>
                  <Text style={styles.heroSwipeHint}>tap or swipe the hero to cycle views</Text>
                </AnimatedView>
              )}
            </View>
          </View>
        </View>

        <View style={styles.bodySection} {...pageSwipeResponder.panHandlers}>
          <HapticTouchable style={styles.nextCard} onPress={handleNextAction} activeOpacity={0.9} haptic="medium">
            <LinearGradient colors={[rgbaFromHex(selectedTheme.accentHover, 0.05), rgbaFromHex(selectedTheme.accentHover, 0.015), rgbaFromHex(selectedTheme.bgPrimary, 0)]} style={StyleSheet.absoluteFillObject} />
            <View style={styles.nextTopRow}>
              <Text style={styles.nextEyebrow}>{nextAction.eyebrow}</Text>
              <View style={styles.nextCtaPill}>
                <Ionicons name={nextAction.icon} size={13} color={selectedTheme.textPrimary} />
                <Text style={styles.nextCta}>{nextAction.cta}</Text>
              </View>
            </View>
            <Text style={styles.nextTitle}>{nextAction.title}</Text>
            <Text style={styles.nextDetail}>{nextAction.detail}</Text>
          </HapticTouchable>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>quick launch</Text>
              <Text style={styles.sectionSubtitle}>favorite tools on standby</Text>
            </View>
            <View style={styles.quickGrid}>
              {quickActions.map((item) => (
                <HapticTouchable key={item.label} style={styles.quickCard} onPress={item.action} activeOpacity={0.88} haptic="selection">
                  <LinearGradient colors={[rgbaFromHex(selectedTheme.accent, 0.05), rgbaFromHex(selectedTheme.bgPrimary, 0)]} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.quickIconWrap}>
                    <Ionicons name={item.icon} size={18} color={selectedTheme.textPrimary} />
                  </View>
                  <Text style={styles.quickLabel}>{item.label}</Text>
                  <Text style={styles.quickDetail}>{item.detail}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.duoRow}>
            <View style={[styles.sectionCard, styles.todaySectionCard, styles.duoCard]}>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>today</Text>
                <Text style={styles.sectionSubtitle}>live progress</Text>
              </View>
              <View style={styles.todayCard}>
                {todayRows.map((row, index) => (
                  <View key={row.label} style={[styles.todayRow, index < todayRows.length - 1 && styles.todayDivider]}>
                    <View style={styles.todayTextWrap}>
                      <Text style={styles.todayLabel}>{row.label}</Text>
                      <Text style={styles.todayNote}>{row.note}</Text>
                    </View>
                    <View style={styles.todayValueWrap}>
                      <Text style={styles.todayValue}>{row.value}</Text>
                      <View style={styles.todayRail}>
                        <View style={[styles.todayRailFill, { width: `${Math.max(12, row.progress * 100)}%` }]} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.sectionCard, styles.duoCard]}>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>weekly orbit</Text>
                <Text style={styles.sectionSubtitle}>signal strength</Text>
              </View>
              <View style={styles.ringsWrap}>
                {rings.map((ring) => (
                  <View key={ring.label} style={styles.ringMuted}>
                    <RingProgress value={ring.value} label={ring.label} progress={ring.progress} size={88} strokeWidth={6} />
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>lifetime totals</Text>
              <Text style={styles.sectionSubtitle}>what you have built so far</Text>
            </View>
            <View style={styles.totalsRow}>
              {[
                { val: totalChats, label: 'chat sessions' },
                { val: totalFlashcards, label: 'flashcards built' },
                { val: totalNotes, label: 'notes saved' },
              ].map((item) => (
                <View key={item.label} style={styles.totalCard}>
                  <Text style={styles.totalValue}>{item.val}</Text>
                  <Text style={styles.totalLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  const SURFACE = theme.panel;
  const SURFACE_ALT = theme.panelAlt;
  const GOLD_XL = theme.textPrimary;
  const GOLD_L = theme.accentHover;
  const GOLD_MID = theme.accent;
  const GOLD_D = darkenColor(theme.accent, theme.isLight ? 16 : 34);
  const GOLD_SOFT = theme.textPrimary;
  const DIM = theme.textSecondary;
  const CARD_BORDER = theme.border;
  const SHADOW = darkenColor(theme.primary, theme.isLight ? 72 : 4);

  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent', overflow: 'hidden' },
  scroll: { paddingBottom: 110 },
  glowTop: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  glowBottom: {
    position: 'absolute',
    bottom: 120,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
  },

  topBar: {
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appName: {
    fontFamily: 'Inter_900Black',
    fontSize: 30,
    color: GOLD_L,
    letterSpacing: -0.8,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: DIM,
    letterSpacing: 1.8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  topDateChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: rgbaFromHex(theme.panelAlt, 0.92),
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 92,
    alignItems: 'flex-end',
  },
  topDateDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: GOLD_L,
    letterSpacing: 1.8,
  },
  topDateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1,
    marginTop: 3,
  },

  heroWrap: {
    marginTop: 10,
    marginBottom: 22,
  },
  heroSection: {
    minHeight: SCREEN_H * 0.54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
    overflow: 'hidden',
    borderRadius: 34,
    marginHorizontal: 18,
  },
  heroBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
  },
  phaseChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phaseChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  heroStatusPill: {
    borderRadius: 999,
    backgroundColor: rgbaFromHex(theme.panelAlt, 0.86),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroStatusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: GOLD_L,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: GOLD_L,
    letterSpacing: 3.2,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  bigNum: {
    fontFamily: 'Inter_900Black',
    color: GOLD_L,
    textAlign: 'center',
    marginTop: 8,
  },
  heroUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: GOLD_MID,
    letterSpacing: 2.6,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  heroHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: GOLD_L,
    letterSpacing: 0.8,
    marginTop: 10,
    textAlign: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  metricCapsule: {
    minWidth: 88,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: rgbaFromHex(theme.accent, 0.10),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 20,
    color: GOLD_L,
  },
  metricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 1.6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  heroDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: rgbaFromHex(GOLD_D, 0.33),
  },
  heroDotActive: {
    backgroundColor: GOLD_L,
    width: 24,
  },
  heroSwipeHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD_SOFT,
    letterSpacing: 1.1,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  heroOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  heroOrbPrimary: {
    width: 210,
    height: 210,
    top: 28,
    right: -92,
  },
  heroOrbSecondary: {
    width: 170,
    height: 170,
    left: -88,
    bottom: -6,
  },

  bodySection: {
    paddingHorizontal: 18,
    gap: 22,
  },
  nextCard: {
    backgroundColor: rgbaFromHex(SURFACE, 0.93),
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  nextTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  nextEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  nextCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: rgbaFromHex(theme.accent, 0.10),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nextCta: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  nextTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 30,
    color: GOLD_L,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  nextDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: GOLD_L,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: '88%',
  },

  sectionBlock: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: rgbaFromHex(SURFACE, 0.93),
    borderRadius: 26,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
  },
  todaySectionCard: {
    backgroundColor: rgbaFromHex(theme.panelAlt, 0.86),
  },
  duoRow: {
    gap: 14,
  },
  duoCard: {
    minHeight: 210,
  },
  sectionHeadRow: {
    gap: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: GOLD_L,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: DIM,
    lineHeight: 16,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: (SCREEN_W - 46) / 2,
    backgroundColor: SURFACE_ALT,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    minHeight: 118,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: rgbaFromHex(theme.accent, 0.10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: 'Inter_900Black',
    fontSize: 17,
    color: GOLD_L,
    letterSpacing: -0.2,
    marginTop: 18,
  },
  quickDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: DIM,
    letterSpacing: 0.3,
    lineHeight: 16,
    marginTop: 6,
  },

  todayCard: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 10,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 16,
  },
  todayDivider: {
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  todayTextWrap: {
    flex: 1,
    gap: 5,
  },
  todayLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: GOLD_MID,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  todayNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: DIM,
    letterSpacing: 0.6,
  },
  todayValueWrap: {
    width: 118,
    alignItems: 'flex-end',
    gap: 8,
  },
  todayValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: GOLD_L,
  },
  todayRail: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    backgroundColor: GOLD_D + '22',
    overflow: 'hidden',
  },
  todayRailFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GOLD_L,
  },

  ringsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 18,
  },
  ringMuted: {
    opacity: 0.96,
  },

  totalsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  totalCard: {
    flex: 1,
    backgroundColor: SURFACE_ALT,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    minHeight: 128,
    justifyContent: 'space-between',
  },
  totalValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 36,
    color: GOLD_L,
  },
  totalLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: DIM,
    letterSpacing: 0.6,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
});
}
