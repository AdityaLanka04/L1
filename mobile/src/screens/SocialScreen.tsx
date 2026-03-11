import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getFriends, getFriendRequests, getFriendActivityFeed, respondFriendRequest, searchUsers } from '../services/api';

const BG = '#0A0A0A';
const CARD = '#111111';
const GOLD_LIGHT = '#FFE8A0';
const GOLD_MID = '#C9A87C';
const GOLD_DARK = '#7A5C2E';
const DIM = '#5A5040';
const BORDER = '#1E1E1E';

type Props = { user: AuthUser };

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

export default function SocialScreen({ user }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [friendsData, requestsData, feedData] = await Promise.all([
        getFriends(user.username),
        getFriendRequests(user.username),
        getFriendActivityFeed(user.username),
      ]);
      setFriends(Array.isArray(friendsData) ? friendsData : (friendsData?.friends ?? []));
      setRequests(Array.isArray(requestsData) ? requestsData : (requestsData?.received ?? []));
      setFeed(Array.isArray(feedData) ? feedData : (feedData?.activities ?? feedData?.feed ?? []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.username]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    try {
      const data = await searchUsers(user.username, q.trim());
      setSearchResults(Array.isArray(data) ? data : (data?.users ?? []));
    } catch { setSearchResults([]); }
  };

  const handleRespond = async (requestId: number, action: 'accept' | 'decline') => {
    try {
      await respondFriendRequest(user.username, requestId, action);
      setRequests(prev => prev.filter((r: any) => r.id !== requestId));
      if (action === 'accept') loadData();
    } catch {}
  };

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={GOLD_MID} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const friendName = (f: any) => f.username || f.name || f.friend_username || 'Unknown';
  const friendStreak = (f: any) => f.streak ?? f.current_streak ?? 0;
  const friendMastered = (f: any) => f.mastered ?? f.total_mastered ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD_MID} />}
      >
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>social</Text>
          <Ionicons name="person-add-outline" size={20} color={GOLD_MID} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={14} color={DIM} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="find people..."
            placeholderTextColor={DIM}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {searchResults.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>results</Text>
            {searchResults.map((r: any, i: number) => (
              <View key={r.id ?? i} style={styles.card}>
                <Avatar name={r.username ?? r.name ?? '?'} />
                <Text style={[styles.friendName, { flex: 1 }]}>{r.username ?? r.name}</Text>
                <TouchableOpacity style={styles.btnAccept}>
                  <Ionicons name="person-add-outline" size={14} color={GOLD_LIGHT} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {requests.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>requests · {requests.length}</Text>
            {requests.map((r: any, i: number) => (
              <View key={r.id ?? i} style={styles.card}>
                <Avatar name={r.sender_username ?? r.name ?? '?'} />
                <Text style={[styles.friendName, { flex: 1 }]}>{r.sender_username ?? r.name}</Text>
                <View style={styles.reqActions}>
                  <TouchableOpacity style={styles.btnAccept} onPress={() => handleRespond(r.id, 'accept')}>
                    <Ionicons name="checkmark" size={16} color={GOLD_LIGHT} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnDecline} onPress={() => handleRespond(r.id, 'decline')}>
                    <Ionicons name="close" size={16} color={DIM} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionLabel}>friends · {friends.length}</Text>
        {friends.length === 0 ? (
          <Text style={styles.emptyHint}>no friends yet — search to add people</Text>
        ) : friends.map((f: any, i: number) => (
          <View key={f.id ?? i} style={styles.card}>
            <Avatar name={friendName(f)} />
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{friendName(f)}</Text>
              <View style={styles.friendMetaRow}>
                <Ionicons name="flame" size={11} color={GOLD_MID} />
                <Text style={styles.friendMeta}>{friendStreak(f)} streak · {friendMastered(f)} mastered</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color={DIM} />
          </View>
        ))}

        {feed.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>activity</Text>
            {feed.map((item: any, i: number) => (
              <View key={item.id ?? i} style={[styles.card, styles.feedCard]}>
                <Avatar name={item.user ?? item.username ?? '?'} size={34} />
                <View style={styles.feedBody}>
                  <Text style={styles.feedText}>
                    <Text style={styles.feedName}>{item.user ?? item.username}</Text>
                    <Text style={styles.feedAction}> {item.action ?? item.activity_type ?? 'studied'} </Text>
                    <Text style={styles.feedTopic}>{item.topic ?? item.content ?? item.title ?? ''}</Text>
                  </Text>
                  <Text style={styles.feedTime}>{item.time ?? item.time_ago ?? ''}</Text>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 20 },
  pageTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_MID, letterSpacing: 0 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 11, gap: 10, marginBottom: 24 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_LIGHT, letterSpacing: 0.5 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, letterSpacing: 3, marginBottom: 10, marginTop: 4 },
  emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM, letterSpacing: 0.5, marginBottom: 24 },
  card: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  feedCard: { alignItems: 'flex-start' },
  avatar: { backgroundColor: GOLD_DARK + '40', borderWidth: 1, borderColor: GOLD_DARK, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_900Black', color: GOLD_LIGHT },
  friendInfo: { flex: 1 },
  friendName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: GOLD_LIGHT },
  friendMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  friendMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, letterSpacing: 0.5 },
  reqActions: { flexDirection: 'row', gap: 8 },
  btnAccept: { width: 32, height: 32, borderRadius: 16, backgroundColor: GOLD_DARK + '40', borderWidth: 1, borderColor: GOLD_DARK, alignItems: 'center', justifyContent: 'center' },
  btnDecline: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  feedBody: { flex: 1 },
  feedText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, lineHeight: 20 },
  feedName: { fontFamily: 'Inter_600SemiBold', color: GOLD_LIGHT },
  feedAction: { color: DIM },
  feedTopic: { color: GOLD_MID },
  feedTime: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, letterSpacing: 1, marginTop: 4 },
});
