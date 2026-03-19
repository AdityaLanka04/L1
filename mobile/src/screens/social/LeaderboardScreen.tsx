import { useState, useEffect, useCallback } from 'react';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../../services/auth';
import { getFriendsLeaderboard, getGlobalLeaderboard } from '../../services/api';
import HapticTouchable from '../../components/HapticTouchable';

const { width: SW } = Dimensions.get('window');

const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#8A6535';
const DIM     = '#4A3E2A';
const SURFACE = '#111111';
const BORDER  = GOLD_D + '40';

const MEDAL = {
  gold:   { ring: '#FFD700', bar: 80, size: 60 },
  silver: { ring: '#D0D0D0', bar: 58, size: 50 },
  bronze: { ring: '#CD8B3A', bar: 42, size: 44 },
} as const;
type MedalKey = keyof typeof MEDAL;
const MEDALS: MedalKey[] = ['gold', 'silver', 'bronze'];

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

function Avatar({ name, size = 44, medal }: { name: string; size?: number; medal?: MedalKey }) {
  const initials = (name || '?').split(/[\s_]/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const ringColor = medal ? MEDAL[medal].ring : '#C9A87C';
  return (
    <LinearGradient
      colors={[ringColor, GOLD_D]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, padding: 2.5, alignItems: 'center', justifyContent: 'center' }}
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

export default function LeaderboardScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [tab, setTab]               = useState<'global' | 'friends'>('global');
  const [friends, setFriends]       = useState<any[]>([]);
  const [global, setGlobal]         = useState<any[]>([]);
  const [myRank, setMyRank]         = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [fr, gl] = await Promise.all([getFriendsLeaderboard(user.username), getGlobalLeaderboard(50)]);
      const fList = fr?.leaderboard ?? [];
      setFriends(fList);
      setMyRank(fr?.current_user_rank ?? fList.find((e: any) => e.is_current_user));
      setGlobal(gl?.leaderboard ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const list    = tab === 'friends' ? friends : global;
  const top3    = list.slice(0, 3);
  const rest    = list.slice(3);
  const dname   = (e: any) => e.username || e.name || '?';
  const dscore  = (e: any) => e.score ?? e.total_points ?? e.points ?? 0;
  const dstreak = (e: any) => e.streak ?? e.current_streak ?? 0;

  if (!fontsLoaded) return null;

  if (loading) return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#120E06', '#0A0906', '#080808']} style={StyleSheet.absoluteFillObject} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={GOLD_M} size="large" />
      </View>
    </View>
  );

  const podiumOrder: [any, MedalKey][] = [
    [top3[1], 'silver'],
    [top3[0], 'gold'],
    [top3[2], 'bronze'],
  ];

  return (
    <View style={s.root}>
      <LinearGradient colors={['#120E06', '#0A0906', '#080808']} style={StyleSheet.absoluteFillObject} />
      <DotGrid />

      {/* Left edge word */}
      <View style={s.edgeStrip} pointerEvents="none">
        {'RANKS'.split('').map((ch, i) => (
          <Text key={i} style={s.edgeLetter}>{ch}</Text>
        ))}
      </View>

      {/* Header */}
      <View style={s.header}>
        <HapticTouchable onPress={onBack} style={s.backBtn} haptic="light">
          <Ionicons name="chevron-back" size={18} color={GOLD_M} />
        </HapticTouchable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>leaderboard</Text>
          {myRank && (
            <Text style={s.subtitle}>your rank <Text style={{ color: GOLD_XL, fontFamily: 'Inter_700Bold' }}>#{myRank.rank ?? myRank}</Text></Text>
          )}
        </View>
        <View style={s.trophyWrap}>
          <Ionicons name="trophy" size={18} color="#FFD700" />
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['global', 'friends'] as const).map(t => (
          <HapticTouchable key={t} style={s.tabItem} onPress={() => setTab(t)} haptic="selection">
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
            {tab === t && <View style={s.tabLine} />}
          </HapticTouchable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD_M} />}
      >
        {list.length === 0 ? (
          <View style={empty.wrap}>
            <LinearGradient colors={[GOLD_D + '30', GOLD_D + '0A']} style={empty.icon}>
              <Ionicons name="trophy-outline" size={40} color={GOLD_D} />
            </LinearGradient>
            <Text style={empty.title}>no rankings yet</Text>
          </View>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <View style={pod.wrap}>
                <LinearGradient colors={[GOLD_D + '18', 'transparent']} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
                {podiumOrder.map(([entry, medal]) => {
                  if (!entry) return null;
                  const m = MEDAL[medal];
                  const label = medal === 'gold' ? '1st' : medal === 'silver' ? '2nd' : '3rd';
                  return (
                    <View key={medal} style={[pod.entry, medal === 'gold' && pod.entryFirst]}>
                      {medal === 'gold' && <Ionicons name="trophy" size={16} color="#FFD700" style={{ marginBottom: 6 }} />}
                      <Avatar name={dname(entry)} size={m.size} medal={medal} />
                      <View style={[pod.badge, { borderColor: m.ring + '70', backgroundColor: m.ring + '20' }]}>
                        <Text style={[pod.badgeText, { color: m.ring }]}>{label}</Text>
                      </View>
                      <Text style={pod.name} numberOfLines={1}>{dname(entry)}</Text>
                      <Text style={pod.score}>{dscore(entry).toLocaleString()}</Text>
                      <LinearGradient colors={[m.ring + '35', m.ring + '10']} style={[pod.bar, { height: m.bar, borderTopColor: m.ring + '60' }]} />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Rest of list */}
            {rest.length > 0 && (
              <View style={{ gap: 6 }}>
                {rest.map((e: any, i: number) => {
                  const rank    = i + 4;
                  const isMe    = e.is_current_user;
                  const score   = dscore(e);
                  const streak  = dstreak(e);
                  const maxScore = dscore(list[0]) || 1;
                  const pct     = Math.min(1, score / maxScore);

                  return (
                    <View key={e.id ?? i} style={[row.wrap, isMe && row.wrapMe]}>
                      {isMe && <LinearGradient colors={[GOLD_D + '30', GOLD_D + '08']} style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]} />}
                      <Text style={[row.rank, isMe && { color: GOLD_XL }]}>
                        {rank <= 9 ? `0${rank}` : rank}
                      </Text>
                      <Avatar name={dname(e)} size={36} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[row.name, isMe && { color: GOLD_XL }]}>
                          {dname(e)}{isMe ? '  (you)' : ''}
                        </Text>
                        <View style={row.track}>
                          <LinearGradient
                            colors={isMe ? [GOLD_M, GOLD_D] : [GOLD_D + '60', GOLD_D + '25']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={[row.fill, { width: `${Math.max(4, pct * 100)}%` as any }]}
                          />
                        </View>
                      </View>
                      <View style={row.right}>
                        <Text style={[row.score, isMe && { color: GOLD_XL }]}>
                          {score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score}
                        </Text>
                        {streak > 0 && (
                          <View style={row.streakPill}>
                            <Ionicons name="flame" size={9} color="#FF8C42" />
                            <Text style={row.streakText}>{streak}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  edgeStrip:  { position: 'absolute', left: 0, top: 120, bottom: 0, width: 68, flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', zIndex: 0 },
  edgeLetter: { fontFamily: 'Inter_900Black', fontSize: 88, color: GOLD_XL, opacity: 0.055 },

  header:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 20, paddingTop: 18, paddingBottom: 10, gap: 10 },
  backBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: SURFACE + 'CC', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  title:     { fontFamily: 'Inter_900Black', fontSize: 26, color: GOLD_XL, letterSpacing: -0.5 },
  subtitle:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 2 },
  trophyWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: GOLD_D + '25', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },

  tabRow:       { flexDirection: 'row', paddingLeft: 20, paddingRight: 20, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: GOLD_D + '20' },
  tabItem:      { flex: 1, alignItems: 'center', paddingBottom: 10, position: 'relative' },
  tabText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM },
  tabTextActive: { color: GOLD_XL },
  tabLine:      { position: 'absolute', bottom: -1, left: '15%', right: '15%', height: 2, backgroundColor: GOLD_M, borderRadius: 1 },

  scroll: { paddingLeft: 20, paddingRight: 20, paddingTop: 4, gap: 0 },
});

const pod = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 24, gap: 4, paddingTop: 20, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  entry:      { flex: 1, alignItems: 'center', gap: 0 },
  entryFirst: {},
  badge:      { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8, marginBottom: 4 },
  badgeText:  { fontFamily: 'Inter_900Black', fontSize: 10 },
  name:       { fontFamily: 'Inter_700Bold', fontSize: 11, color: GOLD_L, textAlign: 'center', paddingHorizontal: 4 },
  score:      { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, marginBottom: 8, marginTop: 2 },
  bar:        { width: '100%', borderTopWidth: 1.5, borderRadius: 4 },
});

const row = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: GOLD_D + '20', backgroundColor: SURFACE + '80', overflow: 'hidden', position: 'relative', marginBottom: 6 },
  wrapMe:  { borderColor: GOLD_D + '55' },
  rank:    { fontFamily: 'Inter_900Black', fontSize: 13, color: DIM, width: 26, textAlign: 'center' },
  name:    { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: GOLD_L },
  track:   { height: 3, backgroundColor: GOLD_D + '20', borderRadius: 2, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 2 },
  right:   { alignItems: 'flex-end', gap: 4 },
  score:   { fontFamily: 'Inter_700Bold', fontSize: 15, color: GOLD_M },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FF8C4215', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  streakText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FF8C42' },
});

const empty = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: 80, gap: 14 },
  icon:  { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD_D + '40' },
  title: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
});
