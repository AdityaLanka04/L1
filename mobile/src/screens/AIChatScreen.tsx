import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Animated,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'; // Inter_700Bold used by MarkdownText
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MarkdownText from '../components/MarkdownText';
import { AuthUser } from '../services/auth';
import { getConversationStarters, createChatSession, askAI, getChatSessions, getChatMessages } from '../services/api';

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
  const [starters, setStarters]     = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const insets  = useSafeAreaInsets();
  const TAB_H   = 56 + insets.bottom;
  const slideAnim = useRef(new Animated.Value(-280)).current;

  useEffect(() => {
    getConversationStarters(user.username)
      .then(d => { if (Array.isArray(d?.starters)) setStarters(d.starters.slice(0, 4)); })
      .catch(() => {});
  }, [user.username]);

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
  const displayStarters = starters.length > 0 ? starters : [
    'Explain quantum entanglement', 'Help me understand derivatives',
    'What caused World War I?', 'Summarise the cell cycle',
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={TAB_H}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={openSidebar} activeOpacity={0.7} style={s.headerBtn}>
            <Ionicons name="menu-outline" size={22} color={DIM} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>cerbyl</Text>
            <View style={s.onlineDot} />
          </View>
          <TouchableOpacity onPress={newChat} activeOpacity={0.7} style={s.headerBtn}>
            <Ionicons name="create-outline" size={20} color={DIM} />
          </TouchableOpacity>
        </View>

        {/* Empty / starters */}
        {isEmpty ? (
          <View style={s.emptyWrap}>
            <LinearGradient colors={[GOLD_D + '30', 'transparent']} style={s.emptyGlow} />
            <Text style={s.emptyTitle}>ask anything</Text>
            <Text style={s.emptySub}>your ai tutor is ready</Text>
            <View style={s.starters}>
              {displayStarters.map(q => (
                <TouchableOpacity key={q} style={s.starterChip} onPress={() => send(q)} activeOpacity={0.7}>
                  <Text style={s.starterText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="ask cerbyl..."
            placeholderTextColor={DIM}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendDisabled]}
            onPress={() => send()}
            activeOpacity={0.8}
            disabled={!input.trim() || loading}
          >
            <LinearGradient colors={[GOLD_L, GOLD_M]} style={s.sendGrad}>
              <Ionicons name="chevron-up" size={20} color="#0A0A0A" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <Modal transparent animationType="none" onRequestClose={closeSidebar}>
          <View style={s.overlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSidebar} activeOpacity={1} />
            <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
              <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                <View style={s.sidebarHeader}>
                  <Text style={s.sidebarTitle}>chats</Text>
                  <TouchableOpacity onPress={() => { closeSidebar(); newChat(); }} activeOpacity={0.7}>
                    <Ionicons name="create-outline" size={20} color={GOLD_M} />
                  </TouchableOpacity>
                </View>
                {sessionsLoading ? (
                  <ActivityIndicator color={GOLD_M} style={{ marginTop: 32 }} />
                ) : sessions.length === 0 ? (
                  <Text style={s.sidebarEmpty}>no chats yet</Text>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {sessions.map(sess => (
                      <TouchableOpacity
                        key={sess.id}
                        style={[s.sessionItem, chatId === sess.id && s.sessionActive]}
                        onPress={() => loadSession(sess)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chatbubble-outline" size={14} color={chatId === sess.id ? GOLD_M : DIM} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.sessionTitle, chatId === sess.id && { color: GOLD_M }]} numberOfLines={2}>
                            {sess.title || 'untitled chat'}
                          </Text>
                          {sess.updated_at && (
                            <Text style={s.sessionDate}>
                              {new Date(sess.updated_at).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

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
  emptyGlow: { position: 'absolute', top: '20%', width: 260, height: 260, borderRadius: 130 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 32, color: GOLD_L, marginBottom: 8 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, letterSpacing: 2, marginBottom: 36 },
  starters: { width: '100%', gap: 10 },
  starterChip: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16 },
  starterText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_M },

  list: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },

  bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  aiBubble:   { alignSelf: 'flex-start', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  userBubble: { alignSelf: 'flex-end', backgroundColor: USER_BG, borderWidth: 1, borderColor: GOLD_D + '60' },
  userText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, color: GOLD_M },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: BG,
  },
  input: {
    flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: 'Inter_400Regular', fontSize: 14, color: GOLD_L, maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendDisabled: { opacity: 0.3 },
  sendGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Sidebar
  overlay: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 280, height: '100%', backgroundColor: CARD2,
    borderRightWidth: 1, borderRightColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 12,
  },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  sidebarTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_M },
  sidebarEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: DIM, textAlign: 'center', marginTop: 40 },

  sessionItem: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER + '80',
  },
  sessionActive: { backgroundColor: GOLD_D + '20' },
  sessionTitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_L, lineHeight: 18 },
  sessionDate:  { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM, marginTop: 3, letterSpacing: 0.5 },
});
