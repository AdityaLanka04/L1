import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import {
  getFriends, getFriendRequests, getFriendsLeaderboard,
  getQuizBattles, getChallenges, getFriendActivityFeed,
} from '../services/api';
import HapticTouchable from '../components/HapticTouchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FriendsScreen from './social/FriendsScreen';
import LeaderboardScreen from './social/LeaderboardScreen';
import GamesScreen from './social/GamesScreen';
import QuizPlaylistScreen from './social/QuizPlaylistScreen';
import PlaylistsScreen from './social/PlaylistsScreen';
import LearningPathsScreen from './social/LearningPathsScreen';
import AmbientBubbles from '../components/AmbientBubbles';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const PAD = 18;

type Section = 'friends' | 'leaderboard' | 'games' | 'quiz' | 'playlists' | 'paths';
type HubData = {
  friendCount: number;
  requestCount: number;
  myRank: number | null;
  topPlayer: string;
  activeBattles: number;
  pendingBattles: number;
  challengeCount: number;
  recentActivity: any[];
};

type Props = { user: AuthUser };

function MetricChip({ label, value }: { label: string; value: string }) {
  const { selectedTheme } = useAppTheme();
  const layout = useResponsiveLayout();
  const s = useMemo(() => createStyles(selectedTheme, layout), [selectedTheme, layout]);
  return (
    <View style={s.metricChip}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function PortalCard({
  title,
  subtitle,
  icon,
  accent,
  styles,
  textColor,
  onPress,
  tall = false,
  badge,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  styles: ReturnType<typeof createStyles>;
  textColor: string;
  onPress?: () => void;
  tall?: boolean;
  badge?: string;
}) {
  return (
    <HapticTouchable style={[styles.portalCard, tall && styles.portalCardTall]} onPress={onPress} activeOpacity={0.86} haptic="selection">
      <LinearGradient colors={[rgbaFromHex(accent, 0.1), rgbaFromHex(accent, 0)]} style={styles.portalGlow} />
      <View style={[styles.portalIcon, { borderColor: rgbaFromHex(accent, 0.44), backgroundColor: rgbaFromHex(accent, 0.1) }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      {badge ? (
        <View style={styles.portalBadge}>
          <Text style={styles.portalBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.portalTitle, { color: textColor }]}>{title}</Text>
      <Text style={styles.portalSubtitle}>{subtitle}</Text>
    </HapticTouchable>
  );
}

function activityText(item: any) {
  const actor = item?.username || item?.user_username || item?.actor_username || item?.friend_username || item?.name || 'Someone';
  const type = String(item?.activity_type || item?.type || item?.event_type || '').toLowerCase();
  const subject = item?.title || item?.subject || item?.content_title || item?.topic || '';

  if (type.includes('quiz')) return `${actor} completed a quiz${subject ? ` in ${subject}` : ''}`;
  if (type.includes('flash')) return `${actor} reviewed flashcards${subject ? ` on ${subject}` : ''}`;
  if (type.includes('note')) return `${actor} added new notes${subject ? ` for ${subject}` : ''}`;
  if (type.includes('friend')) return `${actor} made a new connection`;
  return subject ? `${actor} worked on ${subject}` : `${actor} stayed active today`;
}

function activityIcon(item: any): React.ComponentProps<typeof Ionicons>['name'] {
  const type = String(item?.activity_type || item?.type || item?.event_type || '').toLowerCase();
  if (type.includes('quiz')) return 'trophy-outline';
  if (type.includes('flash')) return 'layers-outline';
  if (type.includes('note')) return 'document-text-outline';
  if (type.includes('friend')) return 'people-outline';
  return 'sparkles-outline';
}

export default function SocialScreen({ user }: Props) {
  const { selectedTheme } = useAppTheme();
  const layout = useResponsiveLayout();
  const s = useMemo(() => createStyles(selectedTheme, layout), [selectedTheme, layout]);
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Section | null>(null);
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);

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

      const fr = friends.status === 'fulfilled' ? friends.value : null;
      const rq = requests.status === 'fulfilled' ? requests.value : null;
      const lbv = lb.status === 'fulfilled' ? lb.value : null;
      const btv = battles.status === 'fulfilled' ? battles.value : null;
      const chv = challenges.status === 'fulfilled' ? challenges.value : null;
      const fdv = feed.status === 'fulfilled' ? feed.value : null;

      const friendList = Array.isArray(fr) ? fr : fr?.friends ?? [];
      const reqList = Array.isArray(rq) ? rq : rq?.received ?? [];
      const lbList = lbv?.leaderboard ?? [];
      const battleList = btv?.battles ?? (Array.isArray(btv) ? btv : []);
      const chalList = chv?.challenges ?? (Array.isArray(chv) ? chv : []);
      const feedList = Array.isArray(fdv) ? fdv : fdv?.activities ?? fdv?.feed ?? [];
      const myRankEntry = lbv?.current_user_rank ?? lbList.find((entry: any) => entry.is_current_user);

      setData({
        friendCount: friendList.length,
        requestCount: reqList.length,
        myRank: myRankEntry?.rank ?? null,
        topPlayer: lbList[0]?.username ?? lbList[0]?.name ?? '—',
        activeBattles: battleList.filter((battle: any) => battle.status === 'active').length,
        pendingBattles: battleList.filter((battle: any) => battle.status === 'pending').length,
        challengeCount: chalList.length,
        recentActivity: feedList.slice(0, 4),
      });
    } catch {
      setData({
        friendCount: 0,
        requestCount: 0,
        myRank: null,
        topPlayer: '—',
        activeBattles: 0,
        pendingBattles: 0,
        challengeCount: 0,
        recentActivity: [],
      });
    } finally {
      setLoading(false);
    }
  }, [user.username]);

  useEffect(() => {
    load();
  }, [load]);

  if (!fontsLoaded) return null;

  if (screen === 'friends') return <FriendsScreen user={user} onBack={() => setScreen(null)} />;
  if (screen === 'leaderboard') return <LeaderboardScreen user={user} onBack={() => setScreen(null)} />;
  if (screen === 'games') return <GamesScreen user={user} onBack={() => setScreen(null)} />;
  if (screen === 'quiz') return <QuizPlaylistScreen user={user} onBack={() => setScreen(null)} />;
  if (screen === 'playlists') return <PlaylistsScreen user={user} onBack={() => setScreen(null)} />;
  if (screen === 'paths') return <LearningPathsScreen user={user} onBack={() => setScreen(null)} />;

  return (
    <View style={s.root}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
      <AmbientBubbles theme={selectedTheme} variant="social" opacity={0.9} />
      <View style={[s.glowTop, { backgroundColor: rgbaFromHex(selectedTheme.accent, 0.08) }]} pointerEvents="none" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        <View style={s.header}>
          <View>
            <Text style={s.title}>social</Text>
            <Text style={s.subtitle}>community, competition, momentum</Text>
          </View>
          <HapticTouchable style={s.headerBtn} onPress={() => setScreen('friends')} haptic="light" activeOpacity={0.82}>
            <Ionicons name="notifications-outline" size={18} color={selectedTheme.accentHover} />
            {(data?.requestCount ?? 0) > 0 ? <View style={s.notifDot} /> : null}
          </HapticTouchable>
        </View>

        {loading || !data ? (
          <View style={s.loadingCard}>
            <ActivityIndicator color={selectedTheme.accent} size="large" />
            <Text style={s.loadingText}>building your social pulse...</Text>
          </View>
        ) : (
          <>
            <LinearGradient colors={[rgbaFromHex(selectedTheme.accent, 0.10), rgbaFromHex(selectedTheme.panel, 0.985), rgbaFromHex(selectedTheme.bgPrimary, 0.995)]} locations={[0, 0.62, 1]} style={s.heroCard}>
              <View style={s.heroTopRow}>
                <View>
                  <Text style={s.heroEyebrow}>community pulse</Text>
                  <Text style={s.heroTitle}>Good to see you, {user.first_name || user.username}.</Text>
                </View>
                <View style={s.heroRankWrap}>
                  <Text style={s.heroRankValue}>{data.myRank ? `#${data.myRank}` : '—'}</Text>
                  <Text style={s.heroRankLabel}>rank</Text>
                </View>
              </View>
              <Text style={s.heroBody}>
                {data.friendCount > 0
                  ? `${data.friendCount} friends in your orbit, ${data.activeBattles} live battles, and ${data.challengeCount} challenge threads waiting for you.`
                  : 'Start building your circle, join a battle, and make the social layer feel alive.'}
              </Text>
              <View style={s.metricRow}>
                <MetricChip label="friends" value={String(data.friendCount)} />
                <MetricChip label="battles" value={String(data.activeBattles)} />
                <MetricChip label="pending" value={String(data.requestCount + data.pendingBattles)} />
              </View>
            </LinearGradient>

            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>jump back in</Text>
              <Text style={s.sectionMeta}>best player: {data.topPlayer}</Text>
            </View>

            <View style={s.portalRow}>
              <PortalCard
                title="friends"
                subtitle={data.requestCount > 0 ? `${data.requestCount} requests need attention` : 'your network and activity'}
                icon="people-outline"
                accent={selectedTheme.accentHover}
                styles={s}
                textColor={selectedTheme.accentHover}
                badge={data.requestCount > 0 ? `${data.requestCount} new` : undefined}
                onPress={() => setScreen('friends')}
              />
              <PortalCard
                title="leaderboard"
                subtitle={data.myRank ? `you are holding #${data.myRank}` : 'see where you place'}
                icon="trophy-outline"
                accent={selectedTheme.accent}
                styles={s}
                textColor={selectedTheme.accentHover}
                onPress={() => setScreen('leaderboard')}
              />
            </View>

            <PortalCard
              title="battles"
              subtitle={data.pendingBattles > 0 ? `${data.pendingBattles} incoming and ${data.activeBattles} live right now` : `${data.activeBattles} live quiz battles ready to continue`}
              icon="flash-outline"
              accent={selectedTheme.accentHover}
              styles={s}
              textColor={selectedTheme.accentHover}
              badge={data.pendingBattles > 0 ? 'hot' : undefined}
              onPress={() => setScreen('games')}
              tall
            />

            <View style={s.portalRow}>
              <PortalCard
                title="quiz hub"
                subtitle={`${data.challengeCount} shared challenge ${data.challengeCount === 1 ? 'thread' : 'threads'}`}
                icon="library-outline"
                accent={selectedTheme.accent}
                styles={s}
                textColor={selectedTheme.accent}
                onPress={() => setScreen('quiz')}
              />
              <PortalCard
                title="playlists"
                subtitle="follow smart collections"
                icon="bookmark-outline"
                accent={darkenColor(selectedTheme.accent, selectedTheme.isLight ? 16 : 34)}
                styles={s}
                textColor={darkenColor(selectedTheme.accent, selectedTheme.isLight ? 16 : 34)}
                onPress={() => setScreen('playlists')}
              />
            </View>

            <PortalCard
              title="learning paths"
              subtitle="AI-guided tracks for collaborative study momentum"
              icon="map-outline"
              accent={selectedTheme.accent}
              styles={s}
              textColor={selectedTheme.accent}
              onPress={() => setScreen('paths')}
            />

            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>recent activity</Text>
              <Text style={s.sectionMeta}>{data.recentActivity.length > 0 ? 'live feed' : 'quiet for now'}</Text>
            </View>

            <View style={s.activityCard}>
              {data.recentActivity.length === 0 ? (
                <View style={s.emptyActivity}>
                  <Ionicons name="pulse-outline" size={24} color={selectedTheme.textSecondary} />
                  <Text style={s.emptyActivityTitle}>Nothing new yet</Text>
                  <Text style={s.emptyActivityText}>Once your friends start studying, their momentum will show up here.</Text>
                </View>
              ) : (
                data.recentActivity.map((item: any, index: number) => (
                  <View key={item.id ?? `${index}-${activityText(item)}`} style={[s.activityRow, index < data.recentActivity.length - 1 && s.activityDivider]}>
                    <View style={s.activityIconWrap}>
                      <Ionicons name={activityIcon(item)} size={15} color={selectedTheme.accentHover} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.activityText}>{activityText(item)}</Text>
                      <Text style={s.activityMeta}>community activity</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme'], layout: ReturnType<typeof useResponsiveLayout>) {
  const BG = theme.bgPrimary;
  const SURFACE = theme.panel;
  const SURFACE_ALT = theme.panelAlt;
  const GOLD_XL = theme.textPrimary;
  const GOLD_L = theme.accentHover;
  const GOLD_M = theme.accent;
  const DIM = theme.textSecondary;
  const BORDER = theme.border;
  const BORDER_STRONG = theme.borderStrong;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: PAD,
    paddingTop: 18,
    gap: 14,
  },
  glowTop: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  title: { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_L, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, letterSpacing: 1.6, marginTop: 4, textTransform: 'uppercase' },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: rgbaFromHex(SURFACE_ALT, 0.88),
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
    borderWidth: 1.5,
    borderColor: BG,
  },
  loadingCard: {
    marginTop: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: rgbaFromHex(SURFACE_ALT, 0.92),
    paddingVertical: 54,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: BORDER_STRONG,
    padding: 22,
    overflow: 'hidden',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' },
  heroEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_L, letterSpacing: 1.8, textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'Inter_900Black', fontSize: 26, lineHeight: 30, color: GOLD_L, marginTop: 10, maxWidth: '78%' },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_M, lineHeight: 21, marginTop: 14 },
  heroRankWrap: {
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: rgbaFromHex(SURFACE_ALT, 0.78),
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroRankValue: { fontFamily: 'Inter_900Black', fontSize: 24, color: GOLD_L },
  heroRankLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  metricChip: {
    minWidth: layout.twoColumn ? 120 : 0,
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: rgbaFromHex(SURFACE_ALT, 0.78),
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  metricValue: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_L },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sectionTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_L, letterSpacing: -0.3 },
  sectionMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM },
  portalRow: { flexDirection: 'row', gap: 12 },
  portalCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_ALT,
    padding: 18,
    minHeight: 150,
    overflow: 'hidden',
  },
  portalCardTall: { minHeight: 168 },
  portalGlow: { ...StyleSheet.absoluteFillObject },
  portalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  portalBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 999,
    backgroundColor: rgbaFromHex(theme.accent, 0.12),
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  portalBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_L, textTransform: 'uppercase' },
  portalTitle: { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_L, letterSpacing: -0.4 },
  portalSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, lineHeight: 19, marginTop: 8 },
  activityCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  activityRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 15, alignItems: 'flex-start' },
  activityDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rgbaFromHex(theme.accentHover, 0.12),
    borderWidth: 1,
    borderColor: BORDER,
  },
  activityText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: GOLD_L, lineHeight: 19 },
  activityMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, marginTop: 4 },
  emptyActivity: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyActivityTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_M, marginTop: 12 },
  emptyActivityText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, marginTop: 8, textAlign: 'center', lineHeight: 19 },
});
}
