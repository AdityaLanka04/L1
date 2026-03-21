import { useState, useEffect, useCallback } from 'react';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TextInput, Modal, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../../services/auth';
import {
  getQuizBattles, createQuizBattle, acceptQuizBattle,
  declineQuizBattle, getFriends,
} from '../../services/api';
import HapticTouchable from '../../components/HapticTouchable';

const { width: SW } = Dimensions.get('window');

const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#8A6535';
const DIM     = '#4A3E2A';
const SURFACE = '#111111';
const BORDER  = GOLD_D + '40';

const SUBJECTS     = ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'History', 'Literature', 'Computer Science', 'Economics'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function DotGrid() {
  const dotSpacingX = 24;
  const dotSpacingY = 30;
  const cols = Math.floor((SW - 56) / dotSpacingX);
  const rows = 28;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <View
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: 56 + c * dotSpacingX,
              top: r * dotSpacingY,
              width: 2,
              height: 2,
              borderRadius: 1,
              backgroundColor: GOLD_D + '28',
            }}
          />
        ))
      )}
    </View>
  );
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name || '?').split(/[\s_]/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <LinearGradient
      colors={['#FFD700', '#C9A87C', '#7A5220']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size + 3, height: size + 3, borderRadius: (size + 3) / 2, padding: 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <LinearGradient
        colors={['#2A1C0A', '#1A1206']}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: size * 0.33, color: GOLD_XL }}>{initials}</Text>
      </LinearGradient>
    </LinearGradient>
  );
}

type Props = { user: AuthUser; onBack: () => void };

