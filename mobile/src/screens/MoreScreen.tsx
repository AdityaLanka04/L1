import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getEnhancedStats, getFlashcardStatistics } from '../services/api';

const { width } = Dimensions.get('window');
const GAP  = 10;
const PAD  = 16;
const COL  = (width - PAD * 2 - GAP) / 2;

const BG      = '#0A0A0A';
const BLACK1  = '#0D0B07';
const BLACK2  = '#111009';
const BLACK3  = '#161208';
const BLACK4  = '#1A1508';
const BLACK5  = '#201A0A';
const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#8A6535';
const GOLD_XD = '#5A3F1A';
const GOLD_XX = '#3A2810';
const BORDER  = '#2A1E0A';
const BORDER2 = '#1E1608';

type Props = { user: AuthUser };

export default function MoreScreen({ user }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [stats, setStats]     = useState<any>(null);
  const [fcStats, setFcStats] = useState<any>(null);

  useEffect(() => {
    getEnhancedStats(user.username).then(setStats).catch(() => {});
    getFlashcardStatistics(user.username).then(setFcStats).catch(() => {});
  }, [user.username]);

  if (!fontsLoaded) return null;

  const streak       = stats?.streak ?? 0;
  const hours        = stats?.hours != null ? Number(stats.hours).toFixed(1) : '—';
  const totalChats   = stats?.totalChatSessions ?? stats?.total_chat_sessions ?? '—';
  const totalNotes   = stats?.totalNotes ?? stats?.total_notes ?? '—';
  const totalQuizzes = stats?.totalQuizzes ?? stats?.quiz_count ?? '—';

  const fcTotal    = fcStats?.total_cards    ?? '—';
  const fcSets     = fcStats?.total_sets     ?? '—';
  const fcMastered = fcStats?.cards_mastered ?? '—';
  const fcAccuracy = fcStats?.average_accuracy != null ? Math.round(fcStats.average_accuracy) + '%' : '—';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.greeting}>explore</Text>
          <Text style={s.sub}>your cerbyl universe</Text>
        </View>

        {/* ROW 1 — Streak (large) + Quiz Hub + Notes */}
        <View style={s.row}>

          {/* Streak — tall left, solid gold fill */}
          <View style={[s.tile, { width: COL, height: 220, backgroundColor: GOLD_XD, borderColor: GOLD_D }]}>
            <View style={s.tileInner}>
              <View style={s.tileTopRow}>
                <Text style={[s.tileLabel, { color: GOLD_M }]}>STREAK</Text>
                <Ionicons name="flame" size={16} color={GOLD_L} />
              </View>
              <Text style={[s.bigNum, { color: GOLD_XL }]}>{streak}</Text>
              <Text style={[s.tileUnit, { color: GOLD_M }]}>days</Text>
              <View style={[s.tileDivider, { backgroundColor: GOLD_D }]} />
              <Text style={[s.tileHint, { color: GOLD_L }]}>keep it going</Text>
            </View>
          </View>

          {/* Right column — two stacked */}
          <View style={{ width: COL, gap: GAP }}>

            {/* Quiz Hub */}
            <View style={[s.tile, { height: 106, backgroundColor: BLACK2, borderColor: BORDER2 }]}>
              <View style={s.tileInner}>
                <View style={s.tileTopRow}>
                  <Text style={s.tileLabel}>QUIZ HUB</Text>
                  <Ionicons name="help-circle-outline" size={15} color={GOLD_D} />
                </View>
                <Text style={[s.bigNum, { color: GOLD_L, fontSize: 36 }]}>{totalQuizzes}</Text>
                <Text style={s.tileUnit}>quizzes done</Text>
              </View>
            </View>

            {/* Notes */}
            <View style={[s.tile, { height: 106, backgroundColor: BLACK3, borderColor: GOLD_XD }]}>
              <View style={s.tileInner}>
                <View style={s.tileTopRow}>
                  <Text style={s.tileLabel}>NOTES</Text>
                  <Ionicons name="document-text-outline" size={15} color={GOLD_M} />
                </View>
                <Text style={[s.bigNum, { color: GOLD_M, fontSize: 36 }]}>{totalNotes}</Text>
                <Text style={s.tileUnit}>created</Text>
              </View>
            </View>

          </View>
        </View>

        {/* ROW 2 — Flashcards wide, solid mid-gold fill */}
        <View style={[s.tile, s.tileFull, { height: 140, backgroundColor: GOLD_D, borderColor: GOLD_M }]}>
          <View style={{ flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Text style={[s.bigNum, { color: BG, fontSize: 52, lineHeight: 54 }]}>{fcTotal}</Text>
              <Text style={[s.tileUnit, { color: BLACK5, marginTop: 2 }]}>sets</Text>
            </View>
            <Text style={s.fcSideText}>FLASHCARDS</Text>
          </View>
        </View>

        {/* ROW 3 — Study Hours + AI Chats */}
        <View style={s.row}>

          {/* Study Hours */}
          <View style={[s.tile, { width: COL * 0.88, height: 150, backgroundColor: BLACK2, borderColor: BORDER2 }]}>
            <View style={s.tileInner}>
              <View style={s.tileTopRow}>
                <Text style={s.tileLabel}>STUDY TIME</Text>
                <Ionicons name="time-outline" size={15} color={GOLD_D} />
              </View>
              <Text style={[s.bigNum, { color: GOLD_L, fontSize: 40 }]}>{hours}</Text>
              <Text style={s.tileUnit}>hours total</Text>
              <View style={s.hoursBar}>
                <View style={[s.hoursBarFill, { width: `${Math.min(Number(hours) / 100 * 100, 100)}%` }]} />
              </View>
            </View>
          </View>

          {/* AI Chats — solid dark gold fill */}
          <View style={[s.tile, { flex: 1, height: 150, backgroundColor: GOLD_XX, borderColor: GOLD_XD }]}>
            <View style={s.tileInner}>
              <View style={s.tileTopRow}>
                <Text style={[s.tileLabel, { color: GOLD_D }]}>AI CHATS</Text>
                <Ionicons name="sparkles-outline" size={15} color={GOLD_M} />
              </View>
              <Text style={[s.bigNum, { color: GOLD_XL, fontSize: 40 }]}>{totalChats}</Text>
              <Text style={[s.tileUnit, { color: GOLD_D }]}>sessions</Text>
            </View>
          </View>

        </View>

        {/* ROW 4 — Slides + SearchHub side by side */}
        <View style={s.row}>

          <View style={[s.tile, { flex: 1, height: 130, backgroundColor: BLACK4, borderColor: GOLD_XD }]}>
            <View style={s.tileInner}>
              <View style={s.tileTopRow}>
                <Text style={s.tileLabel}>SLIDES</Text>
                <Ionicons name="easel-outline" size={15} color={GOLD_M} />
              </View>
              <Text style={[s.bigNum, { color: GOLD_XL, fontSize: 38 }]}>AI</Text>
              <Text style={s.tileUnit}>generated decks</Text>
            </View>
          </View>

          <View style={[s.tile, { width: COL * 1.1, height: 130, backgroundColor: BLACK5, borderColor: GOLD_XD }]}>
            <View style={s.tileInner}>
              <View style={s.tileTopRow}>
                <Text style={s.tileLabel}>SEARCHHUB</Text>
                <Ionicons name="search-outline" size={15} color={GOLD_M} />
              </View>
              <Text style={[s.bigNum, { color: GOLD_L, fontSize: 38 }]}>∞</Text>
              <Text style={s.tileUnit}>explore topics</Text>
            </View>
          </View>

        </View>

        {/* ROW 5 — Wide CTA banner, brightest solid gold */}
        <View style={[s.tile, s.tileFull, { height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: GOLD_M, borderColor: GOLD_L }]}>
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: BG }}>start studying</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: BLACK5, marginTop: 2 }}>open the web app for full access</Text>
          </View>
          <View style={{ paddingRight: 20 }}>
            <Ionicons name="arrow-forward-circle" size={28} color={BG} />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: PAD, paddingBottom: 40, gap: GAP },

  header:   { paddingTop: 16, paddingBottom: 8 },
  greeting: { fontFamily: 'Inter_900Black', fontSize: 28, color: GOLD_L },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: GOLD_XD, letterSpacing: 2, marginTop: 2 },

  row: { flexDirection: 'row', gap: GAP },

  tile: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    backgroundColor: BLACK1,
  },
  tileFull: { width: '100%' },

  tileInner:   { flex: 1, padding: 16, justifyContent: 'space-between' },
  tileTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 2.5 },
  bigNum:      { fontFamily: 'Inter_900Black', fontSize: 48, color: GOLD_L, lineHeight: 56 },
  tileUnit:    { fontFamily: 'Inter_400Regular', fontSize: 10, color: GOLD_XD, letterSpacing: 1 },
  tileDivider: { height: 1, backgroundColor: GOLD_XX, marginVertical: 8 },
  tileHint:    { fontFamily: 'Inter_400Regular', fontSize: 10, color: GOLD_D, letterSpacing: 1 },

  fcSideText: {
    fontFamily: 'Inter_900Black',
    fontSize: 22,
    color: BLACK2,
    letterSpacing: 6,
    marginLeft: 12,
    textAlign: 'right',
  },

  hoursBar:     { height: 3, backgroundColor: GOLD_XX, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  hoursBarFill: { height: '100%', backgroundColor: GOLD_D, borderRadius: 2 },
});
