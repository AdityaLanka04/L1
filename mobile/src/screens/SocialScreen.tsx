import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import {
  getFriends, getFriendRequests, getFriendsLeaderboard,
  getQuizBattles, getChallenges, getFriendActivityFeed,
} from '../services/api';
import HapticTouchable from '../components/HapticTouchable';
import FriendsScreen      from './social/FriendsScreen';
import LeaderboardScreen  from './social/LeaderboardScreen';
import GamesScreen        from './social/GamesScreen';
import QuizPlaylistScreen from './social/QuizPlaylistScreen';

const GAP  = 12;
const PAD  = 16;

const SURFACE     = '#111111';
const GOLD_XL     = '#FFF0BC';
const GOLD_L      = '#E8CC88';
const GOLD_D      = '#8A6535';
const CARD_BORDER = GOLD_D + '55';
const TOP_GLOW    = GOLD_D + '28';

type Section = 'friends' | 'leaderboard' | 'games' | 'quiz';
type HubData = {
  friendCount:    number;
  requestCount:   number;
  myRank:         number | null;
  topPlayer:      string;
  activeBattles:  number;
  pendingBattles: number;
  challengeCount: number;
  recentActivity: any[];
};

function CardGlow() {
  return (
    <LinearGradient
      colors={[TOP_GLOW, 'transparent']}
      style={s.cardGlow}
      pointerEvents="none"
    />
  );
}

function Avatar({ name, size = 18 }: { name: string; size?: number }) {
  const initials = (name || '?').split(/[\s_]/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <LinearGradient
      colors={[GOLD_D + '80', GOLD_D + '30']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD_D + '80' }}
    >
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: size * 0.38, color: GOLD_L }}>{initials}</Text>
    </LinearGradient>
  );
}

type Props = { user: AuthUser };

