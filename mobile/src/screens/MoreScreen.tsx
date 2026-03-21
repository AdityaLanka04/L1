import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getEnhancedStats, getFlashcardStatistics, getWeeklyProgress } from '../services/api';
import HapticTouchable from '../components/HapticTouchable';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';

const { width } = Dimensions.get('window');
const PAD = 18;

const BAR_MAX_H = 82;

type DayData = { day: string; ai_chats: number; notes: number; flashcards: number };
type Props = { user: AuthUser; onNavigate?: (screen: 'flashcards' | 'notes' | 'aimedia') => void; onNavigateToAI?: () => void };

function QuickTile({
  title,
  subtitle,
  icon,
  accent,
  styles,
  textColor,
  onPress,
  badge,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  styles: ReturnType<typeof createStyles>;
  textColor: string;
  onPress?: () => void;
  badge?: string;
}) {
  return (
    <HapticTouchable style={styles.quickTile} onPress={onPress} haptic="selection" activeOpacity={0.86}>
      <LinearGradient colors={[rgbaFromHex(accent, 0.09), rgbaFromHex(accent, 0)]} style={styles.quickGlow} />
      <View style={[styles.quickIcon, { borderColor: rgbaFromHex(accent, 0.38), backgroundColor: rgbaFromHex(accent, 0.1) }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.quickTitle, { color: textColor }]}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </HapticTouchable>
  );
}

