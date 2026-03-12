import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import RingProgress from '../components/RingProgress';
import { AuthUser } from '../services/auth';
import { getEnhancedStats } from '../services/api';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const BG = '#0A0A0A';
const GOLD_LIGHT = '#FFE8A0';
const GOLD_MID = '#C9A87C';
const GOLD_DARK = '#7A5C2E';
const TEXT_DIM = '#5A5040';
const CARD_BG = '#141414';

type Props = { user: AuthUser };

type Stats = {
  streak: number;
  hours: number;
  totalChatSessions: number;
  totalFlashcards: number;
  totalNotes: number;
  weeklyHours?: number;
  weeklyInteractions?: number;
  weeklyMastered?: number;
};

export default function HomeScreen({ user }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getEnhancedStats(user.username).then(data => {
      setStats(data);
    }).catch(() => {});
  }, [user.username]);

  if (!fontsLoaded) return null;

  const streak = stats?.streak ?? 0;
  const streakStr = String(streak);
  const STREAK_FONT = Math.min(300, Math.floor((SCREEN_W * 0.88) / (streakStr.length * 0.68)));

  const weeklyHours = stats?.weeklyHours ?? stats?.hours ?? 0;
  const weeklyInteractions = stats?.weeklyInteractions ?? stats?.totalChatSessions ?? 0;
  const weeklyMastered = stats?.weeklyMastered ?? stats?.totalFlashcards ?? 0;

  const rings = [
    { label: 'HRS\nSTUDIED',  value: weeklyHours.toFixed(1),        progress: Math.min(weeklyHours / 10, 1) },
    { label: 'INTER-\nACTIONS', value: String(weeklyInteractions),  progress: Math.min(weeklyInteractions / 50, 1) },
    { label: 'MASTERED',      value: String(weeklyMastered),         progress: Math.min(weeklyMastered / 30, 1) },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'good morning' : hour < 18 ? 'good afternoon' : 'good evening';
  const firstName = user.first_name || user.username;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={['#0A0A0A', '#0F0D05', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['transparent', GOLD_DARK + '20', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[GOLD_DARK + '10', 'transparent', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.topBar}>
          <Text style={styles.appName}>cerbyl</Text>
          <Text style={styles.greeting}>{greeting}, {firstName}</Text>
        </View>

        <View style={styles.streakSection}>
          <Text style={styles.streakEyebrow}>STREAK</Text>
          {stats === null ? (
            <ActivityIndicator color={GOLD_MID} size="large" style={{ marginTop: 40 }} />
          ) : (
            <MaskedView maskElement={
              <Text style={[styles.bigNum, { fontSize: STREAK_FONT, lineHeight: STREAK_FONT + 10 }]}>
                {streakStr}
              </Text>
            }>
              <LinearGradient
                colors={[GOLD_LIGHT, GOLD_MID, GOLD_DARK]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              >
                <Text style={[styles.bigNum, { fontSize: STREAK_FONT, lineHeight: STREAK_FONT + 10, opacity: 0 }]}>
                  {streakStr}
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
        </View>

        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>weekly stats</Text>
        </View>
        <View style={styles.statsRow}>
          {rings.map((r) => (
            <RingProgress key={r.label} value={r.value} label={r.label} progress={r.progress} size={96} strokeWidth={7} />
          ))}
        </View>

        <View style={styles.continueSection}>
          <Text style={styles.sectionTitle}>your activity</Text>
          <View style={styles.activityGrid}>
            <View style={styles.activityCard}>
              <Text style={styles.activityValue}>{stats?.totalChatSessions ?? '—'}</Text>
              <Text style={styles.activityLabel}>CHATS</Text>
            </View>
            <View style={styles.activityCard}>
              <Text style={styles.activityValue}>{stats?.totalFlashcards ?? '—'}</Text>
              <Text style={styles.activityLabel}>FLASHCARDS</Text>
            </View>
            <View style={styles.activityCard}>
              <Text style={styles.activityValue}>{stats?.totalNotes ?? '—'}</Text>
              <Text style={styles.activityLabel}>NOTES</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, overflow: 'hidden' },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  appName: {
    fontFamily: 'Inter_900Black',
    fontSize: 16,
    color: GOLD_MID,
    letterSpacing: 0,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: TEXT_DIM,
    letterSpacing: 1,
  },

  streakSection: {
    alignItems: 'center',
    height: SCREEN_H * 0.46,
    justifyContent: 'center',
  },
  streakEyebrow: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: TEXT_DIM,
    letterSpacing: 5,
  },
  bigNum: {
    fontFamily: 'Inter_900Black',
    textAlign: 'center',
    textShadowColor: GOLD_MID + '55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 50,
  },

  weeklyHeader: {
    marginTop: 16,
    marginBottom: 16,
  },
  weeklyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: TEXT_DIM,
    letterSpacing: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },

  continueSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: TEXT_DIM,
    letterSpacing: 3,
    marginBottom: 14,
  },
  activityGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  activityCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
  },
  activityValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: GOLD_LIGHT,
  },
  activityLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: TEXT_DIM,
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