export default function SocialScreen({ user }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [screen, setScreen]         = useState<Section | null>(null);
  const [data, setData]             = useState<HubData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friends, requests, lb, battles, challenges, feed] = await Promise.allSettled([
        getFriends(user.username),
        getFriendRequests(user.username),
        getFriendsLeaderboard(user.username),
        getQuizBattles(user.username),
        getChallenges(user.username),
        getFriendActivityFeed(user.username),
      ]);

      const fr  = friends.status    === 'fulfilled' ? friends.value    : null;
      const rq  = requests.status   === 'fulfilled' ? requests.value   : null;
      const lbv = lb.status         === 'fulfilled' ? lb.value         : null;
      const btv = battles.status    === 'fulfilled' ? battles.value    : null;
      const chv = challenges.status === 'fulfilled' ? challenges.value : null;
      const fdv = feed.status       === 'fulfilled' ? feed.value       : null;

      const friendList  = Array.isArray(fr) ? fr : fr?.friends ?? [];
      const reqList     = Array.isArray(rq) ? rq : rq?.received ?? [];
      const lbList      = lbv?.leaderboard ?? [];
      const battleList  = btv?.battles ?? (Array.isArray(btv) ? btv : []);
      const chalList    = chv?.challenges ?? (Array.isArray(chv) ? chv : []);
      const feedList    = Array.isArray(fdv) ? fdv : fdv?.activities ?? fdv?.feed ?? [];
      const myRankEntry = lbv?.current_user_rank ?? lbList.find((e: any) => e.is_current_user);

      setData({
        friendCount:    friendList.length,
        requestCount:   reqList.length,
        myRank:         myRankEntry?.rank ?? null,
        topPlayer:      lbList[0]?.username ?? lbList[0]?.name ?? '—',
        activeBattles:  battleList.filter((b: any) => b.status === 'active').length,
        pendingBattles: battleList.filter((b: any) => b.status === 'pending').length,
        challengeCount: chalList.length,
        recentActivity: feedList.slice(0, 3),
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (!fontsLoaded) return null;

  // Sub-screen routing
  if (screen === 'friends')     return <FriendsScreen      user={user} onBack={() => setScreen(null)} />;
  if (screen === 'leaderboard') return <LeaderboardScreen  user={user} onBack={() => setScreen(null)} />;
  if (screen === 'games')       return <GamesScreen        user={user} onBack={() => setScreen(null)} />;
  if (screen === 'quiz')        return <QuizPlaylistScreen user={user} onBack={() => setScreen(null)} />;

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD_D} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>social</Text>
          <Text style={s.subtitle}>your community</Text>
        </View>
        <HapticTouchable style={s.notifBtn} onPress={() => setScreen('friends')} haptic="light">
          <Ionicons name="notifications-outline" size={18} color={GOLD_D} />
          {(data?.requestCount ?? 0) > 0 && <View style={s.notifDot} />}
        </HapticTouchable>
      </View>

      {loading || !data ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={GOLD_D} size="large" />
        </View>
      ) : (
        <>
          {/* Row 1 — Friends | Leaderboard */}
          <View style={s.row}>
            <HapticTouchable style={[s.card, s.halfCard]} onPress={() => setScreen('friends')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.cardInner}>
                <Text style={s.cardLabel}>FRIENDS</Text>
                <Text style={s.cardStat}>{data.friendCount}</Text>
                <Text style={s.cardUnit}>CONNECTED</Text>
                <View style={s.cardDivider} />
                {data.requestCount > 0 ? (
                  <View style={s.requestRow}>
                    <View style={s.requestDot} />
                    <Text style={s.cardHint}>{data.requestCount} pending</Text>
                  </View>
                ) : (
                  <Text style={s.cardHint}>view all</Text>
                )}
              </View>
            </HapticTouchable>

            <HapticTouchable style={[s.card, s.halfCard]} onPress={() => setScreen('leaderboard')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.cardInner}>
                <Text style={s.cardLabel}>LEADERBOARD</Text>
                <Text style={s.cardStat}>{data.myRank !== null ? `#${data.myRank}` : '—'}</Text>
                <Text style={s.cardUnit}>YOUR RANK</Text>
                <View style={s.cardDivider} />
                <View style={s.topRow}>
                  <Ionicons name="star" size={8} color="#FFD700" />
                  <Text style={s.cardHint} numberOfLines={1}> {data.topPlayer}</Text>
                </View>
              </View>
            </HapticTouchable>
          </View>

          {/* Battles — feature tile */}
          <HapticTouchable style={[s.card, s.full, s.featureTile]} onPress={() => setScreen('games')} activeOpacity={0.75} haptic="medium">
            <CardGlow />
            <View style={s.featureInner}>
              <View style={s.featureTopRow}>
                <Text style={s.featureEyebrow}>CHALLENGE FRIENDS</Text>
                {data.pendingBattles > 0 && (
                  <View style={s.featureBadge}>
                    <Text style={s.featureBadgeText}>{data.pendingBattles} INCOMING</Text>
                  </View>
                )}
              </View>
              <Text style={s.featureTitle}>battles</Text>
              <View style={s.cardDivider} />
              <View style={s.statsRow}>
                {[
                  { val: String(data.activeBattles),  lbl: 'ACTIVE'  },
                  { val: String(data.pendingBattles), lbl: 'PENDING' },
                  { val: '1v1',                        lbl: 'FORMAT'  },
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

          {/* Row 2 — Quiz Hub | Activity */}
          <View style={s.row}>
            <HapticTouchable style={[s.card, { flex: 1, height: 130 }]} onPress={() => setScreen('quiz')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.cardInner}>
                <Text style={s.cardLabel}>QUIZ HUB</Text>
                <Text style={s.bottomStat}>{data.challengeCount}</Text>
                <Text style={s.bottomLbl}>group sets</Text>
              </View>
            </HapticTouchable>

            <View style={[s.card, { flex: 1, height: 130 }]}>
              <CardGlow />
              <View style={s.cardInner}>
                <Text style={s.cardLabel}>ACTIVITY</Text>
                {data.recentActivity.length === 0 ? (
                  <Text style={[s.bottomLbl, { marginTop: 8 }]}>quiet today</Text>
                ) : (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {data.recentActivity.slice(0, 2).map((a: any, i: number) => (
                      <View key={i} style={s.feedRow}>
                        <Avatar name={a.user ?? a.username ?? '?'} />
                        <Text style={s.feedText} numberOfLines={1}>{a.user ?? a.username}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Quick actions */}
          <View style={s.card}>
            <CardGlow />
            <View style={[s.quickStrip]}>
              {([
                { icon: 'person-add-outline', label: 'ADD',       sc: 'friends'     },
                { icon: 'flash-outline',       label: 'CHALLENGE', sc: 'games'       },
                { icon: 'library-outline',     label: 'NEW SET',   sc: 'quiz'        },
                { icon: 'trophy-outline',      label: 'RANKINGS',  sc: 'leaderboard' },
              ] as const).map((q) => (
                <HapticTouchable key={q.label} style={s.quickBtn} onPress={() => setScreen(q.sc)} haptic="light">
                  <Ionicons name={q.icon} size={18} color={GOLD_D} />
                  <Text style={s.quickLabel}>{q.label}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: PAD, paddingBottom: 24, gap: GAP },
  row:    { flexDirection: 'row', gap: GAP },
  full:   { width: '100%' },

  header:   { paddingTop: 18, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:    { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_XL },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: GOLD_L, letterSpacing: 3, marginTop: 3 },
  notifBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF5350', borderWidth: 1.5, borderColor: '#100D07' },

  card: {
    borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER,
    backgroundColor: SURFACE, overflow: 'hidden',
    shadowColor: GOLD_D, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
    position: 'relative',
  },
  cardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 72, zIndex: 0 },

  halfCard:    { flex: 1, height: 170 },
  cardInner:   { flex: 1, padding: 16, justifyContent: 'space-between', zIndex: 1 },
  cardLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_XL, letterSpacing: 2.5 },
  cardStat:    { fontFamily: 'Inter_900Black', fontSize: 46, color: GOLD_XL, lineHeight: 50, marginTop: 10 },
  cardUnit:    { fontFamily: 'Inter_400Regular', fontSize: 8, color: GOLD_L, letterSpacing: 2, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: GOLD_D + '30', marginVertical: 10 },
  cardHint:    { fontFamily: 'Inter_400Regular', fontSize: 9, color: GOLD_L, letterSpacing: 1 },
  requestRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF5350' },
  topRow:      { flexDirection: 'row', alignItems: 'center' },

  featureTile:    { height: 180 },
  featureInner:   { flex: 1, padding: 20, justifyContent: 'space-between', zIndex: 1 },
  featureTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featureEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: GOLD_L, letterSpacing: 2.5 },
  featureBadge:   { backgroundColor: GOLD_D + '25', borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  featureBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: GOLD_L, letterSpacing: 2 },
  featureTitle:   { fontFamily: 'Inter_900Black', fontSize: 36, color: GOLD_XL, lineHeight: 40, marginTop: 6 },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat:     { flex: 1, alignItems: 'center', gap: 3 },
  statSep:  { width: 1, height: 28, backgroundColor: GOLD_D + '35' },
  statVal:  { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_XL, lineHeight: 24 },
  statLbl:  { fontFamily: 'Inter_400Regular', fontSize: 7, color: GOLD_L, letterSpacing: 1.5 },

  bottomStat: { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_XL, lineHeight: 34, marginTop: 6 },
  bottomLbl:  { fontFamily: 'Inter_400Regular', fontSize: 9, color: GOLD_L, letterSpacing: 1, marginTop: 2 },

  feedRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: GOLD_L, flex: 1 },

  quickStrip: { flexDirection: 'row', padding: 6, zIndex: 1 },
  quickBtn:   { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 12 },
  quickLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: GOLD_D, letterSpacing: 1.5 },
});
