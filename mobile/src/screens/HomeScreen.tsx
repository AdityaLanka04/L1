import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Animated, PanResponder, Easing } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RingProgress from '../components/RingProgress';
import HapticTouchable from '../components/HapticTouchable';
import { AuthUser } from '../services/auth';
import { getEnhancedStats } from '../services/api';
import { triggerHaptic } from '../utils/haptics';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const AnimatedView = Animated.createAnimatedComponent(View);

const SURFACE   = '#111111';
const GOLD_XL   = '#FFF0BC';
const GOLD_L    = '#E8CC88';
const GOLD_MID  = '#C9A87C';
const GOLD_D    = '#8A6535';
const GOLD_SOFT = '#F4E7C5';

const CARD_BORDER = GOLD_D + '55';

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

export default function HomeScreen({ user, onNavigate, onNavigateToAI, onSwipeLeftPage, onSwipeRightPage }: Props) {
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
        if (isTap || isSwipe) {
          cycleHeroRef.current();
        }
      },
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  useEffect(() => {
    getEnhancedStats(user.username).then(data => {
      setStats(data);
    }).catch(() => {});
  }, [user.username]);

  const streak = stats?.streak ?? 0;
  const streakStr = String(streak);

  const weeklyHours = stats?.weeklyHours ?? stats?.hours ?? 0;
  const weeklyInteractions = stats?.weeklyInteractions ?? stats?.totalChatSessions ?? 0;
  const weeklyMastered = stats?.weeklyMastered ?? stats?.totalFlashcards ?? 0;
  const totalChats = stats?.totalChatSessions ?? 0;
  const totalFlashcards = stats?.totalFlashcards ?? 0;
  const totalNotes = stats?.totalNotes ?? 0;
  const todayProgress = Math.min(99, Math.round(((Math.min(weeklyHours / 4, 1) + Math.min(weeklyInteractions / 8, 1) + Math.min(weeklyMastered / 6, 1)) / 3) * 100)) || 0;
  const hour = new Date().getHours();
  const todayDate = new Date();
  const dayLabel = todayDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateLabel = todayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  const heroSlides = [
    {
      key: 'streak',
      eyebrow: 'HOME',
      title: 'STREAK',
      value: streakStr,
      unit: 'DAYS',
      subcopy: 'current streak',
      accent: GOLD_XL,
    },
    {
      key: 'hours',
      eyebrow: 'HOME',
      title: 'STUDY TIME',
      value: weeklyHours.toFixed(1),
      unit: 'HOURS THIS WEEK',
      subcopy: 'study hours',
      accent: GOLD_L,
    },
    {
      key: 'chat',
      eyebrow: 'HOME',
      title: 'AI CHATS',
      value: String(totalChats),
      unit: 'TOTAL SESSIONS',
      subcopy: 'ai chat sessions',
      accent: GOLD_SOFT,
    },
    {
      key: 'flashcards',
      eyebrow: 'HOME',
      title: 'FLASHCARDS',
      value: String(totalFlashcards),
      unit: 'TOTAL CARDS',
      subcopy: 'flashcards created',
      accent: GOLD_MID,
    },
    {
      key: 'notes',
      eyebrow: 'HOME',
      title: 'NOTES',
      value: String(totalNotes),
      unit: 'TOTAL NOTES',
      subcopy: 'notes created',
      accent: GOLD_D,
    },
    {
      key: 'progress',
      eyebrow: 'HOME',
      title: 'TODAY',
      value: `${todayProgress}%`,
      unit: 'PROGRESS',
      subcopy: 'today progress',
      accent: GOLD_XL,
    },
  ] as const;

  const hero = heroSlides[heroIndex];
  const HERO_FONT = Math.min(248, Math.floor((SCREEN_W * 0.78) / Math.max(hero.value.length * 0.62, 1)));

  const nextAction =
    streak === 0
      ? {
          eyebrow: 'NEXT ACTION',
          title: 'Open flashcards',
          detail: 'Start a study session to rebuild your streak.',
          cta: 'Open flashcards',
          target: 'flashcards' as const,
        }
      : weeklyMastered < 8
        ? {
            eyebrow: 'NEXT ACTION',
            title: 'Review flashcards',
            detail: `${Math.max(6, 12 - weeklyMastered)} cards would improve your weekly total.`,
            cta: 'Open flashcards',
            target: 'flashcards' as const,
          }
        : weeklyInteractions < 4
          ? {
              eyebrow: 'NEXT ACTION',
              title: 'Open AI chat',
              detail: 'Continue asking questions in AI chat.',
              cta: 'Open AI chat',
              target: 'ai' as const,
            }
          : totalNotes < 3
            ? {
                eyebrow: 'NEXT ACTION',
                title: 'Open notes',
                detail: 'Add a note to save what you studied.',
                cta: 'Open notes',
                target: 'notes' as const,
              }
            : {
                eyebrow: 'NEXT ACTION',
                title: 'Open media notes',
                detail: 'Create notes from a video or lecture.',
                cta: 'Open media notes',
                target: 'aimedia' as const,
              };

  const rings = [
    { label: 'HRS\nSTUDIED',  value: weeklyHours.toFixed(1),        progress: Math.min(weeklyHours / 10, 1) },
    { label: 'INTER-\nACTIONS', value: String(weeklyInteractions),  progress: Math.min(weeklyInteractions / 50, 1) },
    { label: 'MASTERED',      value: String(weeklyMastered),         progress: Math.min(weeklyMastered / 30, 1) },
  ];

  const greeting = hour < 12 ? 'good morning' : hour < 18 ? 'good afternoon' : 'good evening';
  const firstName = user.first_name || user.username;
  const momentumLabel =
    todayProgress >= 75 ? 'STRONG DAY' :
    todayProgress >= 45 ? 'ON TRACK' :
    streak > 0 ? 'KEEP GOING' :
    'START NOW';
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
    { label: 'STREAK', value: `${streak}` },
    { label: 'HOURS', value: weeklyHours.toFixed(1) },
    { label: 'CHATS', value: `${weeklyInteractions}` },
  ];
  const quickActions = [
    { label: 'AI CHAT', detail: 'ask anything', action: () => onNavigateToAI?.() },
    { label: 'FLASHCARDS', detail: 'review cards', action: () => onNavigate?.('flashcards') },
    { label: 'NOTES', detail: 'open notes', action: () => onNavigate?.('notes') },
    { label: 'MEDIA NOTES', detail: 'from video', action: () => onNavigate?.('aimedia') },
  ];

  const todayRows = [
    {
      label: 'focus time',
      value: `${weeklyHours.toFixed(1)}h`,
      note: 'this week',
      progress: Math.min(weeklyHours / 4, 1),
    },
    {
      label: 'ai chats',
      value: String(weeklyInteractions),
      note: 'this week',
      progress: Math.min(weeklyInteractions / 8, 1),
    },
    {
      label: 'mastered',
      value: String(weeklyMastered),
      note: 'this week',
      progress: Math.min(weeklyMastered / 6, 1),
    },
  ];

  const heroContentStyle = {
    opacity: heroSwap,
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <LinearGradient colors={['#040404', '#090909', '#120E08']} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
      >
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
          <View
            {...heroSwipeResponder.panHandlers}
          >
            <View style={styles.heroSection}>
              <LinearGradient colors={['#0B0B0B', '#14110D', '#080808']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFillObject} />
              <View style={styles.heroBorder} />
              <View
                style={[
                  styles.heroOrb,
                  styles.heroOrbPrimary,
                  {
                    backgroundColor: hero.accent + '22',
                  },
                ]}
              />
              <View
                style={[
                  styles.heroOrb,
                  styles.heroOrbSecondary,
                  {
                    backgroundColor: GOLD_D + '1F',
                  },
                ]}
              />
              <View style={styles.heroTopRow}>
                <View style={[styles.phaseChip, { borderColor: hero.accent + '55', backgroundColor: hero.accent + '18' }]}>
                  <Text style={styles.phaseChipText}>HOME</Text>
                </View>
                <View style={styles.heroStatusPill}>
                  <Text style={styles.heroStatusText}>{momentumLabel}</Text>
                </View>
              </View>
              {stats === null ? (
                <ActivityIndicator color={GOLD_MID} size="large" style={{ marginTop: 40 }} />
              ) : (
                <AnimatedView style={[styles.heroContent, heroContentStyle]}>
                  <Text style={styles.heroEyebrow}>{hero.eyebrow}</Text>
                  <Text style={styles.heroLabel}>{hero.title}</Text>
                  <Text style={[styles.bigNum, { fontSize: HERO_FONT, lineHeight: HERO_FONT + 10 }]}>
                    {hero.value}
                  </Text>
                  <Text style={styles.heroUnit}>{hero.unit}</Text>
                  <Text style={styles.heroHint}>{hero.subcopy}</Text>
                  <View style={styles.heroStatsRow}>
                    {heroStats.map((item) => (
                      <View key={item.label} style={styles.heroStatChip}>
                        <Text style={styles.heroStatValue}>{item.value}</Text>
                        <Text style={styles.heroStatLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.heroDots}>
                    {heroSlides.map((_, index) => (
                      <View key={index} style={[styles.heroDot, index === heroIndex && styles.heroDotActive]} />
                    ))}
                  </View>
                  <Text style={styles.heroSwipeHint}>tap or swipe to switch view</Text>
                </AnimatedView>
              )}
            </View>
          </View>
        </View>

        <View style={styles.bodySection} {...pageSwipeResponder.panHandlers}>
          <HapticTouchable style={styles.nextCard} onPress={handleNextAction} activeOpacity={0.92} haptic="medium">
            <LinearGradient colors={['rgba(255,240,188,0.08)', 'rgba(255,240,188,0.02)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.nextTopRow}>
              <Text style={styles.nextEyebrow}>{nextAction.eyebrow}</Text>
              <Text style={styles.nextCta}>{nextAction.cta}</Text>
            </View>
            <Text style={styles.nextTitle}>{nextAction.title}</Text>
            <Text style={styles.nextDetail}>{nextAction.detail}</Text>
          </HapticTouchable>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>quick launch</Text>
            <Text style={styles.sectionSubtitle}>jump into your most used tools</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((item) => (
                <HapticTouchable key={item.label} style={styles.quickCard} onPress={item.action} activeOpacity={0.88} haptic="selection">
                  <Text style={styles.quickLabel}>{item.label}</Text>
                  <Text style={styles.quickDetail}>{item.detail}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>today</Text>
            <Text style={styles.sectionSubtitle}>current stats</Text>
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

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>totals</Text>
            <Text style={styles.sectionSubtitle}>overall usage</Text>
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

          <View style={[styles.sectionBlock, styles.quietSection]}>
            <Text style={styles.quietTitle}>this week</Text>
            <Text style={styles.quietSubtitle}>weekly summary</Text>
            <View style={styles.ringsWrap}>
              {rings.map((r) => (
                <View key={r.label} style={styles.ringMuted}>
                  <RingProgress value={r.value} label={r.label} progress={r.progress} size={84} strokeWidth={6} />
                </View>
              ))}
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent', overflow: 'hidden' },
  scroll: { paddingBottom: 56 },

  topBar: {
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appName: {
    fontFamily: 'Inter_900Black',
    fontSize: 30,
    color: GOLD_XL,
    letterSpacing: 0,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: GOLD_L,
    letterSpacing: 3,
    marginTop: 3,
  },
  topDateChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#120F0B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 86,
    alignItems: 'flex-end',
  },
  topDateDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: GOLD_XL,
    letterSpacing: 2,
  },
  topDateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1.2,
    marginTop: 3,
  },

  heroWrap: {
    marginTop: 10,
    marginBottom: 24,
  },
  heroSection: {
    minHeight: SCREEN_H * 0.54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    overflow: 'hidden',
    borderRadius: 32,
    marginHorizontal: 18,
  },
  heroBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
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
    color: GOLD_XL,
    letterSpacing: 2,
  },
  heroEyebrow: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: GOLD_L,
    letterSpacing: 4,
  },
  heroLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: GOLD_XL,
    letterSpacing: 4,
    marginTop: 10,
  },
  heroTapHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD_SOFT,
    letterSpacing: 2,
    marginTop: 8,
  },
  heroStatusPill: {
    borderRadius: 999,
    backgroundColor: '#17130E',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroStatusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: GOLD_L,
    letterSpacing: 1.8,
  },
  bigNum: {
    fontFamily: 'Inter_900Black',
    color: GOLD_XL,
    textAlign: 'center',
    marginTop: 16,
  },
  heroUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: GOLD_SOFT,
    letterSpacing: 3,
    marginTop: 4,
  },
  heroHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1.5,
    marginTop: 8,
    textAlign: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  heroStatChip: {
    minWidth: 84,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#130F0B',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
  },
  heroStatValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 20,
    color: GOLD_XL,
  },
  heroStatLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 1.8,
    marginTop: 4,
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
    backgroundColor: GOLD_D + '55',
  },
  heroDotActive: {
    backgroundColor: GOLD_XL,
    width: 20,
  },
  heroSwipeHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD_SOFT,
    letterSpacing: 1.6,
    marginTop: 14,
  },

  heroOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  heroOrbPrimary: {
    width: 260,
    height: 260,
    top: 56,
    right: -60,
  },
  heroOrbSecondary: {
    width: 220,
    height: 220,
    left: -70,
    bottom: 18,
  },

  bodySection: {
    paddingHorizontal: 24,
    gap: 26,
  },
  nextCard: {
    backgroundColor: SURFACE + 'D9',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: GOLD_D,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  nextTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 3,
  },
  nextCta: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: GOLD_XL,
    letterSpacing: 1,
  },
  nextTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 28,
    color: GOLD_XL,
    lineHeight: 32,
  },
  nextDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: GOLD_L,
    lineHeight: 20,
    marginTop: 10,
  },

  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: GOLD_XL,
    letterSpacing: 3,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1.4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: (SCREEN_W - 58) / 2,
    backgroundColor: SURFACE + 'CC',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  quickLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: GOLD_XL,
    letterSpacing: 1.5,
  },
  quickDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1,
    lineHeight: 15,
  },

  todayCard: {
    backgroundColor: SURFACE + 'CC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
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
    color: GOLD_XL,
    letterSpacing: 2,
  },
  todayNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 1,
  },
  todayValueWrap: {
    width: 110,
    alignItems: 'flex-end',
    gap: 8,
  },
  todayValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: GOLD_XL,
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
    backgroundColor: GOLD_XL,
  },

  totalsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  totalCard: {
    flex: 1,
    backgroundColor: SURFACE + 'CC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    minHeight: 116,
    justifyContent: 'space-between',
  },
  totalValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 34,
    color: GOLD_XL,
  },
  totalLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD_L,
    letterSpacing: 1.5,
    lineHeight: 14,
  },

  quietSection: {
    paddingBottom: 20,
  },
  quietTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: GOLD_L,
    letterSpacing: 3,
  },
  quietSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD_D,
    letterSpacing: 1.2,
  },
  ringsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  ringMuted: {
    opacity: 0.92,
  },
});
