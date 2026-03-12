import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getEnhancedStats, getFlashcardStatistics, getWeeklyProgress } from '../services/api';

const { width } = Dimensions.get('window');
const GAP = 12;
const PAD = 16;
const COL = (width - PAD * 2 - GAP) / 2;

const BG      = '#0A0A0A';
const SURFACE = '#0F0F0F';
const SURF2   = '#141414';
const ACCENT  = '#C9A87C';   // primary accent — tile backgrounds
const ACCENT2 = '#B8956A';   // slightly deeper accent for variety
const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_D  = '#8A6535';
const GOLD_XD = '#5A3F1A';
const GOLD_XX = '#2A1E0A';
const BORDER  = '#1A1408';
const DIM     = '#3A3020';
const DIM2    = '#4A3E2A';
const INK     = '#0D0A06';   // near-black text on accent bg

const BAR_MAX_H = 72;


type DayData = { day: string; ai_chats: number; notes: number; flashcards: number };
type Props   = { user: AuthUser; onNavigate?: (screen: 'flashcards' | 'notes') => void; onNavigateToAI?: () => void };

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

  // normalise graph — find max across all three series
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

{/* ── Weekly activity graph — real data ── */}
        <View style={[s.tile, s.full, { height: 270 }]}>
          <View style={s.inner}>

            <View style={s.topRow}>
              <Text style={s.label}>THIS WEEK</Text>
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

        {/* ── ROW: AI Chats | Notes — cinematic ── */}
        <View style={s.row}>

          <TouchableOpacity style={[s.tile, s.halfTile]} onPress={() => onNavigateToAI?.()} activeOpacity={0.85}>
            <LinearGradient colors={['#0A0A0A', '#0F0D05', '#1A1508']} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['transparent', GOLD_XD + 'AA', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={s.halfWatermark}>AI</Text>
            <View style={s.halfContent}>
              <Text style={s.halfEyebrow}>AI CHATS</Text>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Text style={s.halfNum}>{totalChats}</Text>
                <Text style={s.halfUnit}>SESSIONS</Text>
                <View style={s.halfDivider} />
                <Text style={[s.halfHint, { color: GOLD_XL }]}>open chat</Text>
              </View>
            </View>
            <LinearGradient colors={['transparent', GOLD_D + '70']} style={s.halfBottomGlow} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.tile, s.halfTile]} onPress={() => onNavigate?.('notes')} activeOpacity={0.85}>
            <LinearGradient colors={['#0A0A0A', '#0D0F05', '#131A08']} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['transparent', GOLD_XD + '99', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.halfContent}>
              <Text style={s.halfEyebrow}>NOTES</Text>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Text style={s.halfNum}>{totalNotes}</Text>
                <Text style={s.halfUnit}>CREATED</Text>
                <View style={s.halfDivider} />
                <Text style={[s.halfHint, { color: GOLD_XL }]}>open notes</Text>
              </View>
            </View>
            <LinearGradient colors={['transparent', GOLD_D + '70']} style={s.halfBottomGlow} />
          </TouchableOpacity>

        </View>

        {/* ── Flashcard 2×2 grid — black bg, accent text ── */}
        <TouchableOpacity
          style={[s.tile, s.full, { backgroundColor: BG, borderColor: GOLD_D, borderWidth: 2 }]}
          onPress={() => onNavigate?.('flashcards')}
          activeOpacity={0.85}
        >
          <View style={s.inner}>
            <View style={s.topRow}>
              <Text style={s.label}>FLASHCARDS</Text>
              <Ionicons name="layers-outline" size={14} color={GOLD_D} />
            </View>
            <View style={s.fcGrid}>
              {[
                { val: fcTotal,    lbl: 'TOTAL CARDS' },
                { val: fcSets,     lbl: 'SETS' },
                { val: fcMastered, lbl: 'MASTERED' },
                { val: fcAccuracy, lbl: 'ACCURACY' },
              ].map((item, i) => (
                <View key={i} style={[s.fcCell, {
                  borderTopWidth:  i >= 2 ? 1 : 0,
                  borderLeftWidth: i % 2 === 1 ? 1 : 0,
                  borderColor:     GOLD_D + '30',
                }]}>
                  <Text style={[s.num, { fontSize: 30, color: ACCENT, lineHeight: 34 }]}>{item.val}</Text>
                  <Text style={[s.unit, { color: GOLD_D, marginTop: 2 }]}>{item.lbl}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.hint, { color: GOLD_D, marginTop: 8, marginLeft: 14, marginBottom: 10 }]}>open flashcards</Text>
          </View>
        </TouchableOpacity>

        {/* ── Quiz Hub — cinematic ── */}
        <View style={[s.tile, s.full, s.quizTile]}>
          {/* layered gradients for depth */}
          <LinearGradient
            colors={['#0A0A0A', '#1A1005', '#2A1A08']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', GOLD_XD + 'CC', GOLD_D + '55', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          {/* large decorative watermark */}
          <Text style={s.quizWatermark}>Q</Text>
          {/* content */}
          <View style={s.quizContent}>
            <View style={s.quizTopRow}>
              <Text style={s.quizEyebrow}>CHALLENGE YOURSELF</Text>
              <View style={s.quizBadge}>
                <Text style={s.quizBadgeText}>HUB</Text>
              </View>
            </View>
            <Text style={s.quizTitle}>quiz hub</Text>
            <View style={s.quizDivider} />
            <View style={s.quizStatsRow}>
              <View style={s.quizStat}>
                <Text style={s.quizStatNum}>{totalQuizzes}</Text>
                <Text style={s.quizStatLabel}>COMPLETED</Text>
              </View>
              <View style={s.quizStatSep} />
              <View style={s.quizStat}>
                <Text style={s.quizStatNum}>∞</Text>
                <Text style={s.quizStatLabel}>TOPICS</Text>
              </View>
              <View style={s.quizStatSep} />
              <View style={s.quizStat}>
                <Text style={s.quizStatNum}>AI</Text>
                <Text style={s.quizStatLabel}>POWERED</Text>
              </View>
            </View>
          </View>
          {/* bottom gold glow strip */}
          <LinearGradient
            colors={['transparent', GOLD_D + '80']}
            style={s.quizBottomGlow}
          />
        </View>

        {/* ── Bottom row: SearchHub | Slides — accent bg ── */}
        <View style={s.row}>

          <View style={[s.tile, { flex: 1, height: 130, backgroundColor: ACCENT, borderColor: ACCENT2 }]}>
            <View style={s.inner}>
              <View style={s.topRow}>
                <Text style={[s.label, { color: INK, opacity: 0.6 }]}>SEARCHHUB</Text>
                <Ionicons name="search-outline" size={13} color={INK} />
              </View>
              <Text style={[s.num, { fontSize: 34, color: INK, marginTop: 4 }]}>∞</Text>
              <Text style={[s.unit, { color: INK, opacity: 0.55 }]}>explore topics</Text>
            </View>
          </View>

          <View style={[s.tile, { flex: 1, height: 130, backgroundColor: ACCENT2, borderColor: GOLD_D }]}>
            <View style={s.inner}>
              <View style={s.topRow}>
                <Text style={[s.label, { color: INK, opacity: 0.6 }]}>SLIDES</Text>
                <Ionicons name="easel-outline" size={13} color={INK} />
              </View>
              <Text style={[s.num, { fontSize: 34, color: INK, marginTop: 4 }]}>AI</Text>
              <Text style={[s.unit, { color: INK, opacity: 0.55 }]}>generated decks</Text>
            </View>
          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: PAD, paddingBottom: 16, gap: GAP },
  row:    { flexDirection: 'row', gap: GAP },
  full:   { width: '100%' },

  tile: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  inner:   { flex: 1, padding: 16, justifyContent: 'space-between' },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, marginVertical: 8 },

  header:   { paddingTop: 18, paddingBottom: 6 },
  title:    { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_L },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 3, marginTop: 3 },

  label: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 2.5 },
  num:   { fontFamily: 'Inter_900Black', fontSize: 50, color: GOLD_L, lineHeight: 54 },
  unit:  { fontFamily: 'Inter_400Regular', fontSize: 9, color: DIM2, letterSpacing: 1.2 },
  hint:  { fontFamily: 'Inter_400Regular', fontSize: 9, color: GOLD_XD, letterSpacing: 1 },


  fcGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  fcCell: { width: '50%', paddingVertical: 16, paddingHorizontal: 14 },

  graphArea: { flex: 1, marginTop: 14, position: 'relative' },
  gridLine:  { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: DIM },
  barsRow:   {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  barGroup:   { flex: 1, alignItems: 'center' },
  barCluster: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_MAX_H },
  bar:        { width: 7, borderRadius: 4 },
  dayLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: DIM2, marginTop: 6, letterSpacing: 0.5 },

  legend:     { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 5, height: 5, borderRadius: 3 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 8, color: DIM2, letterSpacing: 1 },

  // Half-width cinematic tiles (AI Chats / Notes)
  halfTile: {
    flex: 1,
    height: 170,
    borderColor: GOLD_D,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  halfWatermark: {
    position: 'absolute',
    right: -8,
    bottom: -18,
    fontFamily: 'Inter_900Black',
    fontSize: 110,
    color: GOLD_D + '1A',
    lineHeight: 110,
  },
  halfContent: {
    flex: 1,
    padding: 14,
  },
  halfEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: GOLD_D,
    letterSpacing: 2.5,
  },
  halfNum: {
    fontFamily: 'Inter_900Black',
    fontSize: 42,
    color: GOLD_XL,
    lineHeight: 46,
    textShadowColor: GOLD_D + '80',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  halfUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 7,
    color: GOLD_D,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  halfDivider: {
    height: 1,
    backgroundColor: GOLD_D + '35',
    marginVertical: 8,
  },
  halfHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD_D,
    letterSpacing: 0.5,
  },
  halfBottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
  },

  // Quiz Hub cinematic
  quizTile: {
    height: 190,
    borderColor: GOLD_D,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  quizWatermark: {
    position: 'absolute',
    right: -10,
    bottom: -30,
    fontFamily: 'Inter_900Black',
    fontSize: 200,
    color: GOLD_D + '18',
    lineHeight: 200,
  },
  quizContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  quizTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quizEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: GOLD_D,
    letterSpacing: 3,
  },
  quizBadge: {
    backgroundColor: GOLD_D + '30',
    borderWidth: 1,
    borderColor: GOLD_D + '60',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quizBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 2,
  },
  quizTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 40,
    color: GOLD_XL,
    lineHeight: 44,
    marginTop: 2,
    textShadowColor: GOLD_D + '80',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  quizDivider: {
    height: 1,
    backgroundColor: GOLD_D + '40',
    marginVertical: 10,
  },
  quizStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  quizStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  quizStatSep: {
    width: 1,
    height: 28,
    backgroundColor: GOLD_D + '35',
  },
  quizStatNum: {
    fontFamily: 'Inter_900Black',
    fontSize: 20,
    color: GOLD_L,
    lineHeight: 24,
  },
  quizStatLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 7,
    color: GOLD_D,
    letterSpacing: 1.5,
  },
  quizBottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
});
