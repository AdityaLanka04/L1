import * as WebBrowser from 'expo-web-browser';
import { WEB_URL } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { notifyInboxChanged } from '../services/notificationEvents';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, AppNotification } from '../services/api';
import GeoBackground from '../components/GeoBackground';
import HapticTouchable from '../components/HapticTouchable';
import { cbTileShadow } from '../components/NeumorphicTexture';
import { triggerHaptic } from '../utils/haptics';
import { useAppTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type Props = { user: AuthUser; onBack: () => void };

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  battle_challenge: 'flash-outline',
  battle_won: 'trophy-outline',
  battle_lost: 'flag-outline',
  battle_tied: 'remove-circle-outline',
  reminder: 'alarm-outline',
  calendar_event: 'calendar-outline',
  friend_request: 'person-add-outline',
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen({ user, onBack }: Props) {
  const { selectedTheme } = useAppTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(selectedTheme, layout, insets.top), [selectedTheme, layout, insets.top]);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [saving, setSaving] = useState(false);
  const version = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (cursor?: number | null) => {
    const requestVersion = ++version.current;
    try {
      const data = await getNotifications(user.username, 25, cursor);
      if (requestVersion !== version.current) return;
      setNotifications(prev => cursor ? [...prev, ...data.notifications.filter(n => !prev.some(old => old.id === n.id))] : data.notifications);
      setUnreadCount(data.unread_count);
      setNextCursor(data.next_cursor);
      setLoadError(false);
    } catch {
      if (requestVersion === version.current) setLoadError(true);
    } finally {
      if (requestVersion === version.current) { setLoading(false); setRefreshing(false); }
    }
  }, [user.username]);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => { if (!busy.current) void load(); }, 30000);
    return () => { version.current++; clearInterval(timer); };
  }, [load]));

  const update = async (operation: 'read' | 'delete' | 'all', n?: AppNotification) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); version.current++;
    try {
      if (operation === 'all') await markAllNotificationsRead(user.username);
      else if (operation === 'delete' && n) await deleteNotification(n.id);
      else if (n && !n.is_read) await markNotificationRead(n.id);
      notifyInboxChanged();
      await load();
    } catch {
      Alert.alert('Notification not updated', 'Please try again. Your notification has not been changed.');
    } finally { busy.current = false; setSaving(false); }
  };
  const openNotification = (n: AppNotification) => { setSelected(n); if (!n.is_read) void update('read', n); };
  const removeNotification = (n: AppNotification) => void update('delete', n);
  const markAllRead = () => void update('all');
  const openRelatedActivity = async () => {
    const path = selected?.action_url;
    if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return;
    try { await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`); }
    catch { Alert.alert('Could not open activity', 'Please try again.'); }
  };

  if (!fontsLoaded) return null;

  return (
    <View style={s.root}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
      <GeoBackground />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={selectedTheme.accent} />}
      >
        <View style={s.header}>
          <HapticTouchable style={s.iconBtn} onPress={onBack} haptic="light" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color={selectedTheme.accentHover} />
          </HapticTouchable>
          <View style={s.headerCopy}>
            <Text style={s.kicker}>{loading ? 'LOADING' : loadError ? 'UNAVAILABLE' : unreadCount > 0 ? `${unreadCount} UNREAD` : 'ALL CAUGHT UP'}</Text>
            <Text style={s.title}>notifications</Text>
          </View>
          {unreadCount > 0 ? (
            <HapticTouchable disabled={saving} onPress={markAllRead} haptic="selection">
              <Text style={s.markAllText}>mark all read</Text>
            </HapticTouchable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={selectedTheme.accent} size="large" style={{ marginTop: 80 }} />
        ) : loadError ? (
          <HapticTouchable onPress={() => load()} haptic="light" style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={selectedTheme.danger} />
            <Text style={s.errorBannerText}>couldn't load notifications — tap to retry</Text>
          </HapticTouchable>
        ) : notifications.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={30} color={selectedTheme.accent} />
            <Text style={s.emptyTitle}>no notifications yet</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {notifications.map((n) => (
              <HapticTouchable disabled={saving} key={n.id} style={[s.row, !n.is_read && s.rowUnread]} onPress={() => openNotification(n)} onLongPress={() => removeNotification(n)} haptic="none">
                {!n.is_read ? <View style={s.unreadDot} /> : null}
                <View style={s.rowIcon}>
                  <Ionicons name={TYPE_ICONS[n.notification_type] || 'notifications-outline'} size={16} color={selectedTheme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, !n.is_read && s.rowTitleUnread]} numberOfLines={1}>{n.title}</Text>
                  <Text style={s.rowMessage} numberOfLines={2}>{n.message}</Text>
                  <Text style={s.rowTime}>{timeAgo(n.created_at)}</Text>
                </View>
              </HapticTouchable>
            ))}
            {nextCursor && <HapticTouchable disabled={refreshing || saving} onPress={() => { setRefreshing(true); void load(nextCursor); }}><Text style={s.markAllText}>Load older notifications</Text></HapticTouchable>}
            <Text style={s.hintFooter}>long-press a notification to dismiss it</Text>
          </View>
        )}
      </ScrollView>
      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View accessibilityViewIsModal style={{ maxHeight: '85%', padding: 24, borderRadius: 16, backgroundColor: selectedTheme.panel }}>
            <HapticTouchable onPress={() => setSelected(null)} accessibilityLabel="Close notification"><Text style={s.markAllText}>Close</Text></HapticTouchable>
            <ScrollView><Text style={s.rowTitle}>{selected?.title}</Text><Text style={s.rowMessage}>{selected?.message}</Text>{selected?.reminder_due_at && <Text style={s.rowTime}>Due {new Date(selected.reminder_due_at).toLocaleString()}</Text>}{selected?.action_url && <HapticTouchable onPress={openRelatedActivity}><Text style={s.markAllText}>Open related activity</Text></HapticTouchable>}</ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme'], layout: ReturnType<typeof useResponsiveLayout>, topInset: number) {
  const surface = theme.panel;
  const border = rgbaFromHex(theme.accentHover, theme.isLight ? 0.18 : 0.2);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bgPrimary },
    scroll: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 4, paddingTop: Math.max(topInset + 10, 50), paddingBottom: 110 },
    header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    iconBtn: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(surface, 0.82), alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    kicker: { fontFamily: 'Inter_700Bold', color: theme.accent, fontSize: 10, letterSpacing: 1.7 },
    title: { fontFamily: 'Inter_900Black', color: theme.accentHover, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
    markAllText: { fontFamily: 'Inter_600SemiBold', color: theme.accentHover, fontSize: 11.5 },

    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: rgbaFromHex(theme.danger, 0.3), backgroundColor: rgbaFromHex(theme.danger, 0.1), paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 } as ViewStyle,
    errorBannerText: { fontFamily: 'Inter_600SemiBold', color: theme.danger, fontSize: 12 },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 70 },
    emptyTitle: { fontFamily: 'Inter_700Bold', color: theme.textSecondary, fontSize: 13, marginTop: 4 },

    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: rgbaFromHex(surface, 0.9), paddingHorizontal: 14, paddingVertical: 13, boxShadow: cbTileShadow(0.05) } as ViewStyle,
    rowUnread: { borderColor: rgbaFromHex(theme.accentHover, 0.4), backgroundColor: rgbaFromHex(theme.accent, theme.isLight ? 0.08 : 0.1) },
    unreadDot: { position: 'absolute', top: 12, right: 12, width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.accentHover },
    rowIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: rgbaFromHex(theme.accent, 0.14) },
    rowTitle: { fontFamily: 'Inter_600SemiBold', color: theme.textSecondary, fontSize: 12.5 },
    rowTitleUnread: { color: theme.textPrimary, fontFamily: 'Inter_700Bold' },
    rowMessage: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
    rowTime: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 9.5, marginTop: 4, letterSpacing: 0.3 },
    hintFooter: { fontFamily: 'Inter_400Regular', color: theme.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 6 },
  });
}
