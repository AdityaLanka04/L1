import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import {
  createNote,
  getFolders,
  getNotes,
  getTrash,
  moveNoteToFolder,
  moveNoteToTrash,
  permanentlyDeleteNote,
  restoreNote,
  toggleFavorite,
  updateNote,
} from '../services/api';
import HapticTouchable from '../components/HapticTouchable';

const BG = '#0A0A0A';
const SURFACE = '#0F0F0F';
const SURFACE_2 = '#151515';
const ACCENT = '#C9A87C';
const GOLD_L = '#E8CC88';
const GOLD_D = '#8A6535';
const GOLD_XD = '#5A3F1A';
const BORDER = '#1A1408';
const DIM2 = '#4A3E2A';
const RED = '#BF5D5D';
const GREEN = '#5DBF7A';

type Note = {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  created_at?: string | null;
  is_favorite: boolean;
  folder_id: number | null;
};

type Folder = {
  id: number;
  name: string;
  color: string;
  note_count: number;
  parent_id: number | null;
  created_at?: string;
};

type TrashNote = {
  id: number;
  title: string;
  content: string;
  deleted_at: string | null;
  days_remaining: number;
};

type FilterValue = 'all' | 'favorites' | `folder:${number}`;

type Props = { user: AuthUser; onBack?: () => void };
type NotesStackParamList = {
  NotesHome: undefined;
  NoteEditor: { note: Note };
  NotesTrash: undefined;
};

const NotesStack = createNativeStackNavigator<NotesStackParamList>();

function stripHtml(html: string) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <HapticTouchable
      style={[s.filterChip, active && s.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.85}
      haptic="selection"
    >
      <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{label}</Text>
    </HapticTouchable>
  );
}

