import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Animated,
  Modal, ScrollView, ActivityIndicator, PanResponder,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'; // Inter_700Bold used by MarkdownText
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MarkdownText from '../components/MarkdownText';
import HapticTouchable from '../components/HapticTouchable';
import { AuthUser } from '../services/auth';
import { createChatSession, askAI, getChatSessions, getChatMessages } from '../services/api';

const BG      = '#0A0A0A';
const CARD    = '#111111';
const CARD2   = '#161616';
const GOLD_L  = '#FFE8A0';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#7A5C2E';
const DIM     = '#5A5040';
const BORDER  = '#1E1E1E';
const USER_BG = '#1A1408';

type Msg = { id: string; role: 'user' | 'ai'; text: string };
type Session = { id: number; title: string; updated_at: string | null };
type Props = { user: AuthUser };

// ── Typing indicator ──────────────────────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(500),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={td.row}>
      {dots.map((d, i) => <Animated.View key={i} style={[td.dot, { opacity: d }]} />)}
    </View>
  );
}
const td = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD_M },
});

// Pre-process text: convert LaTeX delimiters to readable form
function preprocessText(text: string): string {
  return text
    .replace(/\$\$([^$]+)\$\$/g, (_, eq) => '\n```\n' + eq.trim() + '\n```\n')
    .replace(/\$([^$\n]+)\$/g, (_, eq) => '`' + eq.trim() + '`');
}

