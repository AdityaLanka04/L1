import { useState, useEffect, useCallback } from 'react';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TextInput, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../../services/auth';
import { getChallenges, createChallenge, joinChallenge, getFriends } from '../../services/api';
import HapticTouchable from '../../components/HapticTouchable';

const BG      = '#0A0A0A';
const CARD    = '#111111';
const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#7A5C2E';
const DIM     = '#4A4030';
const BORDER  = '#1E1A12';

const SUBJECTS  = ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'History', 'Literature', 'CS', 'Economics'];
const DIFF_META: Record<string, { color: string }> = {
  easy:   { color: '#4CAF50' },
  medium: { color: '#C9A87C' },
  hard:   { color: '#EF5350' },
};

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || '?').split(/[\s_]/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <LinearGradient colors={[GOLD_D + '70', GOLD_D + '25']} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD_D }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: size * 0.33, color: GOLD_L }}>{initials}</Text>
    </LinearGradient>
  );
}

type Props = { user: AuthUser; onBack: () => void };

export default function QuizPlaylistScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [challenges, setChallenges]   = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [joining, setJoining]         = useState<number | null>(null);
  const [tab, setTab]                 = useState<'discover' | 'mine'>('discover');

  // Form
  const [title, setTitle]             = useState('');
  const [subject, setSubject]         = useState('Mathematics');
  const [difficulty, setDifficulty]   = useState('medium');
  const [useCustomSub, setUseCustomSub] = useState(false);
  const [customSub, setCustomSub]     = useState('');

  const load = useCallback(async () => {
    try {
      const d = await getChallenges(user.username);
      setChallenges(d?.challenges ?? (Array.isArray(d) ? d : []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const doCreate = async () => {
    if (!title.trim()) { Alert.alert('Enter a title'); return; }
    setCreating(true);
    try {
      const finalSubject = useCustomSub && customSub.trim() ? customSub.trim() : subject;
      await createChallenge({
        creator_id: user.username,
        title: title.trim(),
        subject: finalSubject,
        difficulty,
        question_count: 10,
        time_limit_hours: 48,
      });
      setShowCreate(false);
      setTitle('');
      load();
    } catch { Alert.alert('Failed to create challenge'); }
    finally { setCreating(false); }
  };

  const doJoin = async (id: number) => {
    setJoining(id);
    try {
      await joinChallenge(id, user.username);
      load();
    } catch { Alert.alert('Failed to join challenge'); }
    finally { setJoining(null); }
  };

  const mine    = challenges.filter((c: any) => c.creator_username === user.username || c.creator_id === user.username);
  const others  = challenges.filter((c: any) => c.creator_username !== user.username && c.creator_id !== user.username);
  const display = tab === 'mine' ? mine : others;

  const isJoined = (c: any) => {
    const parts = c.participants ?? c.participant_ids ?? [];
    return Array.isArray(parts) && parts.some((p: any) => (typeof p === 'string' ? p : p?.username) === user.username);
  };

  const diffColor = (d: string) => DIFF_META[d]?.color ?? GOLD_M;

  if (!fontsLoaded) return null;

  if (loading) return (
    <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={GOLD_M} size="large" />
    </View>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <HapticTouchable onPress={onBack} style={s.backBtn} haptic="light">
          <Ionicons name="chevron-back" size={20} color={GOLD_M} />
        </HapticTouchable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>quiz hub</Text>
          <Text style={s.subtitle}>group challenges & playlists</Text>
        </View>
        <HapticTouchable style={s.createBtn} onPress={() => setShowCreate(true)} haptic="medium">
          <Ionicons name="add" size={16} color={GOLD_XL} />
          <Text style={s.createBtnText}>create</Text>
        </HapticTouchable>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['discover', 'mine'] as const).map(t => (
          <HapticTouchable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)} haptic="selection">
            <Ionicons name={t === 'discover' ? 'compass-outline' : 'person-outline'} size={13} color={tab === t ? GOLD_L : DIM} />
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>{t === 'discover' ? 'discover' : 'my sets'}</Text>
          </HapticTouchable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD_M} />}
      >
        {display.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="library-outline" size={48} color={DIM} />
            <Text style={s.emptyTitle}>{tab === 'mine' ? 'no sets yet' : 'no challenges found'}</Text>
            <Text style={s.emptyHint}>{tab === 'mine' ? 'create your first quiz challenge' : 'be the first to create one'}</Text>
            <HapticTouchable style={s.emptyBtn} onPress={() => setShowCreate(true)} haptic="medium">
              <Ionicons name="add-circle-outline" size={15} color={GOLD_XL} />
              <Text style={s.emptyBtnText}>create challenge</Text>
            </HapticTouchable>
          </View>
        ) : display.map((c: any, i: number) => {
          const joined  = isJoined(c);
          const isMine  = c.creator_username === user.username || c.creator_id === user.username;
          const count   = c.participants?.length ?? c.participant_count ?? 0;
          const dColor  = diffColor(c.difficulty);
          return (
            <View key={c.id ?? i} style={s.card}>
              {/* Card top row */}
              <View style={s.cardHeader}>
                <View style={[s.subjectBadge, { borderColor: dColor + '60', backgroundColor: dColor + '15' }]}>
                  <Text style={[s.subjectText, { color: dColor }]}>{c.difficulty ?? 'medium'}</Text>
                </View>
                <View style={s.subjectBadge}>
                  <Text style={s.subjectText}>{c.subject}</Text>
                </View>
                {c.time_limit_hours && (
                  <View style={[s.subjectBadge, { marginLeft: 'auto' }]}>
                    <Ionicons name="time-outline" size={10} color={DIM} />
                    <Text style={s.subjectText}>{c.time_limit_hours}h</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={s.cardTitle}>{c.title}</Text>

              {/* Creator row */}
              <View style={s.cardMeta}>
                <Avatar name={c.creator_username ?? c.creator ?? '?'} size={22} />
                <Text style={s.cardCreator}>{c.creator_username ?? c.creator ?? '?'}</Text>
                {isMine && <View style={s.youChip}><Text style={s.youChipText}>you</Text></View>}
                <View style={{ flex: 1 }} />
                <Ionicons name="people-outline" size={12} color={DIM} />
                <Text style={s.cardCreator}>{count}</Text>
              </View>

              {/* Participants row */}
              {count > 0 && c.participants && Array.isArray(c.participants) && (
                <View style={s.avatarRow}>
                  {c.participants.slice(0, 6).map((p: any, pi: number) => (
                    <View key={pi} style={[s.miniAvatar, { marginLeft: pi > 0 ? -8 : 0 }]}>
                      <Avatar name={typeof p === 'string' ? p : p?.username ?? '?'} size={26} />
                    </View>
                  ))}
                  {count > 6 && <Text style={s.moreText}>+{count - 6}</Text>}
                </View>
              )}

              {/* Progress bar if user is participating */}
              {joined && c.user_score !== undefined && (
                <View style={s.progressWrap}>
                  <View style={[s.progressBar, { width: `${Math.min(100, (c.user_score / (c.max_score ?? 100)) * 100)}%` as any }]} />
                  <Text style={s.progressText}>{c.user_score ?? 0}/{c.max_score ?? c.question_count ?? 10} pts</Text>
                </View>
              )}

              {/* Action */}
              {!isMine && (
                <HapticTouchable
                  style={[s.joinBtn, joined && s.joinBtnJoined]}
                  onPress={() => !joined && doJoin(c.id)}
                  haptic={joined ? 'selection' : 'medium'}
                >
                  {joining === c.id
                    ? <ActivityIndicator size="small" color={joined ? GOLD_M : BG} />
                    : <>
                        <Ionicons name={joined ? 'checkmark-circle' : 'play-circle-outline'} size={14} color={joined ? GOLD_M : BG} />
                        <Text style={[s.joinBtnText, joined && { color: GOLD_M }]}>{joined ? 'joined' : 'join challenge'}</Text>
                      </>
                  }
                </HapticTouchable>
              )}

              {isMine && (
                <View style={s.statsRow}>
                  <View style={s.statChip}>
                    <Ionicons name="people-outline" size={11} color={GOLD_M} />
                    <Text style={s.statText}>{count} participants</Text>
                  </View>
                  <View style={s.statChip}>
                    <Ionicons name="layers-outline" size={11} color={GOLD_M} />
                    <Text style={s.statText}>{c.question_count ?? 10} questions</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>new challenge</Text>
            <HapticTouchable onPress={() => setShowCreate(false)} haptic="light">
              <Ionicons name="close" size={22} color={GOLD_M} />
            </HapticTouchable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
            <Text style={s.fieldLabel}>challenge title</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Biology Finals Prep"
              placeholderTextColor={DIM}
            />

            <Text style={s.fieldLabel}>subject</Text>
            <View style={s.chipRow}>
              {SUBJECTS.map(sub => (
                <HapticTouchable key={sub} style={[s.chip, !useCustomSub && subject === sub && s.chipActive]} onPress={() => { setSubject(sub); setUseCustomSub(false); }} haptic="selection">
                  <Text style={[s.chipText, !useCustomSub && subject === sub && s.chipTextActive]}>{sub}</Text>
                </HapticTouchable>
              ))}
              <HapticTouchable style={[s.chip, useCustomSub && s.chipActive]} onPress={() => setUseCustomSub(true)} haptic="selection">
                <Text style={[s.chipText, useCustomSub && s.chipTextActive]}>custom</Text>
              </HapticTouchable>
            </View>
            {useCustomSub && (
              <TextInput style={[s.input, { marginTop: -12, marginBottom: 24 }]} value={customSub} onChangeText={setCustomSub} placeholder="enter subject..." placeholderTextColor={DIM} autoFocus />
            )}

            <Text style={s.fieldLabel}>difficulty</Text>
            <View style={s.chipRow}>
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <HapticTouchable key={d} style={[s.chip, difficulty === d && { borderColor: diffColor(d) + '80', backgroundColor: diffColor(d) + '15' }]} onPress={() => setDifficulty(d)} haptic="selection">
                  <Text style={[s.chipText, difficulty === d && { color: diffColor(d) }]}>{d}</Text>
                </HapticTouchable>
              ))}
            </View>

            <LinearGradient colors={[GOLD_D + '25', GOLD_D + '08']} style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={GOLD_M} />
              <Text style={s.infoText}>10 questions will be generated · challenge runs for 48 hours · anyone with the link can join</Text>
            </LinearGradient>

            <HapticTouchable
              style={[s.launchBtn, (creating || !title.trim()) && { opacity: 0.5 }]}
              onPress={doCreate}
              haptic="medium"
            >
              {creating
                ? <ActivityIndicator color={BG} />
                : <>
                    <Ionicons name="library-outline" size={15} color={BG} />
                    <Text style={s.launchBtnText}>create challenge</Text>
                  </>
              }
            </HapticTouchable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  title:  { fontFamily: 'Inter_900Black', fontSize: 22, color: GOLD_XL },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GOLD_D + '40', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: GOLD_D },
  createBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: GOLD_XL },

  tabs:         { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 3 },
  tabBtn:       { flex: 1, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10 },
  tabBtnActive: { backgroundColor: GOLD_D + '40' },
  tabLabel:     { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM },
  tabLabelActive: { color: GOLD_L },

  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  card:       { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  subjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: GOLD_D + '20', borderRadius: 7, borderWidth: 1, borderColor: GOLD_D + '40' },
  subjectText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, letterSpacing: 0.5 },
  cardTitle:  { fontFamily: 'Inter_900Black', fontSize: 17, color: GOLD_XL, lineHeight: 22 },
  cardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardCreator: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM },
  youChip:    { backgroundColor: GOLD_D + '30', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: GOLD_D },
  youChipText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: GOLD_M },
  avatarRow:  { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
  miniAvatar: { borderRadius: 13, borderWidth: 1.5, borderColor: BG },
  moreText:   { fontFamily: 'Inter_700Bold', fontSize: 10, color: DIM, marginLeft: 6 },
  progressWrap: { height: 4, backgroundColor: '#1E1A12', borderRadius: 2, overflow: 'hidden' },
  progressBar:  { height: '100%', backgroundColor: GOLD_M, borderRadius: 2 },
  progressText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, marginTop: 4 },

  joinBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: GOLD_M, borderRadius: 12, paddingVertical: 10 },
  joinBtnJoined: { backgroundColor: 'transparent', borderWidth: 1, borderColor: GOLD_D },
  joinBtnText:   { fontFamily: 'Inter_700Bold', fontSize: 13, color: BG },
  statsRow:      { flexDirection: 'row', gap: 8 },
  statChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GOLD_D + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: GOLD_D + '40' },
  statText:      { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GOLD_M },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 18, color: DIM },
  emptyHint:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM + '80' },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GOLD_D + '40', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: GOLD_D, marginTop: 12 },
  emptyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_XL },

  modal:       { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  modalTitle:  { fontFamily: 'Inter_900Black', fontSize: 24, color: GOLD_XL },
  fieldLabel:  { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, letterSpacing: 2, marginBottom: 10 },
  input:       { backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: GOLD_D, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_L, marginBottom: 24 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER },
  chipActive:  { backgroundColor: GOLD_D + '40', borderColor: GOLD_D },
  chipText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM },
  chipTextActive: { color: GOLD_L },
  infoBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: GOLD_D + '40', padding: 14, marginBottom: 24 },
  infoText:    { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM, flex: 1, lineHeight: 18 },
  launchBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: GOLD_M, borderRadius: 16, paddingVertical: 16 },
  launchBtnText: { fontFamily: 'Inter_900Black', fontSize: 15, color: BG },
});