export default function MoreScreen({ user, onNavigate, onNavigateToAI }: Props) {
  const { selectedTheme } = useAppTheme();
  const s = useMemo(() => createStyles(selectedTheme), [selectedTheme]);
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [stats, setStats] = useState<any>(null);
  const [fcStats, setFcStats] = useState<any>(null);
  const [weekly, setWeekly] = useState<DayData[]>([]);

  useEffect(() => {
    getEnhancedStats(user.username).then(setStats).catch(() => {});
    getFlashcardStatistics(user.username).then(setFcStats).catch(() => {});
    getWeeklyProgress(user.username)
      .then((data) => {
        if (data?.daily_breakdown) setWeekly(data.daily_breakdown);
      })
      .catch(() => {});
  }, [user.username]);

  if (!fontsLoaded) return null;

  const totalChats = stats?.totalChatSessions ?? stats?.total_chat_sessions ?? 0;
  const totalNotes = stats?.totalNotes ?? stats?.total_notes ?? 0;
  const totalQuizzes = stats?.totalQuizzes ?? stats?.quiz_count ?? 0;
  const fcTotal = fcStats?.total_cards ?? 0;
  const fcSets = fcStats?.total_sets ?? 0;
  const fcMastered = fcStats?.cards_mastered ?? 0;
  const fcAccuracy = fcStats?.average_accuracy != null ? `${Math.round(fcStats.average_accuracy)}%` : '—';

  const maxVal = weekly.length
    ? Math.max(...weekly.flatMap((day) => [day.ai_chats, day.notes, day.flashcards]), 1)
    : 1;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFill} />
      <View style={[s.glow, { backgroundColor: rgbaFromHex(selectedTheme.accent, 0.08) }]} pointerEvents="none" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>explore</Text>
          <Text style={s.subtitle}>your learning toolkit, refined</Text>
        </View>

        <LinearGradient colors={[rgbaFromHex(selectedTheme.accent, 0.10), rgbaFromHex(selectedTheme.panel, 0.985), rgbaFromHex(selectedTheme.bgPrimary, 0.995)]} locations={[0, 0.62, 1]} style={s.heroCard}>
          <Text style={s.heroEyebrow}>workspace overview</Text>
          <Text style={s.heroTitle}>Everything you need for focused study, in one calm system.</Text>
          <Text style={s.heroText}>
            {totalChats} AI chats, {totalNotes} notes, and {fcTotal} flashcards are already in motion.
          </Text>
          <View style={s.heroStats}>
            {[
              { label: 'chat', value: String(totalChats) },
              { label: 'notes', value: String(totalNotes) },
              { label: 'quizzes', value: String(totalQuizzes) },
            ].map((item) => (
              <View key={item.label} style={s.heroStat}>
                <Text style={s.heroStatValue}>{item.value}</Text>
                <Text style={s.heroStatLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>core tools</Text>
          <Text style={s.sectionMeta}>jump directly into work</Text>
        </View>

        <View style={s.grid}>
          <QuickTile
            title="AI chat"
            subtitle="think, ask, iterate"
            icon="sparkles-outline"
            accent={selectedTheme.accentHover}
            styles={s}
            textColor={selectedTheme.accentHover}
            onPress={() => onNavigateToAI?.()}
          />
          <QuickTile
            title="notes"
            subtitle="capture what matters"
            icon="document-text-outline"
            accent={selectedTheme.accent}
            styles={s}
            textColor={selectedTheme.accent}
            onPress={() => onNavigate?.('notes')}
          />
        </View>

        <HapticTouchable style={s.featureCard} onPress={() => onNavigate?.('aimedia')} haptic="medium" activeOpacity={0.88}>
          <LinearGradient colors={[rgbaFromHex(selectedTheme.accent, 0.09), rgbaFromHex(selectedTheme.panel, 0.985), rgbaFromHex(selectedTheme.bgPrimary, 0.995)]} locations={[0, 0.65, 1]} style={StyleSheet.absoluteFillObject} />
          <View style={s.featureTop}>
            <Text style={s.featureEyebrow}>signature flow</Text>
            <View style={s.featurePill}>
              <Text style={s.featurePillText}>media</Text>
            </View>
          </View>
          <Text style={s.featureTitle}>AI media notes</Text>
          <Text style={s.featureBody}>Turn lectures, videos, and long-form content into clean notes without losing momentum.</Text>
          <View style={s.featureMetaRow}>
            {[
              { value: 'YT', label: 'video' },
              { value: 'AI', label: 'summary' },
              { value: '∞', label: 'topics' },
            ].map((item) => (
              <View key={item.label} style={s.featureMeta}>
                <Text style={s.featureMetaValue}>{item.value}</Text>
                <Text style={s.featureMetaLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </HapticTouchable>

        <HapticTouchable style={s.flashcardCard} onPress={() => onNavigate?.('flashcards')} haptic="medium" activeOpacity={0.88}>
          <View style={s.flashHeader}>
            <View>
              <Text style={s.cardEyebrow}>flashcards</Text>
              <Text style={s.cardTitle}>Review system</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={selectedTheme.accentHover} />
          </View>
          <View style={s.flashGrid}>
            {[
              { value: String(fcTotal), label: 'cards' },
              { value: String(fcSets), label: 'sets' },
              { value: String(fcMastered), label: 'mastered' },
              { value: fcAccuracy, label: 'accuracy' },
            ].map((item) => (
              <View key={item.label} style={s.flashCell}>
                <Text style={s.flashValue}>{item.value}</Text>
                <Text style={s.flashLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </HapticTouchable>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>weekly tempo</Text>
          <Text style={s.sectionMeta}>how the week is unfolding</Text>
        </View>

        <View style={s.chartCard}>
          <View style={s.chartLegend}>
            {[
              { color: selectedTheme.textPrimary, label: 'AI' },
              { color: selectedTheme.accentHover, label: 'cards' },
              { color: darkenColor(selectedTheme.accent, selectedTheme.isLight ? 16 : 34), label: 'notes' },
            ].map((item) => (
              <View key={item.label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={s.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.chartArea}>
            {[0.33, 0.66, 1].map((pct) => (
              <View key={pct} style={[s.gridLine, { bottom: pct * BAR_MAX_H + 18 }]} />
            ))}
            <View style={s.barsRow}>
              {(weekly.length ? weekly : Array(7).fill({ day: '?', ai_chats: 0, notes: 0, flashcards: 0 })).map((day: DayData, index: number) => {
                const aiH = Math.max(3, (day.ai_chats / maxVal) * BAR_MAX_H);
                const cardsH = Math.max(3, (day.flashcards / maxVal) * BAR_MAX_H);
                const notesH = Math.max(3, (day.notes / maxVal) * BAR_MAX_H);
                return (
                  <View key={`${day.day}-${index}`} style={s.barGroup}>
                    <View style={s.barCluster}>
                      <View style={[s.bar, { height: aiH, backgroundColor: selectedTheme.textPrimary }]} />
                      <View style={[s.bar, { height: cardsH, backgroundColor: selectedTheme.accentHover }]} />
                      <View style={[s.bar, { height: notesH, backgroundColor: darkenColor(selectedTheme.accent, selectedTheme.isLight ? 16 : 34) }]} />
                    </View>
                    <Text style={s.dayLabel}>{day.day ? day.day[0] : '?'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  const BG = theme.bgPrimary;
  const SURFACE = theme.panel;
  const SURFACE_ALT = theme.panelAlt;
  const GOLD_XL = theme.textPrimary;
  const GOLD_L = theme.accentHover;
  const GOLD_M = theme.accent;
  const DIM = theme.textSecondary;
  const BORDER = theme.border;
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: PAD, paddingBottom: 120, gap: 14 },
  glow: {
    position: 'absolute',
    top: -30,
    left: width * 0.45,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  header: { marginTop: 18, marginBottom: 4 },
  title: { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_L, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, letterSpacing: 1.6, marginTop: 4, textTransform: 'uppercase' },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    overflow: 'hidden',
  },
  heroEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_L, textTransform: 'uppercase', letterSpacing: 1.8 },
  heroTitle: { fontFamily: 'Inter_900Black', fontSize: 28, lineHeight: 32, color: GOLD_L, marginTop: 10 },
  heroText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: GOLD_M, marginTop: 12 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroStat: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: rgbaFromHex(SURFACE_ALT, 0.78),
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  heroStatValue: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_L },
  heroStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_L },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM },
  grid: { flexDirection: 'row', gap: 12 },
  quickTile: {
    flex: 1,
    minHeight: 148,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_ALT,
    padding: 18,
    overflow: 'hidden',
  },
  quickGlow: { ...StyleSheet.absoluteFillObject },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 999,
    backgroundColor: rgbaFromHex(theme.accent, 0.12),
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_L, textTransform: 'uppercase' },
  quickTitle: { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_L },
  quickSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: DIM, marginTop: 8 },
  featureCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 22,
    overflow: 'hidden',
  },
  featureTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_L, textTransform: 'uppercase', letterSpacing: 1.8 },
  featurePill: { borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: rgbaFromHex(theme.accent, 0.10) },
  featurePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_M, textTransform: 'uppercase' },
  featureTitle: { fontFamily: 'Inter_900Black', fontSize: 26, color: GOLD_L, marginTop: 14 },
  featureBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: GOLD_M, marginTop: 10, maxWidth: '88%' },
  featureMetaRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  featureMeta: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: rgbaFromHex(SURFACE_ALT, 0.88),
    paddingVertical: 12,
    alignItems: 'center',
  },
  featureMetaValue: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_L },
  featureMetaLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.2 },
  flashcardCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 20,
  },
  flashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_M, textTransform: 'uppercase', letterSpacing: 1.6 },
  cardTitle: { fontFamily: 'Inter_900Black', fontSize: 22, color: GOLD_L, marginTop: 4 },
  flashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flashCell: {
    width: '47%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_ALT,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  flashValue: { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_L },
  flashLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 5 },
  chartCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 18,
  },
  chartLegend: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, textTransform: 'uppercase' },
  chartArea: { height: 164, justifyContent: 'flex-end', position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: BORDER },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 132 },
  barGroup: { width: 28, alignItems: 'center' },
  barCluster: { height: BAR_MAX_H + 12, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 6, borderRadius: 6 },
  dayLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, marginTop: 10, textTransform: 'uppercase' },
});
}