export default function AIChatScreen({ user }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [messages, setMessages]     = useState<Msg[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [chatId, setChatId]         = useState<number | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const insets  = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => { if (g.dx < 0) slideAnim.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60 || g.vx < -0.5) {
          Animated.timing(slideAnim, { toValue: -280, duration: 220, useNativeDriver: true }).start(() => setSidebarOpen(false));
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }).start();
        }
      },
    })
  ).current;

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }).start();
    setSessionsLoading(true);
    getChatSessions(user.username)
      .then(d => setSessions(Array.isArray(d?.sessions) ? d.sessions : []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [user.username]);

  const closeSidebar = useCallback(() => {
    Animated.timing(slideAnim, { toValue: -280, duration: 220, useNativeDriver: true }).start(() => setSidebarOpen(false));
  }, []);

  const loadSession = useCallback(async (session: Session) => {
    closeSidebar();
    setLoading(true);
    setMessages([]);
    setChatId(session.id);
    try {
      const msgs: any[] = await getChatMessages(session.id);
      const converted: Msg[] = msgs
        .filter(m => m.content)
        .map(m => ({ id: m.id, role: m.type === 'user' ? 'user' : 'ai', text: m.content }));
      setMessages(converted);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!fontsLoaded) return null;

  const send = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      let currentChatId = chatId;
      if (!currentChatId) {
        const session = await createChatSession(user.username, trimmed.slice(0, 60));
        currentChatId = session.id;
        setChatId(currentChatId);
      }
      const data = await askAI(user.username, trimmed, currentChatId);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: data.response ?? data.answer ?? 'Sorry, no response.',
      }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => { setMessages([]); setChatId(undefined); };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Subtle background */}
      <LinearGradient colors={['#0A0A0A', '#0F0D05', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['transparent', GOLD_D + '18', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>

        {/* Header */}
        <View style={s.header}>
          <HapticTouchable onPress={openSidebar} activeOpacity={0.7} style={s.headerBtn} haptic="selection">
            <Ionicons name="menu-outline" size={22} color={DIM} />
          </HapticTouchable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>cerbyl</Text>
            <View style={s.onlineDot} />
          </View>
          <HapticTouchable onPress={newChat} activeOpacity={0.7} style={s.headerBtn} haptic="light">
            <Ionicons name="create-outline" size={20} color={DIM} />
          </HapticTouchable>
        </View>

        {/* Empty state */}
        {isEmpty ? (
          <View style={s.emptyWrap}>
            <LinearGradient colors={[GOLD_D + '40', GOLD_D + '10', 'transparent']} style={s.emptyGlow} />
            <Text style={s.emptyTitle}>ask anything</Text>
            <Text style={s.emptySub}>your ai tutor is ready</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={loading ? [...messages, { id: 'typing', role: 'ai' as const, text: '__typing__' }] : messages}
            keyExtractor={m => m.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              if (item.text === '__typing__') {
                return <View style={[s.bubble, s.aiBubble]}><TypingDots /></View>;
              }
              return (
                <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
                  {isUser && <LinearGradient colors={[GOLD_D + '60', USER_BG]} style={StyleSheet.absoluteFill} borderRadius={18} />}
                  {isUser ? (
                    <Text style={s.userText}>{item.text}</Text>
                  ) : (
                    <MarkdownText>{preprocessText(item.text)}</MarkdownText>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Input bar */}
        <View style={[s.inputBar, { paddingBottom: 10 }]}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="ask cerbyl..."
            placeholderTextColor={DIM}
            multiline
          />
          <HapticTouchable
            style={[s.sendBtn, (!input.trim() || loading) && s.sendDisabled]}
            onPress={() => send()}
            activeOpacity={0.8}
            disabled={!input.trim() || loading}
            haptic="medium"
          >
            <LinearGradient colors={[GOLD_L, GOLD_M]} style={s.sendGrad}>
              <Ionicons name="chevron-up" size={20} color="#0A0A0A" />
            </LinearGradient>
          </HapticTouchable>
        </View>

      </KeyboardAvoidingView>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <Modal transparent animationType="none" onRequestClose={closeSidebar}>
          <SafeAreaProvider>
            <View style={s.overlay}>
              <HapticTouchable style={StyleSheet.absoluteFill} onPress={closeSidebar} activeOpacity={1} haptic="none" />
              <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]} {...panResponder.panHandlers}>
                <LinearGradient colors={['#1E1608', '#131008', '#0A0A0A']} style={StyleSheet.absoluteFill} />
                <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                  <View style={s.sidebarHeader}>
                    <Text style={s.sidebarTitle}>chats</Text>
                  </View>
                  <LinearGradient colors={[GOLD_D + '60', 'transparent']} style={s.sidebarDivider} />
                  {sessionsLoading ? (
                    <ActivityIndicator color={GOLD_M} style={{ marginTop: 32 }} />
                  ) : sessions.length === 0 ? (
                    <View style={s.sidebarEmptyWrap}>
                      <Text style={s.sidebarEmpty}>no chats yet</Text>
                    </View>
                  ) : (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                      {sessions.map(sess => {
                        const active = chatId === sess.id;
                        return (
                          <HapticTouchable
                            key={sess.id}
                            style={s.sessionItem}
                            onPress={() => loadSession(sess)}
                            activeOpacity={0.75}
                            haptic="selection"
                          >
                            {active && <LinearGradient colors={[GOLD_D + '35', 'transparent']} style={StyleSheet.absoluteFill} />}
                            <View style={[s.sessionDot, active && { backgroundColor: GOLD_M }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.sessionTitle, active && { color: GOLD_M }]} numberOfLines={2}>
                                {sess.title || 'untitled chat'}
                              </Text>
                              {sess.updated_at && (
                                <Text style={s.sessionDate}>
                                  {new Date(sess.updated_at).toLocaleDateString()}
                                </Text>
                              )}
                            </View>
                            {active && <Ionicons name="chevron-forward" size={14} color={GOLD_D} />}
                          </HapticTouchable>
                        );
                      })}
                    </ScrollView>
                  )}
                </SafeAreaView>
              </Animated.View>
            </View>
          </SafeAreaProvider>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, overflow: 'hidden' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerBtn: { width: 36, alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_M },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6BCB77' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyGlow: { position: 'absolute', top: '15%', width: 300, height: 300, borderRadius: 150 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 32, color: GOLD_L, marginBottom: 8 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, letterSpacing: 2 },

  list: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },

  bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  aiBubble:   { alignSelf: 'flex-start', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  userBubble: { alignSelf: 'flex-end', backgroundColor: USER_BG, borderWidth: 1, borderColor: GOLD_D + '60' },
  userText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, color: GOLD_M },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: GOLD_D + '40', backgroundColor: 'transparent',
  },
  input: {
    flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: GOLD_D + '70',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_L, maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendDisabled: { opacity: 0.3 },
  sendGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Sidebar
  overlay: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 280, height: '100%',
    borderRightWidth: 1, borderRightColor: GOLD_D + '50',
    shadowColor: GOLD_D, shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20,
    elevation: 16, overflow: 'hidden',
  },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  sidebarTitle: { fontFamily: 'Inter_900Black', fontSize: 22, color: GOLD_L },
  sidebarDivider: { height: 1, marginHorizontal: 20, marginBottom: 4 },
  sidebarEmptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  sidebarEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, letterSpacing: 1 },

  sessionItem: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    marginHorizontal: 10, marginVertical: 3,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14, overflow: 'hidden',
  },
  sessionDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD_D, flexShrink: 0 },
  sessionTitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_L, lineHeight: 18 },
  sessionDate:  { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, marginTop: 3, letterSpacing: 0.5 },
});