export default function GamesScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [battles, setBattles]       = useState<any[]>([]);
  const [friends, setFriends]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);

  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [subject, setSubject]               = useState('Mathematics');
  const [difficulty, setDifficulty]         = useState('medium');
  const [customSubject, setCustomSubject]   = useState('');
  const [useCustom, setUseCustom]           = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, f] = await Promise.all([getQuizBattles(user.username), getFriends(user.username)]);
      setBattles(b?.battles ?? (Array.isArray(b) ? b : []));
      setFriends(Array.isArray(f) ? f : f?.friends ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const doAccept  = async (id: number) => {
    try {
      await acceptQuizBattle(id, user.username);
      setBattles(p => p.map((b: any) => b.id === id ? { ...b, status: 'active' } : b));
    } catch {}
  };
  const doDecline = async (id: number) => {
    try {
      await declineQuizBattle(id, user.username);
      setBattles(p => p.map((b: any) => b.id === id ? { ...b, status: 'declined' } : b));
    } catch {}
  };
  const doCreate  = async () => {
    if (!selectedFriend) { Alert.alert('Select a friend first'); return; }
    setCreating(true);
    try {
      const sub = useCustom && customSubject.trim() ? customSubject.trim() : subject;
      await createQuizBattle({ challenger_id: user.username, opponent_id: selectedFriend.id, subject: sub, difficulty, question_count: 10, time_limit_seconds: 300 });
      setShowCreate(false);
      setSelectedFriend(null);
      load();
    } catch { Alert.alert('Failed to create battle'); }
    finally { setCreating(false); }
  };

  const isChallenger = (b: any) => b.challenger?.username === user.username || b.challenger_id === user.username;
  const opponent     = (b: any) => isChallenger(b) ? (b.opponent ?? b.challenged) : (b.challenger ?? b.challengedBy);
  const opponentName = (b: any) => opponent(b)?.username ?? opponent(b)?.name ?? '?';
  const friendName   = (f: any) => f.username || f.friend_username || f.name || '?';

  const pending  = battles.filter((b: any) => b.status === 'pending' && !isChallenger(b));
  const active   = battles.filter((b: any) => b.status === 'active');
  const history  = battles.filter((b: any) => ['completed', 'declined'].includes(b.status));
  const outgoing = battles.filter((b: any) => b.status === 'pending' && isChallenger(b));

  if (!fontsLoaded) return null;

  if (loading) return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#120E06', '#0A0906', '#080808']} style={StyleSheet.absoluteFillObject} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={GOLD_M} size="large" />
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={['#120E06', '#0A0906', '#080808']} style={StyleSheet.absoluteFillObject} />
      <DotGrid />

{/* Top bar */}
      <View style={s.topBar}>
        <HapticTouchable onPress={onBack} style={s.backBtn} haptic="light">
          <Ionicons name="chevron-back" size={18} color={GOLD_M} />
        </HapticTouchable>
        <HapticTouchable onPress={() => setShowCreate(true)} haptic="medium">
          <LinearGradient colors={[GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Text style={s.ctaText}>+ challenge</Text>
          </LinearGradient>
        </HapticTouchable>
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <LinearGradient colors={[GOLD_D + '55', GOLD_D + '18', 'transparent']} style={s.heroGlow}>
          <Ionicons name="flash" size={46} color={GOLD_XL} />
        </LinearGradient>
        <Text style={s.heroTitle}>battles</Text>
        <Text style={s.heroSub}>{active.length} active · {pending.length} incoming</Text>
      </View>

      <View style={s.divider} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD_D} />}
      >

        {/* Incoming */}
        {pending.length > 0 && (
          <>
            <Text style={s.section}>incoming challenges</Text>
            {pending.map((b: any, i: number) => (
              <View key={b.id ?? i} style={card.wrap}>
                <View style={card.accent} />
                <View style={card.body}>
                  <View style={card.row}>
                    <Avatar name={opponentName(b)} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={card.name}>{opponentName(b)}</Text>
                      <Text style={card.meta}>{b.subject} · {b.difficulty} · {b.question_count ?? 10}Q</Text>
                    </View>
                    <View style={card.newBadge}><Text style={card.newBadgeText}>new</Text></View>
                  </View>
                  <View style={card.actions}>
                    <HapticTouchable style={{ flex: 1 }} onPress={() => doAccept(b.id)} haptic="success">
                      <LinearGradient colors={[GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={card.acceptBtn}>
                        <Text style={card.acceptText}>accept battle</Text>
                      </LinearGradient>
                    </HapticTouchable>
                    <HapticTouchable style={card.declineBtn} onPress={() => doDecline(b.id)} haptic="warning">
                      <Text style={card.declineText}>decline</Text>
                    </HapticTouchable>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Active */}
        {active.length > 0 && (
          <>
            <Text style={s.section}>live battles</Text>
            {active.map((b: any, i: number) => (
              <View key={b.id ?? i} style={card.wrap}>
                <View style={[card.accent, { backgroundColor: GOLD_M }]} />
                <View style={card.body}>
                  <View style={vs.row}>
                    <View style={vs.player}>
                      <Avatar name={user.username} size={44} />
                      <Text style={vs.name} numberOfLines={1}>{user.username}</Text>
                      {b.challenger_score !== undefined && (
                        <Text style={vs.score}>{isChallenger(b) ? (b.challenger_score ?? 0) : (b.opponent_score ?? 0)}</Text>
                      )}
                    </View>
                    <Text style={vs.vsText}>VS</Text>
                    <View style={vs.player}>
                      <Avatar name={opponentName(b)} size={44} />
                      <Text style={vs.name} numberOfLines={1}>{opponentName(b)}</Text>
                      {b.opponent_score !== undefined && (
                        <Text style={vs.score}>{isChallenger(b) ? (b.opponent_score ?? 0) : (b.challenger_score ?? 0)}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={vs.subject}>{b.subject} · {b.difficulty}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Sent */}
        {outgoing.length > 0 && (
          <>
            <Text style={s.section}>sent challenges</Text>
            {outgoing.map((b: any, i: number) => (
              <View key={b.id ?? i} style={card.wrap}>
                <View style={[card.accent, { backgroundColor: DIM }]} />
                <View style={[card.body, card.rowOnly]}>
                  <Avatar name={opponentName(b)} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={card.name}>{opponentName(b)}</Text>
                    <Text style={card.meta}>{b.subject} · waiting…</Text>
                  </View>
                  <View style={card.pendingPill}><Text style={card.pendingText}>pending</Text></View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <Text style={s.section}>history</Text>
            {history.map((b: any, i: number) => {
              const won = isChallenger(b)
                ? (b.challenger_score ?? 0) > (b.opponent_score ?? 0)
                : (b.opponent_score ?? 0) > (b.challenger_score ?? 0);
              const resultLabel = b.status === 'completed' ? (won ? 'won' : 'lost') : b.status;
              const resultColor = b.status === 'completed' ? (won ? GOLD_M : DIM) : DIM;
              return (
                <View key={b.id ?? i} style={[card.wrap, { opacity: 0.7 }]}>
                  <View style={[card.accent, { backgroundColor: DIM }]} />
                  <View style={[card.body, card.rowOnly]}>
                    <Avatar name={opponentName(b)} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={card.name}>{opponentName(b)}</Text>
                      <Text style={card.meta}>{b.subject} · {b.difficulty}</Text>
                    </View>
                    <View style={[card.resultPill, { borderColor: resultColor + '60', backgroundColor: resultColor + '18' }]}>
                      <Text style={[card.resultText, { color: resultColor }]}>{resultLabel}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Empty */}
        {battles.length === 0 && (
          <View style={empty.wrap}>
            <LinearGradient colors={[GOLD_D + '30', GOLD_D + '0A']} style={empty.icon}>
              <Ionicons name="game-controller-outline" size={44} color={GOLD_D} />
            </LinearGradient>
            <Text style={empty.title}>no battles yet</Text>
            <Text style={empty.hint}>challenge a friend to a quiz battle</Text>
            <HapticTouchable onPress={() => setShowCreate(true)} haptic="medium">
              <LinearGradient colors={[GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={empty.btn}>
                <Text style={empty.btnText}>start a battle</Text>
              </LinearGradient>
            </HapticTouchable>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1 }}>
          <LinearGradient colors={['#120E06', '#0A0906', '#080808']} style={StyleSheet.absoluteFillObject} />
          <DotGrid />

          <View style={modal.header}>
            <View>
              <Text style={modal.title}>new challenge</Text>
              <Text style={modal.sub}>pick opponent & settings</Text>
            </View>
            <HapticTouchable onPress={() => setShowCreate(false)} style={modal.closeBtn} haptic="light">
              <Ionicons name="close" size={18} color={GOLD_M} />
            </HapticTouchable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

            <Text style={modal.label}>OPPONENT</Text>
            {friends.length === 0 ? (
              <Text style={[modal.label, { color: DIM, marginBottom: 24, letterSpacing: 0 }]}>add friends first</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {friends.map((f: any, i: number) => {
                    const sel = selectedFriend?.id === f.id;
                    return (
                      <HapticTouchable key={f.id ?? i} onPress={() => setSelectedFriend(f)} haptic="selection">
                        <View style={[modal.friendChip, sel && modal.friendChipSel]}>
                          <Avatar name={friendName(f)} size={30} />
                          <Text style={[modal.friendName, sel && { color: GOLD_XL }]}>{friendName(f)}</Text>
                        </View>
                      </HapticTouchable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            <Text style={modal.label}>SUBJECT</Text>
            <View style={modal.chipGrid}>
              {[...SUBJECTS, 'custom'].map(sub => {
                const isCustSel = sub === 'custom' && useCustom;
                const sel = sub === 'custom' ? isCustSel : (!useCustom && subject === sub);
                return (
                  <HapticTouchable
                    key={sub}
                    onPress={() => sub === 'custom' ? setUseCustom(true) : (setSubject(sub), setUseCustom(false))}
                    haptic="selection"
                  >
                    <View style={[modal.chip, sel && modal.chipSel]}>
                      <Text style={[modal.chipText, sel && modal.chipTextSel]}>{sub}</Text>
                    </View>
                  </HapticTouchable>
                );
              })}
            </View>
            {useCustom && (
              <TextInput
                style={modal.input}
                value={customSubject}
                onChangeText={setCustomSubject}
                placeholder="enter subject..."
                placeholderTextColor={DIM}
                autoFocus
              />
            )}

            <Text style={modal.label}>DIFFICULTY</Text>
            <View style={modal.diffRow}>
              {DIFFICULTIES.map(d => {
                const sel = difficulty === d;
                return (
                  <HapticTouchable key={d} style={{ flex: 1 }} onPress={() => setDifficulty(d)} haptic="selection">
                    <View style={[modal.diffBtn, sel && modal.diffBtnSel]}>
                      <Text style={[modal.diffText, sel && { color: GOLD_L }]}>{d}</Text>
                    </View>
                  </HapticTouchable>
                );
              })}
            </View>

            {selectedFriend && (
              <View style={modal.summary}>
                <LinearGradient colors={[GOLD_D + '30', GOLD_D + '0A']} style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={user.username} size={40} />
                  <Text style={modal.vsLabel}>VS</Text>
                  <Avatar name={friendName(selectedFriend)} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={modal.sumTitle}>{useCustom && customSubject ? customSubject : subject}</Text>
                    <Text style={modal.sumMeta}>{difficulty} · 10Q · 5 min</Text>
                  </View>
                </View>
              </View>
            )}

            <HapticTouchable onPress={doCreate} haptic="medium" style={{ opacity: (creating || !selectedFriend) ? 0.45 : 1 }}>
              <LinearGradient colors={[GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modal.launchBtn}>
                {creating
                  ? <ActivityIndicator color="#0A0908" />
                  : <Text style={modal.launchText}>SEND CHALLENGE</Text>
                }
              </LinearGradient>
            </HapticTouchable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: SURFACE + 'CC', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  cta:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0A0908' },

  hero:      { alignItems: 'center', paddingTop: 12, paddingBottom: 24, gap: 8 },
  heroGlow:  { width: 100, height: 100, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD_D + '50' },
  heroTitle: { fontFamily: 'Inter_900Black', fontSize: 42, color: GOLD_XL, letterSpacing: -2, marginTop: 6 },
  heroSub:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, letterSpacing: 1 },

  divider: { height: 1, marginLeft: 20, marginRight: 20, backgroundColor: GOLD_D + '25' },

  scroll:   { paddingLeft: 20, paddingRight: 20, paddingTop: 16, gap: 8 },
  section:  { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: DIM, letterSpacing: 2.5, marginTop: 8, marginBottom: 2 },
});

const card = StyleSheet.create({
  wrap:     { flexDirection: 'row', backgroundColor: SURFACE + 'CC', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_D + '20' },
  accent:   { width: 3, backgroundColor: GOLD_D },
  body:     { flex: 1, padding: 14, gap: 12 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowOnly:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingTop: 14 },
  name:     { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_L },
  meta:     { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 2 },

  newBadge:     { backgroundColor: GOLD_D + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: BORDER },
  newBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: GOLD_M },

  actions:    { flexDirection: 'row', gap: 8 },
  acceptBtn:  { borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  acceptText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0A0908' },
  declineBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: GOLD_D + '30', alignItems: 'center', justifyContent: 'center' },
  declineText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: DIM },

  pendingPill: { backgroundColor: DIM + '25', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: DIM + '40' },
  pendingText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: DIM },
  resultPill:  { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  resultText:  { fontFamily: 'Inter_700Bold', fontSize: 9 },
});

const vs = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  player:  { alignItems: 'center', gap: 4 },
  name:    { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GOLD_L, maxWidth: 80 },
  score:   { fontFamily: 'Inter_900Black', fontSize: 28, color: GOLD_XL },
  vsText:  { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  subject: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, textAlign: 'center' },
});

const empty = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingTop: 64, gap: 14 },
  icon:    { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD_D + '40' },
  title:   { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  hint:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM },
  btn:     { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0A0908' },
});

const modal = StyleSheet.create({
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  title:    { fontFamily: 'Inter_900Black', fontSize: 26, color: GOLD_XL, letterSpacing: -0.5 },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: SURFACE + 'CC', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  label:    { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: DIM, letterSpacing: 2.5, marginBottom: 10 },

  friendChip:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE + '80', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 8 },
  friendChipSel: { borderColor: GOLD_D + '70', backgroundColor: GOLD_D + '20' },
  friendName:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM },

  chipGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: SURFACE + '80', borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  chipSel:     { borderColor: GOLD_D + '70', backgroundColor: GOLD_D + '20' },
  chipText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM },
  chipTextSel: { color: GOLD_L },
  input:       { backgroundColor: SURFACE + '80', borderRadius: 10, borderWidth: 1, borderColor: GOLD_D + '50', paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_L, marginBottom: 20 },

  diffRow:    { flexDirection: 'row', gap: 8, marginBottom: 24 },
  diffBtn:    { alignItems: 'center', paddingVertical: 12, backgroundColor: SURFACE + '80', borderRadius: 10, borderWidth: 1, borderColor: BORDER },
  diffBtnSel: { borderColor: GOLD_D + '70', backgroundColor: GOLD_D + '20' },
  diffText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM },

  summary:   { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_D + '40', padding: 16, marginBottom: 20 },
  vsLabel:   { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_D },
  sumTitle:  { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_L },
  sumMeta:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 2 },

  launchBtn:  { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  launchText: { fontFamily: 'Inter_900Black', fontSize: 15, color: '#0A0908', letterSpacing: 0.5 },
});