function NoteEditor({
  user,
  note,
  folders,
  onBack,
  onSaved,
  onMovedToTrash,
  onFavoriteChanged,
}: {
  user: AuthUser;
  note: Note;
  folders: Folder[];
  onBack: () => void;
  onSaved: (note: Note) => void;
  onMovedToTrash: (noteId: number) => void;
  onFavoriteChanged: (noteId: number, isFavorite: boolean) => void;
}) {
  const [baseNote, setBaseNote] = useState(note);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isFavorite, setIsFavorite] = useState(note.is_favorite);
  const [folderId, setFolderId] = useState<number | null>(note.folder_id);
  const [saving, setSaving] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);

  const dirty = title !== baseNote.title || content !== baseNote.content;

  const save = async () => {
    if (saving) return true;
    setSaving(true);
    try {
      const updated = await updateNote({
        noteId: note.id,
        title: title.trim() || 'Untitled Note',
        content,
      });
      const nextNote = {
        ...note,
        title: updated.title,
        content: updated.content,
        updated_at: updated.updated_at,
        is_favorite: isFavorite,
        folder_id: folderId,
      };
      setBaseNote(nextNote);
      onSaved(nextNote);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note';
      Alert.alert('Save failed', message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    if (dirty) {
      const ok = await save();
      if (!ok) return;
    }
    onBack();
  };

  const handleFavorite = async () => {
    if (favoriteBusy) return;
    const next = !isFavorite;
    setFavoriteBusy(true);
    try {
      await toggleFavorite({ noteId: note.id, isFavorite: next });
      setIsFavorite(next);
      setBaseNote((current) => ({ ...current, is_favorite: next }));
      onFavoriteChanged(note.id, next);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update favorite';
      Alert.alert('Favorite failed', message);
    } finally {
      setFavoriteBusy(false);
    }
  };

  const handleMoveFolder = async (nextFolderId: number | null) => {
    if (folderBusy || folderId === nextFolderId) return;
    setFolderBusy(true);
    try {
      await moveNoteToFolder({ noteId: note.id, folderId: nextFolderId });
      setFolderId(nextFolderId);
      const nextNote = {
        ...baseNote,
        title,
        content,
        folder_id: nextFolderId,
        is_favorite: isFavorite,
      };
      setBaseNote(nextNote);
      onSaved(nextNote);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move note';
      Alert.alert('Move failed', message);
    } finally {
      setFolderBusy(false);
    }
  };

  const handleTrash = () => {
    Alert.alert('Move to trash?', 'You can restore this note for 30 days from trash.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move',
        style: 'destructive',
        onPress: async () => {
          try {
            await moveNoteToTrash(note.id);
            onMovedToTrash(note.id);
            onBack();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to move note to trash';
            Alert.alert('Trash failed', message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.editorHeader}>
          <HapticTouchable onPress={handleBack} style={s.iconBtn} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </HapticTouchable>
          <Text style={s.editorHeaderTitle} numberOfLines={1}>
            {title.trim() ? title.toLowerCase() : 'untitled note'}
          </Text>
          <View style={s.editorActions}>
            <HapticTouchable onPress={handleFavorite} style={s.iconBtn} haptic="selection">
              <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={19} color={isFavorite ? ACCENT : GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={save} style={s.saveBtn} haptic="success" disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? 'saving' : dirty ? 'save' : 'saved'}</Text>
            </HapticTouchable>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.editorMetaRow}>
            <Text style={s.editorMetaText}>updated {formatDate(note.updated_at)}</Text>
            <HapticTouchable onPress={handleTrash} haptic="warning">
              <Text style={s.trashText}>move to trash</Text>
            </HapticTouchable>
          </View>

          <View style={s.folderSection}>
            <Text style={s.sectionCaption}>folder</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.folderChips}>
              <FilterChip label="root" active={folderId == null} onPress={() => handleMoveFolder(null)} />
              {folders.map((folder) => (
                <FilterChip
                  key={folder.id}
                  label={folder.name}
                  active={folderId === folder.id}
                  onPress={() => handleMoveFolder(folder.id)}
                />
              ))}
            </ScrollView>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled Note"
            placeholderTextColor={DIM2}
            style={s.titleInput}
          />

          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Start writing your note..."
            placeholderTextColor={DIM2}
            style={s.contentInput}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NotesTrashScreen({
  user,
  onBack,
  onChanged,
}: {
  user: AuthUser;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [trash, setTrash] = useState<TrashNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = () => {
    setLoading(true);
    getTrash(user.username)
      .then((data) => setTrash(data?.trash ?? []))
      .catch(() => setTrash([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTrash();
  }, [user.username]);

  const doRestore = async (noteId: number) => {
    try {
      await restoreNote(noteId);
      setTrash((current) => current.filter((note) => note.id !== noteId));
      onChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore note';
      Alert.alert('Restore failed', message);
    }
  };

  const doPermanentDelete = async (noteId: number) => {
    try {
      await permanentlyDeleteNote(noteId);
      setTrash((current) => current.filter((note) => note.id !== noteId));
      onChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete note';
      Alert.alert('Delete failed', message);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <HapticTouchable onPress={onBack} style={{ marginRight: 12 }} haptic="selection">
          <Ionicons name="chevron-back" size={22} color={GOLD_L} />
        </HapticTouchable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>trash</Text>
          <Text style={s.subtitle}>recoverable for 30 days</Text>
        </View>
        <Ionicons name="trash-outline" size={22} color={GOLD_D} />
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : trash.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>trash is empty</Text>
          <Text style={s.emptyHint}>deleted notes will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={trash}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <View style={s.trashCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.noteCardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.notePreview} numberOfLines={2}>{stripHtml(item.content) || 'No content'}</Text>
                <Text style={s.trashMeta}>{item.days_remaining}d remaining</Text>
              </View>
              <View style={s.trashActions}>
                <HapticTouchable style={s.restoreBtn} onPress={() => doRestore(item.id)} haptic="success">
                  <Text style={s.restoreBtnText}>restore</Text>
                </HapticTouchable>
                <HapticTouchable
                  style={s.deleteForeverBtn}
                  onPress={() => {
                    Alert.alert('Delete permanently?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => doPermanentDelete(item.id) },
                    ]);
                  }}
                  haptic="warning"
                >
                  <Text style={s.deleteForeverText}>delete</Text>
                </HapticTouchable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function NotesHome({
  user,
  onBack,
  refreshTick,
  onCreated,
  onOpenEditor,
  onOpenTrash,
}: Props & {
  refreshTick: number;
  onCreated: () => void;
  onOpenEditor: (note: Note) => void;
  onOpenTrash: () => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([getNotes(user.username), getFolders(user.username)])
      .then(([notesData, foldersData]) => {
        setNotes(Array.isArray(notesData) ? notesData : []);
        setFolders(foldersData?.folders ?? []);
      })
      .catch(() => {
        setNotes([]);
        setFolders([]);
      })
      .finally(() => setLoading(false));
  }, [user.username, refreshTick]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    let current = notes;

    if (filter === 'favorites') {
      current = current.filter((note) => note.is_favorite);
    } else if (filter.startsWith('folder:')) {
      const folderId = Number(filter.split(':')[1]);
      current = current.filter((note) => note.folder_id === folderId);
    }

    if (!query) return current;

    return current.filter((note) => (
      note.title.toLowerCase().includes(query) ||
      stripHtml(note.content).toLowerCase().includes(query)
    ));
  }, [filter, notes, search]);

  const favoriteCount = notes.filter((note) => note.is_favorite).length;

  const createNewNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const newNote = await createNote({
        userId: user.username,
        title: 'Untitled Note',
        content: '',
      });
      const note = {
        ...newNote,
        is_favorite: false,
        folder_id: null,
      } as Note;
      onCreated();
      onOpenEditor(note);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create note';
      Alert.alert('Create failed', message);
    } finally {
      setCreating(false);
    }
  };

  const toggleCardFavorite = async (note: Note) => {
    try {
      await toggleFavorite({ noteId: note.id, isFavorite: !note.is_favorite });
      setNotes((current) => current.map((item) => (
        item.id === note.id ? { ...item, is_favorite: !item.is_favorite } : item
      )));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update favorite';
      Alert.alert('Favorite failed', message);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        {onBack ? (
          <HapticTouchable onPress={onBack} style={{ marginRight: 12 }} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </HapticTouchable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.title}>notes</Text>
          <Text style={s.subtitle}>write · organize · revisit</Text>
        </View>
        <HapticTouchable onPress={onOpenTrash} style={s.headerIconBtn} haptic="selection">
          <Ionicons name="trash-outline" size={18} color={GOLD_D} />
        </HapticTouchable>
        <HapticTouchable onPress={createNewNote} style={[s.headerIconBtn, s.headerIconBtnPrimary]} haptic="medium" disabled={creating}>
          <Ionicons name="add" size={20} color="#0A0908" />
        </HapticTouchable>
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={(
            <>
              <View style={s.statsStrip}>
                {[
                  { value: notes.length, label: 'NOTES' },
                  { value: favoriteCount, label: 'FAVORITES' },
                  { value: folders.length, label: 'FOLDERS' },
                ].map((item, index) => (
                  <View key={item.label} style={[s.statCell, index > 0 && s.statDivider]}>
                    <Text style={s.statValue}>{item.value}</Text>
                    <Text style={s.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <View style={s.searchWrap}>
                <Ionicons name="search-outline" size={15} color={GOLD_D} />
                <TextInput
                  style={s.searchInput}
                  placeholder="search notes..."
                  placeholderTextColor={DIM2}
                  value={search}
                  onChangeText={setSearch}
                />
                {!!search && (
                  <HapticTouchable onPress={() => setSearch('')} haptic="selection">
                    <Ionicons name="close-circle" size={16} color={GOLD_D} />
                  </HapticTouchable>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
                <FilterChip label="all" active={filter === 'all'} onPress={() => setFilter('all')} />
                <FilterChip label="favorites" active={filter === 'favorites'} onPress={() => setFilter('favorites')} />
                {folders.map((folder) => (
                  <FilterChip
                    key={folder.id}
                    label={folder.name}
                    active={filter === `folder:${folder.id}`}
                    onPress={() => setFilter(`folder:${folder.id}`)}
                  />
                ))}
              </ScrollView>
            </>
          )}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{search ? 'no results' : 'no notes yet'}</Text>
              <Text style={s.emptyHint}>start with a new note and it will appear here</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const preview = stripHtml(item.content).slice(0, 120);
            const folderName = folders.find((folder) => folder.id === item.folder_id)?.name;

            return (
              <HapticTouchable style={s.noteCard} onPress={() => onOpenEditor(item)} activeOpacity={0.88} haptic="light">
                <View style={s.noteCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.noteCardTitle} numberOfLines={2}>{item.title || 'Untitled Note'}</Text>
                    <Text style={s.noteMetaText}>
                      {formatDate(item.updated_at)}
                      {folderName ? `  •  ${folderName}` : ''}
                    </Text>
                  </View>
                  <HapticTouchable onPress={() => toggleCardFavorite(item)} style={s.starBtn} haptic="selection">
                    <Ionicons name={item.is_favorite ? 'star' : 'star-outline'} size={16} color={item.is_favorite ? ACCENT : GOLD_D} />
                  </HapticTouchable>
                </View>
                <Text style={s.notePreview} numberOfLines={3}>
                  {preview || 'Open this note to start writing.'}
                </Text>
              </HapticTouchable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

export default function NotesScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [refreshTick, setRefreshTick] = useState(0);
  const [foldersSnapshot, setFoldersSnapshot] = useState<Folder[]>([]);

  if (!fontsLoaded) return null;

  return (
    <NotesStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <NotesStack.Screen name="NotesHome">
        {({ navigation }) => (
          <NotesHome
            user={user}
            onBack={onBack}
            refreshTick={refreshTick}
            onCreated={() => setRefreshTick((value) => value + 1)}
            onOpenTrash={() => navigation.navigate('NotesTrash')}
            onOpenEditor={(note) => {
              getFolders(user.username)
                .then((data) => setFoldersSnapshot(data?.folders ?? []))
                .catch(() => setFoldersSnapshot([]))
                .finally(() => navigation.navigate('NoteEditor', { note }));
            }}
          />
        )}
      </NotesStack.Screen>
      <NotesStack.Screen name="NoteEditor">
        {({ route, navigation }) => (
          <NoteEditor
            user={user}
            note={route.params.note}
            folders={foldersSnapshot}
            onBack={() => navigation.goBack()}
            onSaved={() => {
              setRefreshTick((value) => value + 1);
            }}
            onMovedToTrash={() => {
              setRefreshTick((value) => value + 1);
            }}
            onFavoriteChanged={() => {
              setRefreshTick((value) => value + 1);
            }}
          />
        )}
      </NotesStack.Screen>
      <NotesStack.Screen name="NotesTrash">
        {({ navigation }) => (
          <NotesTrashScreen
            user={user}
            onBack={() => navigation.goBack()}
            onChanged={() => setRefreshTick((value) => value + 1)}
          />
        )}
      </NotesStack.Screen>
    </NotesStack.Navigator>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 8,
  },
  title: { fontFamily: 'Inter_900Black', fontSize: 30, color: GOLD_L },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 2, marginTop: 2 },

  headerIconBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: GOLD_XD,
    backgroundColor: SURFACE_2, alignItems: 'center', justifyContent: 'center',
  },
  headerIconBtnPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    marginBottom: 12,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: BORDER },
  statValue: { fontFamily: 'Inter_900Black', fontSize: 18, color: ACCENT },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 8, color: DIM2, letterSpacing: 1.5, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_L },
  filtersRow: { gap: 10, paddingBottom: 6, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_2,
  },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: GOLD_L, textTransform: 'lowercase' },
  filterChipTextActive: { color: BG },

  listContent: { padding: 16, gap: 12, paddingBottom: 120, flexGrow: 1 },
  noteCard: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 10,
  },
  noteCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  noteCardTitle: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_L, lineHeight: 22 },
  noteMetaText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2, marginTop: 4, letterSpacing: 0.8 },
  notePreview: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, lineHeight: 19 },
  starBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, textAlign: 'center', letterSpacing: 1 },

  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  editorHeaderTitle: { flex: 1, fontFamily: 'Inter_900Black', fontSize: 14, color: GOLD_L, textAlign: 'center', marginHorizontal: 12 },
  editorActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: ACCENT,
  },
  saveBtnText: { fontFamily: 'Inter_900Black', fontSize: 11, color: BG, textTransform: 'lowercase' },
  editorScroll: { padding: 16, paddingBottom: 80 },
  editorMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  editorMetaText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 0.8 },
  trashText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: RED, textTransform: 'lowercase' },
  folderSection: { marginBottom: 16 },
  sectionCaption: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_D, letterSpacing: 2, marginBottom: 10 },
  folderChips: { gap: 10 },
  titleInput: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Inter_900Black',
    fontSize: 28,
    lineHeight: 34,
    color: GOLD_L,
    marginBottom: 12,
  },
  contentInput: {
    minHeight: 420,
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: GOLD_L,
  },

  trashCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  trashMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2, marginTop: 8, letterSpacing: 0.8 },
  trashActions: { justifyContent: 'space-between', gap: 8 },
  restoreBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0D1A10',
    borderWidth: 1,
    borderColor: '#1F4A2C',
  },
  restoreBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GREEN, textTransform: 'lowercase' },
  deleteForeverBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1A0D0D',
    borderWidth: 1,
    borderColor: '#4A1F1F',
  },
  deleteForeverText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: RED, textTransform: 'lowercase' },
});
