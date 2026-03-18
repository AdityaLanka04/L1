import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthUser } from '../services/auth';
import { getEnhancedStats, getFlashcardStatistics, getWeeklyProgress } from '../services/api';
import HapticTouchable from '../components/HapticTouchable';

const { width } = Dimensions.get('window');
const GAP = 12;
const PAD = 16;

const BG      = '#0A0A0A';
const SURFACE = '#111111';
const ACCENT  = '#C9A87C';
const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_D  = '#8A6535';
const DIM2    = '#4A3E2A';

const CARD_BORDER = GOLD_D + '55';
const TOP_GLOW    = GOLD_D + '28';

const BAR_MAX_H = 72;

type DayData = { day: string; ai_chats: number; notes: number; flashcards: number };
type Props   = { user: AuthUser; onNavigate?: (screen: 'flashcards' | 'notes' | 'aimedia') => void; onNavigateToAI?: () => void };

function CardGlow() {
  return (
    <LinearGradient
      colors={[TOP_GLOW, 'transparent']}
      style={s.cardGlow}
      pointerEvents="none"
    />
  );
}

export default function MoreScreen({ user, onNavigate, onNavigateToAI }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [stats,   setStats]   = useState<any>(null);
  const [fcStats, setFcStats] = useState<any>(null);
  const [weekly,  setWeekly]  = useState<DayData[]>([]);

  useEffect(() => {
    getEnhancedStats(user.username).then(setStats).catch(() => {});
    getFlashcardStatistics(user.username).then(setFcStats).catch(() => {});
    getWeeklyProgress(user.username)
      .then(d => { if (d?.daily_breakdown) setWeekly(d.daily_breakdown); })
      .catch(() => {});
  }, [user.username]);

  if (!fontsLoaded) return null;

  const totalChats   = stats?.totalChatSessions   ?? stats?.total_chat_sessions ?? '—';
  const totalNotes   = stats?.totalNotes           ?? stats?.total_notes         ?? '—';
  const totalQuizzes = stats?.totalQuizzes         ?? stats?.quiz_count          ?? '—';
  const fcTotal      = fcStats?.total_cards        ?? '—';
  const fcSets       = fcStats?.total_sets         ?? '—';
  const fcMastered   = fcStats?.cards_mastered     ?? '—';
  const fcAccuracy   = fcStats?.average_accuracy   != null
    ? Math.round(fcStats.average_accuracy) + '%' : '—';

  const maxVal = weekly.length
    ? Math.max(...weekly.flatMap(d => [d.ai_chats, d.notes, d.flashcards]), 1)
    : 1;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>explore</Text>
          <Text style={s.subtitle}>your learning universe</Text>
        </View>

        {/* ── Weekly activity graph ── */}
        <View style={[s.card, s.full, { height: 270 }]}>
          <CardGlow />
          <View style={s.inner}>
            <View style={s.topRow}>
              <Text style={s.cardLabel}>THIS WEEK</Text>
              <View style={s.legend}>
                {[
                  { color: GOLD_XL, label: 'AI' },
                  { color: GOLD_L,  label: 'CARDS' },
                  { color: GOLD_D,  label: 'NOTES' },
                ].map(item => (
                  <View key={item.label} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: item.color }]} />
                    <Text style={s.legendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.graphArea}>
              {[0.33, 0.66, 1].map(pct => (
                <View key={pct} style={[s.gridLine, { bottom: pct * BAR_MAX_H + 18 }]} />
              ))}
              <View style={s.barsRow}>
                {(weekly.length ? weekly : Array(7).fill({ day: '?', ai_chats: 0, notes: 0, flashcards: 0 }))
                  .map((day: DayData, i: number) => {
                    const aiH    = Math.max(3, (day.ai_chats   / maxVal) * BAR_MAX_H);
                    const cardsH = Math.max(3, (day.flashcards / maxVal) * BAR_MAX_H);
                    const notesH = Math.max(3, (day.notes      / maxVal) * BAR_MAX_H);
                    const label  = day.day ? day.day[0] : '?';
                    return (
                      <View key={i} style={s.barGroup}>
                        <View style={s.barCluster}>
                          <View style={[s.bar, { height: aiH,    backgroundColor: GOLD_XL }]} />
                          <View style={[s.bar, { height: cardsH, backgroundColor: GOLD_L  }]} />
                          <View style={[s.bar, { height: notesH, backgroundColor: GOLD_D  }]} />
                        </View>
                        <Text style={s.dayLabel}>{label}</Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          </View>
        </View>

        {/* ── AI Chats | Notes ── */}
        <View style={s.row}>

          <HapticTouchable style={[s.card, s.halfCard]} onPress={() => onNavigateToAI?.()} activeOpacity={0.75} haptic="selection">
            <CardGlow />
            <View style={s.cardInner}>
              <Text style={s.cardLabel}>AI CHATS</Text>
              <Text style={s.cardStat}>{totalChats}</Text>
              <Text style={s.cardUnit}>SESSIONS</Text>
              <View style={s.cardDivider} />
              <Text style={s.cardHint}>open chat</Text>
            </View>
          </HapticTouchable>

          <HapticTouchable style={[s.card, s.halfCard]} onPress={() => onNavigate?.('notes')} activeOpacity={0.75} haptic="selection">
            <CardGlow />
            <View style={s.cardInner}>
              <Text style={s.cardLabel}>NOTES</Text>
              <Text style={s.cardStat}>{totalNotes}</Text>
              <Text style={s.cardUnit}>CREATED</Text>
              <View style={s.cardDivider} />
              <Text style={s.cardHint}>open notes</Text>
            </View>
          </HapticTouchable>

        </View>

        {/* ── AI Media Notes ── */}
        <HapticTouchable style={[s.card, s.full, s.featureTile]} onPress={() => onNavigate?.('aimedia')} activeOpacity={0.75} haptic="medium">
          <CardGlow />
          <View style={s.featureInner}>
            <View style={s.featureTopRow}>
              <Text style={s.featureEyebrow}>AI-POWERED TRANSCRIPTION</Text>
              <View style={s.featureBadge}><Text style={s.featureBadgeText}>NEW</Text></View>
            </View>
            <Text style={s.featureTitle}>media notes</Text>
            <View style={s.cardDivider} />
            <View style={s.statsRow}>
              {[
                { val: 'YT',  lbl: 'YOUTUBE' },
                { val: 'AI',  lbl: 'NOTES'   },
                { val: '∞',   lbl: 'TOPICS'  },
              ].map((item, i) => (
                <View key={i} style={s.statCell}>
                  {i > 0 && <View style={s.statSep} />}
                  <View style={s.stat}>
                    <Text style={s.statVal}>{item.val}</Text>
                    <Text style={s.statLbl}>{item.lbl}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </HapticTouchable>

        {/* ── Flashcards ── */}
        <HapticTouchable style={[s.card, s.full]} onPress={() => onNavigate?.('flashcards')} activeOpacity={0.75} haptic="medium">
          <CardGlow />
          <View style={s.inner}>
            <View style={s.topRow}>
              <Text style={s.cardLabel}>FLASHCARDS</Text>
              <Text style={s.cardChevron}>›</Text>
            </View>
            <View style={s.fcGrid}>
              {[
                { val: fcTotal,    lbl: 'TOTAL CARDS' },
                { val: fcSets,     lbl: 'SETS'        },
                { val: fcMastered, lbl: 'MASTERED'    },
                { val: fcAccuracy, lbl: 'ACCURACY'    },
              ].map((item, i) => (
                <View key={i} style={[s.fcCell, {
                  borderTopWidth:  i >= 2 ? 1 : 0,
                  borderLeftWidth: i % 2 === 1 ? 1 : 0,
                  borderColor:     GOLD_D + '25',
                }]}>
                  <Text style={s.fcNum}>{item.val}</Text>
                  <Text style={s.fcLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>
          </View>
        </HapticTouchable>

        {/* ── Quiz Hub ── */}
        <View style={[s.card, s.full, s.featureTile]}>
          <CardGlow />
          <View style={s.featureInner}>
            <View style={s.featureTopRow}>
              <Text style={s.featureEyebrow}>CHALLENGE YOURSELF</Text>
              <View style={s.featureBadge}><Text style={s.featureBadgeText}>HUB</Text></View>
            </View>
            <Text style={s.featureTitle}>quiz hub</Text>
            <View style={s.cardDivider} />
            <View style={s.statsRow}>
              {[
                { val: String(totalQuizzes), lbl: 'COMPLETED' },
                { val: '∞',                  lbl: 'TOPICS'    },
                { val: 'AI',                 lbl: 'POWERED'   },
              ].map((item, i) => (
                <View key={i} style={s.statCell}>
                  {i > 0 && <View style={s.statSep} />}
                  <View style={s.stat}>
                    <Text style={s.statVal}>{item.val}</Text>
                    <Text style={s.statLbl}>{item.lbl}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Bottom row: SearchHub | Slides ── */}
        <View style={s.row}>
          <View style={[s.card, { flex: 1, height: 110 }]}>
            <CardGlow />
            <View style={s.cardInner}>
              <Text style={s.cardLabel}>SEARCHHUB</Text>
              <Text style={s.bottomStat}>∞</Text>
              <Text style={s.bottomLbl}>explore topics</Text>
            </View>
          </View>

          <View style={[s.card, { flex: 1, height: 110 }]}>
            <CardGlow />
            <View style={s.cardInner}>
              <Text style={s.cardLabel}>SLIDES</Text>
              <Text style={s.bottomStat}>AI</Text>
              <Text style={s.bottomLbl}>generated decks</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: PAD, paddingBottom: 24, gap: GAP },
  row:    { flexDirection: 'row', gap: GAP },
  full:   { width: '100%' },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden',
    shadowColor: GOLD_D,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    zIndex: 0,
  },

  inner:    { flex: 1, padding: 16, justifyContent: 'space-between', zIndex: 1 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  header:   { paddingTop: 18, paddingBottom: 6 },
  title:    { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_XL },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: GOLD_L, letterSpacing: 3, marginTop: 3 },

  cardLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_XL, letterSpacing: 2.5 },
  cardChevron: { fontFamily: 'Inter_700Bold', fontSize: 20, color: GOLD_XL, lineHeight: 22 },

  // Half-width stat cards
  halfCard: { flex: 1, height: 170 },
  cardInner: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cardStat: {
    fontFamily: 'Inter_900Black',
    fontSize: 46,
    color: GOLD_XL,
    lineHeight: 50,
    marginTop: 10,
  },
  cardUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 2,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: GOLD_D + '30',
    marginVertical: 10,
  },
  cardHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD_L,
    letterSpacing: 1,
  },

  // Feature tiles (media notes, quiz hub)
  featureTile:  { height: 180 },
  featureInner: { flex: 1, padding: 20, justifyContent: 'space-between', zIndex: 1 },
  featureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 2.5,
  },
  featureBadge: {
    backgroundColor: GOLD_D + '25',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featureBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 2,
  },
  featureTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 36,
    color: GOLD_XL,
    lineHeight: 40,
    marginTop: 6,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat:     { flex: 1, alignItems: 'center', gap: 3 },
  statSep:  { width: 1, height: 28, backgroundColor: GOLD_D + '35' },
  statVal:  { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_XL, lineHeight: 24 },
  statLbl:  { fontFamily: 'Inter_400Regular', fontSize: 7, color: GOLD_L, letterSpacing: 1.5 },

  // Flashcard grid
  fcGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  fcCell: { width: '50%', paddingVertical: 14, paddingHorizontal: 14 },
  fcNum:  { fontFamily: 'Inter_900Black', fontSize: 30, color: ACCENT, lineHeight: 34 },
  fcLbl:  { fontFamily: 'Inter_400Regular', fontSize: 8, color: GOLD_L, letterSpacing: 1.5, marginTop: 2 },

  // Bottom small tiles
  bottomStat: { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_XL, lineHeight: 34, marginTop: 6 },
  bottomLbl:  { fontFamily: 'Inter_400Regular', fontSize: 9, color: GOLD_L, letterSpacing: 1, marginTop: 2 },

  // Graph
  graphArea: { flex: 1, marginTop: 14, position: 'relative' },
  gridLine:  { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: DIM2 + '40' },
  barsRow:   {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  barGroup:   { flex: 1, alignItems: 'center' },
  barCluster: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_MAX_H },
  bar:        { width: 7, borderRadius: 4 },
  dayLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_L, marginTop: 6, letterSpacing: 0.5 },

  legend:     { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 5, height: 5, borderRadius: 3 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 8, color: GOLD_L, letterSpacing: 1 },
});
