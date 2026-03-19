import { useState, useEffect, useCallback } from 'react';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../../services/auth';
import {
  getFriends, getFriendRequests, getFriendActivityFeed,
  respondFriendRequest, searchUsers, sendFriendRequest,
  removeFriend, giveKudos,
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

const ACTIVITY_COLORS: Record<string, string> = {
  quiz:  GOLD_M,
  note:  '#7C9AC9',
  flash: '#9AC97C',
  chat:  '#C97CA8',
};
function activityColor(type = '') {
  if (type.includes('quiz'))  return ACTIVITY_COLORS.quiz;
  if (type.includes('note'))  return ACTIVITY_COLORS.note;
  if (type.includes('flash')) return ACTIVITY_COLORS.flash;
  if (type.includes('chat'))  return ACTIVITY_COLORS.chat;
  return GOLD_M;
}
function activityIcon(type = ''): React.ComponentProps<typeof Ionicons>['name'] {
  if (type.includes('quiz'))  return 'trophy';
  if (type.includes('note'))  return 'document-text';
  if (type.includes('flash')) return 'layers';
  if (type.includes('chat'))  return 'chatbubble';
  return 'star';
}

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

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
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

export default function FriendsScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [tab, setTab]               = useState<'friends' | 'requests' | 'activity'>('friends');
  const [friends, setFriends]       = useState<any[]>([]);
  const [requests, setRequests]     = useState<any[]>([]);
  const [feed, setFeed]             = useState<any[]>([]);
  const [searchQ, setSearchQ]       = useState('');
  const [results, setResults]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching]   = useState(false);
  const [sentIds, setSentIds]       = useState<Set<string>>(new Set());
  const [kudosSent, setKudosSent]   = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const [fr, rq, fd] = await Promise.all([
        getFriends(user.username),
        getFriendRequests(user.username),
        getFriendActivityFeed(user.username),
      ]);
      setFriends(Array.isArray(fr) ? fr : fr?.friends ?? []);
      setRequests(Array.isArray(rq) ? rq : rq?.received ?? []);
      setFeed(Array.isArray(fd) ? fd : fd?.activities ?? fd?.feed ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const doSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const d = await searchUsers(user.username, q.trim());
      setResults(Array.isArray(d) ? d : d?.users ?? []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const doRespond = async (id: number, action: 'accept' | 'decline') => {
    try {
      await respondFriendRequest(user.username, id, action);
      setRequests(p => p.filter((r: any) => r.id !== id));
      if (action === 'accept') load();
    } catch {}
  };

  const doSend = async (targetUsername: string) => {
    try {
      await sendFriendRequest(user.username, targetUsername);
      setSentIds(p => new Set([...p, targetUsername]));
    } catch {}
  };

  const doRemove = (friendId: number, name: string) => {
    Alert.alert('Remove friend', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await removeFriend(user.username, friendId); load(); } catch {}
      }},
    ]);
  };

  const doKudos = async (friendId: number) => {
    if (kudosSent.has(friendId)) return;
    try {
      await giveKudos(user.username, friendId);
      setKudosSent(p => new Set([...p, friendId]));
    } catch {}
  };

  const fname    = (f: any) => f.username || f.friend_username || f.name || '?';
  const fstreak  = (f: any) => f.streak ?? f.current_streak ?? 0;
  const fmaster  = (f: any) => f.mastered ?? f.total_mastered ?? 0;

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

      {/* Left edge word */}
      <View style={s.edgeStrip} pointerEvents="none">
        {'FRIENDS'.split('').map((ch, i) => (
          <Text key={i} style={s.edgeLetter}>{ch}</Text>
        ))}
      </View>

      {/* Header */}
      <View style={s.header}>
        <HapticTouchable onPress={onBack} style={s.backBtn} haptic="light">
          <Ionicons name="chevron-back" size={18} color={GOLD_M} />
        </HapticTouchable>
        <Text style={s.title}>friends</Text>
        {requests.length > 0 && (
          <View style={s.requestBadge}>
            <Text style={s.requestBadgeText}>{requests.length} new</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <LinearGradient colors={[GOLD_D + '60', GOLD_D + '20']} style={s.searchBorder}>
          <View style={s.searchInner}>
            <Ionicons name="search-outline" size={14} color={GOLD_D} />
            <TextInput
              style={s.searchInput}
              value={searchQ}
              onChangeText={doSearch}
              placeholder="find people..."
              placeholderTextColor={DIM}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching
              ? <ActivityIndicator size="small" color={GOLD_M} />
              : searchQ.length > 0 && (
                  <HapticTouchable onPress={() => { setSearchQ(''); setResults([]); }} haptic="light">
                    <Ionicons name="close-circle" size={15} color={DIM} />
                  </HapticTouchable>
                )
            }
          </View>
        </LinearGradient>
      </View>

      {/* Search results */}
      {results.length > 0 && (
        <View style={s.resultsSheet}>
          {results.map((r: any, i: number) => {
            const uname = r.username || r.name || '?';
            const sent  = sentIds.has(uname);
            return (
              <View key={r.id ?? i} style={[s.resultRow, i < results.length - 1 && s.resultDivider]}>
                <Avatar name={uname} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName}>{uname}</Text>
                  {r.email && <Text style={s.resultSub}>{r.email}</Text>}
                </View>
                <HapticTouchable
                  style={[s.addChip, sent && s.addChipSent]}
                  onPress={() => !sent && doSend(uname)}
                  haptic="medium"
                >
                  <Text style={[s.addChipText, sent && { color: GOLD_D }]}>{sent ? 'sent' : '+ add'}</Text>
                </HapticTouchable>
              </View>
            );
          })}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['friends', 'requests', 'activity'] as const).map(t => (
          <HapticTouchable key={t} style={s.tabItem} onPress={() => setTab(t)} haptic="selection">
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t}{t === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}
            </Text>
            {tab === t && <View style={s.tabLine} />}
          </HapticTouchable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD_M} />}
      >
        {/* Friends tab */}
        {tab === 'friends' && (
          friends.length === 0 ? (
            <View style={empty.wrap}>
              <LinearGradient colors={[GOLD_D + '30', GOLD_D + '0A']} style={empty.icon}>
                <Ionicons name="people-outline" size={40} color={GOLD_D} />
              </LinearGradient>
              <Text style={empty.title}>no friends yet</Text>
              <Text style={empty.hint}>search above to connect with people</Text>
            </View>
          ) : friends.map((f: any, i: number) => {
            const streak  = fstreak(f);
            const mastered = fmaster(f);
            const kudosed  = kudosSent.has(f.id);
            return (
              <View key={f.id ?? i} style={fc.wrap}>
                <View style={fc.accent} />
                <View style={fc.body}>
                  <View style={fc.row}>
                    <Avatar name={fname(f)} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={fc.name}>{fname(f)}</Text>
                      <View style={fc.chips}>
                        {streak > 0 && (
                          <View style={fc.streakChip}>
                            <Ionicons name="flame" size={10} color="#FF8C42" />
                            <Text style={fc.streakText}>{streak}</Text>
                          </View>
                        )}
                        {mastered > 0 && (
                          <View style={fc.masterChip}>
                            <Ionicons name="star" size={10} color={GOLD_M} />
                            <Text style={fc.masterText}>{mastered}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={fc.actions}>
                      <HapticTouchable
                        style={[fc.iconBtn, kudosed && fc.iconBtnActive]}
                        onPress={() => doKudos(f.id)}
                        haptic="light"
                      >
                        <Ionicons name={kudosed ? 'heart' : 'heart-outline'} size={15} color={kudosed ? '#FF6B8A' : DIM} />
                      </HapticTouchable>
                      <HapticTouchable style={fc.iconBtn} onPress={() => doRemove(f.id, fname(f))} haptic="warning">
                        <Ionicons name="person-remove-outline" size={14} color={DIM} />
                      </HapticTouchable>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          requests.length === 0 ? (
            <View style={empty.wrap}>
              <LinearGradient colors={[GOLD_D + '30', GOLD_D + '0A']} style={empty.icon}>
                <Ionicons name="mail-outline" size={40} color={GOLD_D} />
              </LinearGradient>
              <Text style={empty.title}>no pending requests</Text>
              <Text style={empty.hint}>friend requests will appear here</Text>
            </View>
          ) : requests.map((r: any, i: number) => (
            <View key={r.id ?? i} style={rq.wrap}>
              <View style={rq.accent} />
              <View style={rq.body}>
                <View style={rq.row}>
                  <Avatar name={r.sender_username || r.name || '?'} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={rq.name}>{r.sender_username || r.name}</Text>
                    <Text style={rq.sub}>wants to connect</Text>
                  </View>
                </View>
                <View style={rq.actions}>
                  <HapticTouchable style={{ flex: 1 }} onPress={() => doRespond(r.id, 'accept')} haptic="success">
                    <LinearGradient colors={[GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rq.acceptBtn}>
                      <Text style={rq.acceptText}>accept</Text>
                    </LinearGradient>
                  </HapticTouchable>
                  <HapticTouchable style={rq.declineBtn} onPress={() => doRespond(r.id, 'decline')} haptic="warning">
                    <Text style={rq.declineText}>decline</Text>
                  </HapticTouchable>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          feed.length === 0 ? (
            <View style={empty.wrap}>
              <LinearGradient colors={[GOLD_D + '30', GOLD_D + '0A']} style={empty.icon}>
                <Ionicons name="pulse-outline" size={40} color={GOLD_D} />
              </LinearGradient>
              <Text style={empty.title}>all quiet</Text>
              <Text style={empty.hint}>your friends' activity will appear here</Text>
            </View>
          ) : feed.map((item: any, i: number) => {
            const color = activityColor(item.activity_type);
            const icon  = activityIcon(item.activity_type);
            return (
              <View key={item.id ?? i} style={af.row}>
                {i < feed.length - 1 && <View style={af.line} />}
                <View style={[af.iconWrap, { backgroundColor: color + '18', borderColor: color + '50' }]}>
                  <Ionicons name={icon} size={13} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={af.text}>
                    <Text style={af.bold}>{item.user ?? item.username} </Text>
                    <Text style={af.dim}>{item.action ?? item.activity_type ?? 'studied'}</Text>
                    {(item.topic ?? item.content) && (
                      <Text style={[af.topic, { color }]}>  {item.topic ?? item.content}</Text>
                    )}
                  </Text>
                  <Text style={af.time}>{item.time ?? item.time_ago ?? ''}</Text>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  edgeStrip:  { position: 'absolute', left: 0, top: 160, bottom: 0, width: 68, flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', zIndex: 0 },
  edgeLetter: { fontFamily: 'Inter_900Black', fontSize: 68, color: GOLD_XL, opacity: 0.055 },

  header:       { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 20, paddingTop: 18, paddingBottom: 10, gap: 10 },
  backBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: SURFACE + 'CC', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  title:        { fontFamily: 'Inter_900Black', fontSize: 26, color: GOLD_XL, flex: 1, letterSpacing: -0.5 },
  requestBadge: { backgroundColor: GOLD_D + '30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: BORDER },
  requestBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: GOLD_M },

  searchWrap:   { paddingLeft: 20, paddingRight: 20, marginBottom: 14 },
  searchBorder: { borderRadius: 14, padding: 1 },
  searchInner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141008', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  searchInput:  { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_L },

  resultsSheet:  { marginLeft: 20, marginRight: 20, backgroundColor: '#161208', borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 12, overflow: 'hidden' },
  resultRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  resultDivider: { borderBottomWidth: 1, borderBottomColor: GOLD_D + '20' },
  resultName:    { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: GOLD_L },
  resultSub:     { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 1 },
  addChip:       { backgroundColor: GOLD_D + '30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  addChipSent:   { backgroundColor: 'transparent', borderColor: GOLD_D + '25' },
  addChipText:   { fontFamily: 'Inter_700Bold', fontSize: 12, color: GOLD_XL },

  tabRow:       { flexDirection: 'row', paddingLeft: 20, paddingRight: 20, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: GOLD_D + '20' },
  tabItem:      { flex: 1, alignItems: 'center', paddingBottom: 10, position: 'relative' },
  tabText:      { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: DIM },
  tabTextActive: { color: GOLD_XL },
  tabLine:      { position: 'absolute', bottom: -1, left: '10%', right: '10%', height: 2, backgroundColor: GOLD_M, borderRadius: 1 },

  list: { paddingLeft: 20, paddingRight: 20, gap: 8, paddingBottom: 48 },
});

const fc = StyleSheet.create({
  wrap:     { flexDirection: 'row', backgroundColor: SURFACE + 'CC', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_D + '20' },
  accent:   { width: 3, backgroundColor: GOLD_D },
  body:     { flex: 1, padding: 14 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name:     { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_XL },
  chips:    { flexDirection: 'row', gap: 6, marginTop: 6 },
  streakChip:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FF8C4215', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#FF8C4235' },
  streakText:  { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FF8C42' },
  masterChip:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: GOLD_D + '20', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: BORDER },
  masterText:  { fontFamily: 'Inter_700Bold', fontSize: 10, color: GOLD_M },
  actions:     { gap: 6 },
  iconBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: '#FF6B8A15', borderColor: '#FF6B8A35' },
});

const rq = StyleSheet.create({
  wrap:    { flexDirection: 'row', backgroundColor: SURFACE + 'CC', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_D + '30' },
  accent:  { width: 3, backgroundColor: GOLD_M },
  body:    { flex: 1, padding: 14, gap: 12 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name:    { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_XL },
  sub:     { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0A0908' },
  declineBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: GOLD_D + '30', paddingVertical: 10 },
  declineText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: DIM },
});

const af = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 12, paddingVertical: 6, position: 'relative' },
  line:     { position: 'absolute', left: 71, top: 36, bottom: -6, width: 1, backgroundColor: GOLD_D + '20' },
  iconWrap: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  text:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_L, lineHeight: 20 },
  bold:     { fontFamily: 'Inter_700Bold', color: GOLD_XL },
  dim:      { color: DIM },
  topic:    { fontFamily: 'Inter_600SemiBold' },
  time:     { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, marginTop: 3 },
});

const empty = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: 64, gap: 14 },
  icon:  { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD_D + '40' },
  title: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  hint:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, textAlign: 'center', paddingHorizontal: 24 },
});
