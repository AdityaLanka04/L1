import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_900Black, Inter_400Regular } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import {
  getFriends, getFriendRequests, getFriendsLeaderboard,
  getQuizBattles, getChallenges, getFriendActivityFeed,
} from '../services/api';
import HapticTouchable from '../components/HapticTouchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FriendsScreen       from './social/FriendsScreen';
import LeaderboardScreen   from './social/LeaderboardScreen';
import GamesScreen         from './social/GamesScreen';
import QuizPlaylistScreen  from './social/QuizPlaylistScreen';
import PlaylistsScreen     from './social/PlaylistsScreen';
import LearningPathsScreen from './social/LearningPathsScreen';

const GAP  = 12;
const PAD  = 16;

const SURFACE     = '#111111';
const GOLD_XL     = '#FFF0BC';
const GOLD_L      = '#E8CC88';
const GOLD_D      = '#8A6535';
const CARD_BORDER = GOLD_D + '55';
const TOP_GLOW    = GOLD_D + '28';

type Section = 'friends' | 'leaderboard' | 'games' | 'quiz' | 'playlists' | 'paths';
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


type Props = { user: AuthUser };

export default function SocialScreen({ user }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular });
  const insets = useSafeAreaInsets();
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
  if (screen === 'friends')     return <FriendsScreen       user={user} onBack={() => setScreen(null)} />;
  if (screen === 'leaderboard') return <LeaderboardScreen   user={user} onBack={() => setScreen(null)} />;
  if (screen === 'games')       return <GamesScreen         user={user} onBack={() => setScreen(null)} />;
  if (screen === 'quiz')        return <QuizPlaylistScreen  user={user} onBack={() => setScreen(null)} />;
  if (screen === 'playlists')   return <PlaylistsScreen     user={user} onBack={() => setScreen(null)} />;
  if (screen === 'paths')       return <LearningPathsScreen user={user} onBack={() => setScreen(null)} />;

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 8 }]}>
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={GOLD_D} size="large" />
        </View>
      ) : (
        <View style={s.content}>
          {/* Row 1 — Friends | Battles */}
          <View style={s.row}>
            <HapticTouchable style={[s.card, s.block]} onPress={() => setScreen('friends')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.blockInner}>
                <Ionicons name="people" size={26} color={GOLD_XL} />
                <Text style={s.blockTitle}>friends</Text>
                <Text style={s.blockSub}>{data.friendCount} connected{data.requestCount > 0 ? `\n${data.requestCount} pending` : ''}</Text>
              </View>
            </HapticTouchable>

            <HapticTouchable style={[s.card, s.block]} onPress={() => setScreen('games')} activeOpacity={0.75} haptic="medium">
              <CardGlow />
              <View style={s.blockInner}>
                <Ionicons name="flash" size={26} color={GOLD_XL} />
                <Text style={s.blockTitle}>battles</Text>
                <Text style={s.blockSub}>{data.activeBattles} active{data.pendingBattles > 0 ? `\n${data.pendingBattles} incoming` : ''}</Text>
              </View>
            </HapticTouchable>
          </View>

          {/* Leaderboard — full width horizontal */}
          <HapticTouchable style={[s.card, s.leaderCard]} onPress={() => setScreen('leaderboard')} activeOpacity={0.75} haptic="selection">
            <CardGlow />
            <View style={s.cardInner}>
              <Ionicons name="trophy" size={26} color={GOLD_XL} />
              <View style={s.cardText}>
                <Text style={s.cardTitle}>leaderboard</Text>
                <Text style={s.cardSub}>{data.myRank !== null ? `you're ranked #${data.myRank}` : 'see how you rank'}</Text>
              </View>
            </View>
          </HapticTouchable>

          {/* Row 2 — Quiz Hub | Playlists */}
          <View style={s.row}>
            <HapticTouchable style={[s.card, s.block]} onPress={() => setScreen('quiz')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.blockInner}>
                <Ionicons name="library" size={26} color={GOLD_XL} />
                <Text style={s.blockTitle}>quiz hub</Text>
                <Text style={s.blockSub}>group sets</Text>
              </View>
            </HapticTouchable>

            <HapticTouchable style={[s.card, s.block]} onPress={() => setScreen('playlists')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.blockInner}>
                <Ionicons name="bookmark" size={26} color={GOLD_XL} />
                <Text style={s.blockTitle}>playlists</Text>
                <Text style={s.blockSub}>discover & follow</Text>
              </View>
            </HapticTouchable>
          </View>

          {/* Row 3 — Paths | Activity */}
          <View style={s.row}>
            <HapticTouchable style={[s.card, s.block]} onPress={() => setScreen('paths')} activeOpacity={0.75} haptic="selection">
              <CardGlow />
              <View style={s.blockInner}>
                <Ionicons name="map" size={26} color={GOLD_XL} />
                <Text style={s.blockTitle}>paths</Text>
                <Text style={s.blockSub}>AI learning journeys</Text>
              </View>
            </HapticTouchable>

            <View style={[s.card, s.block]}>
              <CardGlow />
              <View style={s.blockInner}>
                <Ionicons name="pulse" size={26} color={GOLD_XL} />
                <Text style={s.blockTitle}>activity</Text>
                <Text style={s.blockSub}>{data.recentActivity.length > 0 ? `${data.recentActivity.length} recent` : 'quiet today'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: PAD },
  content: { flex: 1, gap: GAP },
  row:     { flex: 1, flexDirection: 'row', gap: GAP },

  header:   { paddingTop: 18, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
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

  block:      { flex: 1 },
  blockInner: { flex: 1, padding: 14, gap: 6, zIndex: 1, justifyContent: 'center' },
  blockTitle: { fontFamily: 'Inter_900Black', fontSize: 13, color: GOLD_XL, letterSpacing: -0.2 },
  blockSub:   { fontFamily: 'Inter_400Regular', fontSize: 10, color: GOLD_D, lineHeight: 14 },

  leaderCard: { height: 76 },
  cardInner:  { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16, zIndex: 1 },
  cardText:   { flex: 1, gap: 4 },
  cardTitle:  { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_XL, letterSpacing: -0.3 },
  cardSub:    { fontFamily: 'Inter_400Regular', fontSize: 10, color: GOLD_D, letterSpacing: 0.3 },
});
