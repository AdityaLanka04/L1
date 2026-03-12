import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { getNotes } from '../services/api';

const BG      = '#0A0A0A';
const SURFACE = '#0F0F0F';
const ACCENT  = '#C9A87C';
const GOLD_L  = '#E8CC88';
const GOLD_D  = '#8A6535';
const GOLD_XD = '#5A3F1A';
const BORDER  = '#1A1408';
const DIM2    = '#4A3E2A';

type Note = {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  is_favorite: boolean;
  folder_id: number | null;
};

type Props = { user: AuthUser; onBack?: () => void };

const stripHtml = (html: string) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── Note viewer ───────────────────────────────────────────────────────
function NoteViewer({ note, onBack }: { note: Note; onBack: () => void }) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  if (!fontsLoaded) return null;
  const content = stripHtml(note.content);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.viewerHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={GOLD_L} />
        </TouchableOpacity>
        <Text style={s.viewerHeaderTitle} numberOfLines={1}>{note.title.toLowerCase()}</Text>
        {note.is_favorite
          ? <Ionicons name="star" size={18} color={ACCENT} />
          : <View style={{ width: 18 }} />
        }
      </View>

      <ScrollView
        contentContainerStyle={s.viewerScroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.viewerTitle}>{note.title}</Text>
        <Text style={s.viewerMeta}>{formatDate(note.updated_at)}</Text>
        <View style={s.viewerDivider} />
        <Text style={s.viewerContent}>
          {content || 'This note has no text content.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Notes list ────────────────────────────────────────────────────────
export default function NotesScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [notes,    setNotes]    = useState<Note[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Note | null>(null);

  useEffect(() => {
    getNotes(user.username)
      .then(data => { setNotes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.username]);

  if (!fontsLoaded) return null;
  if (selected) return <NoteViewer note={selected} onBack={() => setSelected(null)} />;

  const q        = search.toLowerCase();
  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    stripHtml(n.content).toLowerCase().includes(q)
  );
  const sorted = [
    ...filtered.filter(n => n.is_favorite),
    ...filtered.filter(n => !n.is_favorite),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.title}>notes</Text>
          <Text style={s.subtitle}>{notes.length} saved notes</Text>
        </View>
        <Ionicons name="document-text-outline" size={22} color={GOLD_D} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={15} color={GOLD_D} />
        <TextInput
          style={s.searchInput}
          placeholder="search notes…"
          placeholderTextColor={DIM2}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={GOLD_D} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : sorted.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>{search ? 'no results' : 'no notes yet'}</Text>
          <Text style={s.emptyHint}>create notes on the web app</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const preview = stripHtml(item.content).slice(0, 90);
            return (
              <TouchableOpacity
                style={[s.noteCard, item.is_favorite && { borderColor: GOLD_XD }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.85}
              >
                <View style={s.noteCardTop}>
                  <Text style={s.noteCardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={s.noteMeta}>
                    {item.is_favorite && (
                      <Ionicons name="star" size={12} color={ACCENT} style={{ marginRight: 6 }} />
                    )}
                    <Text style={s.noteDate}>{formatDate(item.updated_at)}</Text>
                  </View>
                </View>
                {!!preview && (
                  <Text style={s.notePreview} numberOfLines={2}>{preview}</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: BG },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title:    { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_L },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 2, marginTop: 2 },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 4 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_L },

  listContent: { padding: 16, gap: 10, paddingBottom: 100 },

  noteCard:    { backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 8 },
  noteCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteCardTitle: { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_L, flex: 1, marginRight: 12 },
  noteMeta:    { flexDirection: 'row', alignItems: 'center' },
  noteDate:    { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2 },
  notePreview: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, lineHeight: 18 },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  emptyHint:  { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, letterSpacing: 1 },

  // ── Viewer ──
  viewerHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  backBtn:           { padding: 4 },
  viewerHeaderTitle: { fontFamily: 'Inter_900Black', fontSize: 13, color: GOLD_L, flex: 1, textAlign: 'center', marginHorizontal: 12 },
  viewerScroll:      { padding: 20, paddingBottom: 80 },
  viewerTitle:       { fontFamily: 'Inter_900Black', fontSize: 28, color: GOLD_L, lineHeight: 34 },
  viewerMeta:        { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, marginTop: 6, letterSpacing: 1 },
  viewerDivider:     { height: 1, backgroundColor: BORDER, marginVertical: 18 },
  viewerContent:     { fontFamily: 'Inter_400Regular', fontSize: 15, color: GOLD_L, lineHeight: 26 },
});
