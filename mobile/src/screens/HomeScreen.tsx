import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RingProgress from '../components/RingProgress';
import { AuthUser } from '../services/auth';
import { getEnhancedStats } from '../services/api';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const BG        = '#0A0A0A';
const SURFACE   = '#111111';
const GOLD_XL   = '#FFF0BC';
const GOLD_L    = '#E8CC88';
const GOLD_MID  = '#C9A87C';
const GOLD_DARK = '#7A5C2E';
const GOLD_D    = '#8A6535';

const CARD_BORDER = GOLD_D + '55';
const TOP_GLOW    = GOLD_D + '28';

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
            <Text style={[styles.bigNum, { fontSize: STREAK_FONT, lineHeight: STREAK_FONT + 10 }]}>
              {streakStr}
            </Text>
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
            {[
              { val: stats?.totalChatSessions ?? '—', lbl: 'CHATS' },
              { val: stats?.totalFlashcards   ?? '—', lbl: 'FLASHCARDS' },
              { val: stats?.totalNotes        ?? '—', lbl: 'NOTES' },
            ].map(item => (
              <View key={item.lbl} style={styles.activityCard}>
                <LinearGradient colors={[TOP_GLOW, 'transparent']} style={styles.cardGlow} pointerEvents="none" />
                <Text style={styles.activityValue}>{item.val}</Text>
                <Text style={styles.activityLabel}>{item.lbl}</Text>
              </View>
            ))}
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
    color: GOLD_XL,
    letterSpacing: 0,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: GOLD_L,
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
    color: GOLD_L,
    letterSpacing: 5,
  },
  bigNum: {
    fontFamily: 'Inter_900Black',
    color: GOLD_XL,
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
    color: GOLD_XL,
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
    color: GOLD_XL,
    letterSpacing: 3,
    marginBottom: 14,
  },
  activityGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  activityCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: GOLD_D,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 0,
  },
  activityValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: GOLD_XL,
    zIndex: 1,
  },
  activityLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: GOLD_L,
    letterSpacing: 1.5,
    marginTop: 4,
    zIndex: 1,
  },
});
