import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getFlashcardHistory, getFlashcardsInSet, getFlashcardStatistics } from '../services/api';

const { width: W, height: H } = Dimensions.get('window');

const BG      = '#0A0A0A';
const SURFACE = '#0F0F0F';
const ACCENT  = '#C9A87C';
const ACCENT2 = '#B8956A';
const GOLD_L  = '#E8CC88';
const GOLD_D  = '#8A6535';
const GOLD_XD = '#5A3F1A';
const BORDER  = '#1A1408';
const DIM     = '#3A3020';
const DIM2    = '#4A3E2A';
const INK     = '#0D0A06';
const GREEN   = '#5DBF7A';
const RED     = '#BF5D5D';

type FlashcardSet = {
  id: number;
  title: string;
  description: string;
  card_count: number;
  accuracy_percentage: number;
  source_type: string;
  created_at: string;
};

type Flashcard = {
  id: number;
  question: string;
  answer: string;
  difficulty: string;
};

type Props = { user: AuthUser; onBack?: () => void };

// ── Study view ────────────────────────────────────────────────────────
function StudyView({ set, cards, onBack }: { set: FlashcardSet; cards: Flashcard[]; onBack: () => void }) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [idx,     setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats,   setStats]   = useState({ correct: 0, incorrect: 0 });
  const [done,    setDone]    = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const card = cards[idx];

  const doFlip = () => {
    Animated.timing(scaleAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setFlipped(f => !f);
      Animated.timing(scaleAnim, { toValue: 1, duration: 130, useNativeDriver: true }).start();
    });
  };

  const answer = (correct: boolean) => {
    const next = { ...stats, [correct ? 'correct' : 'incorrect']: stats[correct ? 'correct' : 'incorrect'] + 1 };
    setStats(next);
    Animated.timing(scaleAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setFlipped(false);
      scaleAnim.setValue(0);
      if (idx + 1 >= cards.length) {
        setDone(true);
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      } else {
        setIdx(i => i + 1);
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      }
    });
  };

  const restart = () => {
    setIdx(0);
    setStats({ correct: 0, incorrect: 0 });
    setDone(false);
    setFlipped(false);
    scaleAnim.setValue(1);
  };

  if (!fontsLoaded) return null;

  // ── Results screen ────────────────────────────────────────────────
  if (done) {
    const total = stats.correct + stats.incorrect;
    const pct   = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.studyHeader}>
          <TouchableOpacity onPress={onBack}><Ionicons name="chevron-back" size={22} color={GOLD_L} /></TouchableOpacity>
          <Text style={s.studyTitle}>session complete</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.resultsWrap}>
          <Text style={[s.bigPct, { color: pct >= 70 ? GREEN : RED }]}>{pct}%</Text>
          <Text style={s.resultsLabel}>accuracy</Text>
          <View style={s.resultsRow}>
            <View style={s.resultStat}>
              <Text style={[s.resultNum, { color: GREEN }]}>{stats.correct}</Text>
              <Text style={s.resultLbl}>correct</Text>
            </View>
            <View style={[s.resultStat, { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
              <Text style={[s.resultNum, { color: RED }]}>{stats.incorrect}</Text>
              <Text style={s.resultLbl}>incorrect</Text>
            </View>
          </View>
          <TouchableOpacity style={s.actionBtn} onPress={restart}>
            <Text style={s.actionBtnText}>study again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={onBack}>
            <Text style={[s.actionBtnText, { color: ACCENT }]}>back to sets</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Card screen ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.studyHeader}>
        <TouchableOpacity onPress={onBack}><Ionicons name="chevron-back" size={22} color={GOLD_L} /></TouchableOpacity>
        <Text style={s.studyTitle} numberOfLines={1}>{set.title.toLowerCase()}</Text>
        <Text style={[s.studyCounter, { color: GOLD_D }]}>{idx + 1}/{cards.length}</Text>
      </View>

      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${(idx / cards.length) * 100}%` as any }]} />
      </View>

      <View style={s.cardWrap}>
        <Animated.View style={{ transform: [{ scaleX: scaleAnim }] }}>
          <TouchableOpacity
            style={[s.card, flipped && { backgroundColor: ACCENT, borderColor: ACCENT2 }]}
            onPress={doFlip}
            activeOpacity={0.95}
          >
            <Text style={[s.cardSide, flipped && { color: INK, opacity: 0.5 }]}>
              {flipped ? 'ANSWER' : 'QUESTION'}
            </Text>
            <Text style={[s.cardText, flipped && { color: INK }]}>
              {flipped ? card.answer : card.question}
            </Text>
            {!flipped && <Text style={s.tapHint}>tap to reveal answer</Text>}
            {flipped && (
              <View style={s.diffPill}>
                <Text style={s.diffText}>{card.difficulty?.toUpperCase() ?? 'MEDIUM'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={s.answerRow}>
        <TouchableOpacity style={s.wrongBtn} onPress={() => answer(false)}>
          <Ionicons name="close" size={30} color={RED} />
          <Text style={s.wrongLabel}>incorrect</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.rightBtn} onPress={() => answer(true)}>
          <Ionicons name="checkmark" size={30} color={GREEN} />
          <Text style={s.rightLabel}>correct</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Sets list ─────────────────────────────────────────────────────────
export default function FlashcardsScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [sets,         setSets]         = useState<FlashcardSet[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [fcStats,      setFcStats]      = useState<any>(null);
  const [studySet,     setStudySet]     = useState<FlashcardSet | null>(null);
  const [studyCards,   setStudyCards]   = useState<Flashcard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    getFlashcardHistory(user.username).then(d => {
      setSets(d?.flashcard_history ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
    getFlashcardStatistics(user.username).then(setFcStats).catch(() => {});
  }, [user.username]);

  const startStudy = async (set: FlashcardSet) => {
    setLoadingCards(true);
    try {
      const d = await getFlashcardsInSet(set.id);
      setStudyCards(d?.flashcards ?? []);
      setStudySet(set);
    } catch {
      // silenced
    } finally {
      setLoadingCards(false);
    }
  };

  if (!fontsLoaded) return null;

  if (studySet && studyCards.length > 0) {
    return (
      <StudyView
        set={studySet}
        cards={studyCards}
        onBack={() => { setStudySet(null); setStudyCards([]); }}
      />
    );
  }

  const totalCards = fcStats?.total_cards    ?? '—';
  const totalSets  = fcStats?.total_sets     ?? '—';
  const mastered   = fcStats?.cards_mastered ?? '—';
  const accuracy   = fcStats?.average_accuracy != null
    ? Math.round(fcStats.average_accuracy) + '%' : '—';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.title}>flashcards</Text>
          <Text style={s.subtitle}>study · master · retain</Text>
        </View>
        <Ionicons name="layers-outline" size={22} color={GOLD_D} />
      </View>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        {[
          { val: totalSets,  lbl: 'SETS'     },
          { val: totalCards, lbl: 'CARDS'    },
          { val: mastered,   lbl: 'MASTERED' },
          { val: accuracy,   lbl: 'ACCURACY' },
        ].map((item, i) => (
          <View key={i} style={[s.statCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLbl}>{item.lbl}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : sets.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>no flashcard sets yet</Text>
          <Text style={s.emptyHint}>create sets on the web app</Text>
        </View>
      ) : (
        <FlatList
          data={sets}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[s.setCard, index % 2 === 0 && { borderColor: GOLD_XD }]}
              onPress={() => startStudy(item)}
              activeOpacity={0.85}
            >
              <View style={s.setCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.setTitle} numberOfLines={2}>{item.title.toLowerCase()}</Text>
                  {!!item.description && (
                    <Text style={s.setDesc} numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
                <View style={s.countBadge}>
                  <Text style={s.countText}>{item.card_count}</Text>
                  <Text style={s.countLbl}>cards</Text>
                </View>
              </View>

              <View style={s.masteryRow}>
                <View style={s.masteryBar}>
                  <View style={[s.masteryFill, { width: `${item.accuracy_percentage}%` as any }]} />
                </View>
                <Text style={s.masteryPct}>{Math.round(item.accuracy_percentage)}%</Text>
              </View>

              <View style={s.setCardBottom}>
                <View style={[s.sourcePill, item.source_type === 'ai' && { backgroundColor: GOLD_XD }]}>
                  <Text style={s.sourceText}>{(item.source_type ?? 'manual').toUpperCase()}</Text>
                </View>
                <View style={s.studyBtn}>
                  <Text style={s.studyBtnText}>study →</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {loadingCards && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[s.emptyHint, { marginTop: 12 }]}>loading cards…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const CARD_H = H * 0.46;

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: BG },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title:    { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_L },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 3, marginTop: 2 },

  statsStrip: { flexDirection: 'row', backgroundColor: SURFACE, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER },
  statCell:   { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statVal:    { fontFamily: 'Inter_900Black', fontSize: 18, color: ACCENT },
  statLbl:    { fontFamily: 'Inter_400Regular', fontSize: 8, color: DIM2, letterSpacing: 1.5, marginTop: 2 },

  setCard:    { backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 12 },
  setCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  setTitle:   { fontFamily: 'Inter_900Black', fontSize: 17, color: GOLD_L, lineHeight: 22 },
  setDesc:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, marginTop: 3 },

  countBadge: { backgroundColor: GOLD_XD, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  countText:  { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_L },
  countLbl:   { fontFamily: 'Inter_400Regular', fontSize: 8, color: GOLD_D, letterSpacing: 1, marginTop: 1 },

  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  masteryBar: { flex: 1, height: 3, backgroundColor: DIM, borderRadius: 2, overflow: 'hidden' },
  masteryFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  masteryPct:  { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_D, width: 36, textAlign: 'right' },

  setCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourcePill:    { backgroundColor: DIM, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sourceText:    { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: GOLD_L, letterSpacing: 1.5 },
  studyBtn:      { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 7 },
  studyBtnText:  { fontFamily: 'Inter_900Black', fontSize: 12, color: INK },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  emptyHint:  { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, letterSpacing: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG + 'EE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Study ──
  studyHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  studyTitle:   { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_L, flex: 1, textAlign: 'center', marginHorizontal: 12 },
  studyCounter: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  progressBar:  { height: 2, backgroundColor: DIM, marginHorizontal: 20 },
  progressFill: { height: '100%', backgroundColor: ACCENT },

  cardWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginVertical: 16 },
  card: {
    width: W - 40,
    height: CARD_H,
    backgroundColor: SURFACE,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: GOLD_XD,
    padding: 26,
    justifyContent: 'space-between',
  },
  cardSide:  { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 2.5 },
  cardText:  { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_L, lineHeight: 28, flex: 1, marginTop: 16 },
  tapHint:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, textAlign: 'center', letterSpacing: 1 },
  diffPill:  { alignSelf: 'flex-start', backgroundColor: GOLD_XD + '80', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  diffText:  { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: INK, letterSpacing: 1.5 },

  answerRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  wrongBtn:  { flex: 1, backgroundColor: '#1A0808', borderRadius: 20, borderWidth: 1, borderColor: '#3A1212', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 5 },
  rightBtn:  { flex: 1, backgroundColor: '#081A0A', borderRadius: 20, borderWidth: 1, borderColor: '#123A16', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 5 },
  wrongLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: RED,   letterSpacing: 1 },
  rightLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GREEN, letterSpacing: 1 },

  // ── Results ──
  resultsWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  bigPct:       { fontFamily: 'Inter_900Black', fontSize: 88, lineHeight: 94 },
  resultsLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, letterSpacing: 3, marginBottom: 8 },
  resultsRow:   { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', marginTop: 8, marginBottom: 8 },
  resultStat:   { flex: 1, alignItems: 'center', padding: 22 },
  resultNum:    { fontFamily: 'Inter_900Black', fontSize: 40 },
  resultLbl:    { fontFamily: 'Inter_400Regular', fontSize: 9, color: DIM2, letterSpacing: 1.5, marginTop: 4 },

  actionBtn:        { backgroundColor: ACCENT, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 40, marginTop: 14, width: '100%', alignItems: 'center' },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: GOLD_D },
  actionBtnText:    { fontFamily: 'Inter_900Black', fontSize: 14, color: INK },
});
