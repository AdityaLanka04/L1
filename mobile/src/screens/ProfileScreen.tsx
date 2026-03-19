import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser, signOut } from '../services/auth';
import { getEnhancedStats } from '../services/api';
import HapticTouchable from '../components/HapticTouchable';
import { triggerHaptic } from '../utils/haptics';

const BG = '#0A0A0A';
const CARD = '#111111';
const GOLD_LIGHT = '#FFE8A0';
const GOLD_MID = '#C9A87C';
const GOLD_DARK = '#7A5C2E';
const DIM = '#5A5040';
const BORDER = '#1E1E1E';

type Props = {
  user: AuthUser;
  onLogout?: () => void;
  onNavigate?: (screen: 'flashcards' | 'notes' | 'aimedia') => void;
};

export default function ProfileScreen({ user, onLogout, onNavigate }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [stats, setStats] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);

  useEffect(() => {
    getEnhancedStats(user.username).then(data => setStats(data)).catch(() => {});
  }, [user.username]);

  if (!fontsLoaded) return null;

  const displayName = [user.first_name, (user as any).last_name].filter(Boolean).join(' ') || user.username;
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const joinYear = (user as any).created_at
    ? new Date((user as any).created_at).getFullYear()
    : 2026;

  const statItems = [
    { label: 'STREAK',  value: String(stats?.streak ?? '—') },
    { label: 'STATS',   value: String(stats?.totalFlashcards ?? '—') },
    { label: 'QUIZZES', value: String(stats?.totalQuizzes ?? stats?.quiz_count ?? '—') },
  ];

  const prefs = [
    {
      label: 'Notifications',
      icon: 'notifications-outline',
      value: notificationsEnabled,
      onChange: (value: boolean) => {
        setNotificationsEnabled(value);
        triggerHaptic('selection');
      },
    },
    {
      label: 'Dark Mode',
      icon: 'moon-outline',
      value: darkModeEnabled,
      onChange: (value: boolean) => {
        setDarkModeEnabled(value);
        triggerHaptic('selection');
      },
    },
  ];

  const handleAccountPress = (label: string) => {
    if (label === 'My Flashcards') {
      onNavigate?.('flashcards');
      return;
    }
    if (label === 'My Notes') {
      onNavigate?.('notes');
      return;
    }

    Alert.alert('Not available yet', `${label} is not available on mobile yet.`);
  };

  const handleLogout = async () => {
    await signOut();
    onLogout?.();
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <LinearGradient colors={['#0A0A0A', '#0F0D05', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['transparent', GOLD_DARK + '20', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[GOLD_DARK + '15', 'transparent', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>profile</Text>
          <Ionicons name="settings-outline" size={18} color={DIM} />
        </View>

        <View style={styles.avatarSection}>
          <LinearGradient
            colors={[GOLD_DARK + '60', GOLD_DARK + '20']}
            style={styles.avatarCircle}
          >
            <Text style={styles.avatarInitials}>{initials}</Text>
          </LinearGradient>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userHandle}>@{user.username} · joined {joinYear}</Text>
        </View>

        <View style={styles.statStrip}>
          {statItems.map((s, i) => (
            <View key={s.label} style={[styles.statItem, i < statItems.length - 1 && styles.statBorder]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>preferences</Text>
        <View style={styles.card}>
          {prefs.map((p, i) => (
            <View key={p.label} style={[styles.prefRow, i < prefs.length - 1 && styles.prefDivider]}>
              <Ionicons name={p.icon as any} size={16} color={GOLD_MID} />
              <Text style={styles.prefLabel}>{p.label}</Text>
              <Switch
                value={p.value}
                onValueChange={p.onChange}
                trackColor={{ false: BORDER, true: GOLD_DARK }}
                thumbColor={p.value ? GOLD_LIGHT : DIM}
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>account</Text>
        <View style={styles.card}>
          {[
            { label: 'My Flashcards',   icon: 'layers-outline'          },
            { label: 'My Notes',        icon: 'document-text-outline'   },
            { label: 'Quiz History',    icon: 'bar-chart-outline'       },
            { label: 'Import / Export', icon: 'swap-horizontal-outline' },
          ].map((l, i) => (
            <HapticTouchable
              key={l.label}
              style={[styles.linkRow, i < 3 && styles.prefDivider]}
              activeOpacity={0.7}
              haptic="light"
              onPress={() => handleAccountPress(l.label)}
            >
              <Ionicons name={l.icon as any} size={16} color={GOLD_MID} />
              <Text style={styles.linkLabel}>{l.label}</Text>
              <Ionicons name="chevron-forward" size={13} color={DIM} />
            </HapticTouchable>
          ))}
          <HapticTouchable style={[styles.linkRow, styles.prefDivider]} activeOpacity={0.7} onPress={handleLogout} haptic="warning">
            <Ionicons name="log-out-outline" size={16} color="#8B3A3A" />
            <Text style={[styles.linkLabel, styles.linkDanger]}>Log Out</Text>
            <Ionicons name="chevron-forward" size={13} color={DIM} />
          </HapticTouchable>
        </View>

        <Text style={styles.version}>cerbyl · v1.0.0</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent', overflow: 'hidden' },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 28 },
  pageTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_MID, letterSpacing: 0 },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, borderColor: GOLD_DARK, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarInitials: { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_LIGHT },
  userName: { fontFamily: 'Inter_900Black', fontSize: 22, color: GOLD_LIGHT, letterSpacing: 0 },
  userHandle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, letterSpacing: 1, marginTop: 4 },
  statStrip: { flexDirection: 'row', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 32 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBorder: { borderRightWidth: 1, borderRightColor: BORDER },
  statValue: { fontFamily: 'Inter_900Black', fontSize: 22, color: GOLD_LIGHT },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 9, color: DIM, letterSpacing: 1.5, marginTop: 3 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, letterSpacing: 3, marginBottom: 10 },
  card: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 24, overflow: 'hidden' },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  prefDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  prefLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_LIGHT, flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 12 },
  linkLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_LIGHT, flex: 1 },
  linkDanger: { color: '#8B3A3A' },
  version: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, letterSpacing: 2, textAlign: 'center', marginTop: 8 },
});
