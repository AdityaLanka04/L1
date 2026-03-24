import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Modal,
  Platform,
  Pressable,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_900Black,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import AmbientBubbles from '../components/AmbientBubbles';
import CanvasNoteModal, { CanvasPreview } from '../components/CanvasNoteModal';
import HapticTouchable from '../components/HapticTouchable';
import { AuthUser } from '../services/auth';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  createFolder,
  createNote,
  convertChatSessionsToNote,
  convertNotesToFlashcards,
  convertNotesToQuestions,
  getChatSessions,
  getFolders,
  getNotes,
  getTrash,
  invokeNotesAgent,
  moveNoteToFolder,
  moveNoteToTrash,
  permanentlyDeleteNote,
  restoreNote,
  toggleFavorite,
  updateNote,
} from '../services/api';
import { darkenColor, getDefaultTheme, rgbaFromHex } from '../utils/theme';
import { getResponsiveLayout, useResponsiveLayout } from '../hooks/useResponsiveLayout';
import AIMediaNotesScreen from './AIMediaNotesScreen';
import {
  BUILT_IN_NOTE_TEMPLATES,
  NoteTemplate,
  applyTemplateVariables,
} from '../data/noteTemplates';
import {
  buildNoteContentFromBlocks,
  createCanvasBlock,
  createTextBlock,
  getPlainNoteText,
  hasCanvasPayload,
  parseNoteCanvasBlocks,
  serializeBlocksForComparison,
  type NoteCanvasBlock,
} from '../utils/noteCanvas';
import { NOTE_FONT_OPTIONS, normalizeNoteFont, resolveNoteFont } from '../constants/noteFonts';

const DEFAULT_THEME = getDefaultTheme();
const DEFAULT_LAYOUT = getResponsiveLayout(393, 852);
const CUSTOM_TEMPLATE_KEY = 'mobile.customNoteTemplates';
const RECENT_NOTES_KEY_PREFIX = 'mobile.notes.recent';
const PAGE_PROPERTIES_KEY_PREFIX = 'mobile.notes.properties';
const ADVANCED_SEARCH_HISTORY_KEY_PREFIX = 'mobile.notes.searchHistory';

let CURRENT_THEME = DEFAULT_THEME;
let BG = DEFAULT_THEME.bgPrimary;
let SURFACE = DEFAULT_THEME.panel;
let SURFACE_2 = DEFAULT_THEME.panelAlt;
let ACCENT = DEFAULT_THEME.accent;
let GOLD_L = DEFAULT_THEME.accentHover;
let GOLD_D = darkenColor(DEFAULT_THEME.accent, DEFAULT_THEME.isLight ? 10 : 26);
let GOLD_XD = darkenColor(DEFAULT_THEME.accent, DEFAULT_THEME.isLight ? 26 : 40);
let BORDER = DEFAULT_THEME.borderStrong;
let DIM2 = DEFAULT_THEME.textSecondary;
let RED = DEFAULT_THEME.danger;
let GREEN = DEFAULT_THEME.success;

type Note = {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  created_at?: string | null;
  is_favorite: boolean;
  folder_id: number | null;
  custom_font: string;
};

type RecentNote = {
  id: number;
  title: string;
  viewedAt: string;
};

type PagePropertyType = 'text' | 'number' | 'date' | 'checkbox' | 'tags' | 'person' | 'url';

type PageProperty = {
  id: string;
  name: string;
  type: PagePropertyType;
  value: string | boolean;
};

type SmartFolderGroup = {
  name: string;
  notes: Note[];
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

type ChatSession = {
  id: number;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type CustomTemplate = NoteTemplate & {
  createdAt: string;
};

type Difficulty = 'easy' | 'medium' | 'hard';
type FilterValue =
  | 'all'
  | 'favorites'
  | 'source:flashcards'
  | 'source:quizzes'
  | 'source:roadmaps'
  | `folder:${number}`;
type ConvertTarget = 'flashcards' | 'questions';
type TemplateTab = 'built-in' | 'custom';
type AiAction =
  | 'grammar'
  | 'improve'
  | 'simplify'
  | 'expand'
  | 'summarize'
  | 'continue'
  | 'generate'
  | 'tone_change'
  | 'code';

type Props = { user: AuthUser; onBack?: () => void };
type NotesStackParamList = {
  NotesHome: undefined;
  NoteEditor: { note: Note; folders: Folder[] };
  NotesTrash: undefined;
  MediaNotes: undefined;
};

const NotesStack = createNativeStackNavigator<NotesStackParamList>();

function applyTheme(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  CURRENT_THEME = theme;
  BG = theme.bgPrimary;
  SURFACE = theme.panel;
  SURFACE_2 = theme.panelAlt;
  ACCENT = theme.accent;
  GOLD_L = theme.accentHover;
  GOLD_D = darkenColor(theme.accent, theme.isLight ? 10 : 26);
  GOLD_XD = darkenColor(theme.accent, theme.isLight ? 26 : 40);
  BORDER = theme.borderStrong;
  DIM2 = theme.textSecondary;
  RED = theme.danger;
  GREEN = theme.success;
}

function stripHtml(html: string) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countSource(notes: Note[], source: 'flashcards' | 'quizzes' | 'roadmaps') {
  return notes.filter((note) => matchesSource(note, source)).length;
}

function matchesSource(note: Note, source: 'flashcards' | 'quizzes' | 'roadmaps') {
  const haystack = `${note.title} ${getPlainNoteText(note.content)}`.toLowerCase();
  if (source === 'flashcards') return haystack.includes('flashcard');
  if (source === 'quizzes') return haystack.includes('quiz');
  return haystack.includes('roadmap');
}

function buildNoteFromApi(data: any): Note {
  return {
    id: data.id,
    title: data.title ?? 'Untitled Note',
    content: data.content ?? '',
    updated_at: data.updated_at ?? new Date().toISOString(),
    created_at: data.created_at ?? data.updated_at ?? new Date().toISOString(),
    is_favorite: Boolean(data.is_favorite),
    folder_id: data.folder_id ?? null,
    custom_font: normalizeNoteFont(data.custom_font),
  };
}

function recentNotesKey(userId: string) {
  return `${RECENT_NOTES_KEY_PREFIX}.${userId}`;
}

function pagePropertiesKey(userId: string, noteId: number) {
  return `${PAGE_PROPERTIES_KEY_PREFIX}.${userId}.${noteId}`;
}

function advancedSearchHistoryKey(userId: string) {
  return `${ADVANCED_SEARCH_HISTORY_KEY_PREFIX}.${userId}`;
}

function createDefaultPageProperties(): PageProperty[] {
  return [
    { id: 'created', name: 'Created', type: 'date', value: new Date().toISOString().split('T')[0] },
    { id: 'status', name: 'Status', type: 'text', value: 'Draft' },
  ];
}

function groupNotesByKeywords(notesToGroup: Note[]): SmartFolderGroup[] {
  const groups: Record<string, Note[]> = {};
  const uncategorized: Note[] = [];

  const topicPatterns: Record<string, string[]> = {
    'Study Notes': ['study', 'learn', 'exam', 'test', 'quiz', 'chapter', 'lecture', 'class', 'course'],
    Work: ['meeting', 'project', 'deadline', 'client', 'report', 'task', 'work', 'office', 'team'],
    Personal: ['diary', 'journal', 'personal', 'life', 'family', 'friend', 'birthday', 'vacation'],
    Ideas: ['idea', 'brainstorm', 'concept', 'thought', 'plan', 'goal', 'dream', 'future'],
    Research: ['research', 'analysis', 'data', 'study', 'paper', 'article', 'source', 'reference'],
    Technical: ['code', 'programming', 'software', 'api', 'database', 'server', 'bug', 'feature'],
    Finance: ['budget', 'money', 'expense', 'income', 'investment', 'savings', 'cost', 'price'],
    Health: ['health', 'exercise', 'diet', 'workout', 'medical', 'doctor', 'fitness', 'wellness'],
  };

  notesToGroup.forEach((note) => {
    const content = `${note.title || ''} ${getPlainNoteText(note.content)}`.toLowerCase();
    let matched = false;

    Object.entries(topicPatterns).forEach(([category, keywords]) => {
      if (matched) return;
      if (keywords.some((keyword) => content.includes(keyword))) {
        groups[category] = groups[category] ?? [];
        groups[category].push(note);
        matched = true;
      }
    });

    if (!matched) {
      uncategorized.push(note);
    }
  });

  const result = Object.entries(groups)
    .map(([name, groupedNotes]) => ({ name, notes: groupedNotes }))
    .filter((group) => group.notes.length > 0)
    .sort((a, b) => b.notes.length - a.notes.length);

  if (uncategorized.length > 0) {
    result.push({ name: 'Other', notes: uncategorized });
  }

  return result;
}

function getPropertyDisplayValue(property: PageProperty) {
  if (property.type === 'checkbox') {
    return property.value ? 'Yes' : 'No';
  }
  if (property.type === 'date' && typeof property.value === 'string' && property.value) {
    return new Date(property.value).toLocaleDateString();
  }
  return String(property.value || '');
}

function FilterChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <HapticTouchable
      style={[s.filterChip, active && s.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.85}
      haptic="selection"
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? BG : GOLD_D} /> : null}
      <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{label}</Text>
    </HapticTouchable>
  );
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <HapticTouchable style={s.quickActionCard} onPress={onPress} activeOpacity={0.88} haptic="light">
      <View style={s.quickActionIconWrap}>
        <Ionicons name={icon} size={18} color={ACCENT} />
      </View>
      <Text style={s.quickActionTitle}>{title}</Text>
      <Text style={s.quickActionSubtitle}>{subtitle}</Text>
    </HapticTouchable>
  );
}

function ModalShell({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable style={s.modalBackdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalKeyboard}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{title}</Text>
                {subtitle ? <Text style={s.modalSubtitle}>{subtitle}</Text> : null}
              </View>
              <HapticTouchable onPress={onClose} style={s.modalCloseBtn} haptic="selection">
                <Ionicons name="close" size={18} color={GOLD_D} />
              </HapticTouchable>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  const createInitialBlocks = () => {
    const parsed = parseNoteCanvasBlocks(note.content);
    return parsed.length > 0 ? parsed : [createTextBlock('')];
  };

  const [baseNote, setBaseNote] = useState(note);
  const [baseBlocks, setBaseBlocks] = useState<NoteCanvasBlock[]>(createInitialBlocks);
  const [title, setTitle] = useState(note.title);
  const [blocks, setBlocks] = useState<NoteCanvasBlock[]>(createInitialBlocks);
  const [isFavorite, setIsFavorite] = useState(note.is_favorite);
  const [folderId, setFolderId] = useState<number | null>(note.folder_id);
  const [customFont, setCustomFont] = useState(note.custom_font || 'Inter');
  const [editingCanvasBlockId, setEditingCanvasBlockId] = useState<string | null>(null);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction>('improve');
  const [aiTone, setAiTone] = useState('professional');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [pageProperties, setPageProperties] = useState<PageProperty[]>(createDefaultPageProperties);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<PagePropertyType>('text');

  const blocksSignature = serializeBlocksForComparison(blocks);
  const baseBlocksSignature = serializeBlocksForComparison(baseBlocks);
  const dirty = title !== baseNote.title || customFont !== baseNote.custom_font || blocksSignature !== baseBlocksSignature;
  const toneOptions = ['professional', 'casual', 'formal', 'friendly', 'academic', 'creative', 'persuasive'];
  const combinedTextContent = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.content)
    .join('\n\n');
  const activeCanvasBlock =
    editingCanvasBlockId
      ? blocks.find((block) => block.type === 'canvas' && block.id === editingCanvasBlockId)
      : null;

  useEffect(() => {
    AsyncStorage.getItem(pagePropertiesKey(user.username, note.id))
      .then((raw) => {
        if (!raw) {
          setPageProperties(createDefaultPageProperties());
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          setPageProperties(Array.isArray(parsed) ? parsed : createDefaultPageProperties());
        } catch {
          setPageProperties(createDefaultPageProperties());
        }
      })
      .catch(() => setPageProperties(createDefaultPageProperties()));
  }, [note.id, user.username]);

  useEffect(() => {
    AsyncStorage.setItem(pagePropertiesKey(user.username, note.id), JSON.stringify(pageProperties)).catch(() => {});
  }, [note.id, pageProperties, user.username]);

  const normalizeBlocks = (nextBlocks: NoteCanvasBlock[]) => {
    const normalized: NoteCanvasBlock[] = [];
    nextBlocks.forEach((block) => {
      if (block.type === 'text' && normalized[normalized.length - 1]?.type === 'text') {
        const prev = normalized[normalized.length - 1] as Extract<NoteCanvasBlock, { type: 'text' }>;
        prev.content = [prev.content, block.content].filter(Boolean).join('\n\n');
        return;
      }
      normalized.push(block);
    });
    return normalized.length > 0 ? normalized : [createTextBlock('')];
  };

  const updateBlocks = (updater: (current: NoteCanvasBlock[]) => NoteCanvasBlock[]) => {
    setBlocks((current) => normalizeBlocks(updater(current)));
  };

  const updateTextBlock = (blockId: string, nextContent: string) => {
    updateBlocks((current) => current.map((block) => (
      block.type === 'text' && block.id === blockId
        ? { ...block, content: nextContent }
        : block
    )));
  };

  const insertTextAfter = (afterIndex: number) => {
    updateBlocks((current) => {
      const next = current.slice();
      next.splice(afterIndex + 1, 0, createTextBlock(''));
      return next;
    });
  };

  const openNewCanvasAfter = (afterIndex: number) => {
    const newBlock = createCanvasBlock();
    updateBlocks((current) => {
      const next = current.slice();
      next.splice(afterIndex + 1, 0, newBlock);
      return next;
    });
    setEditingCanvasBlockId(newBlock.id);
    setShowCanvasModal(true);
  };

  const removeCanvasBlock = (blockId: string) => {
    updateBlocks((current) => current.filter((block) => block.id !== blockId));
  };

  const addPageProperty = () => {
    if (!newPropertyName.trim()) return;
    setPageProperties((current) => [
      ...current,
      {
        id: `prop-${Date.now()}`,
        name: newPropertyName.trim(),
        type: newPropertyType,
        value: newPropertyType === 'checkbox' ? false : '',
      },
    ]);
    setNewPropertyName('');
    setNewPropertyType('text');
  };

  const updatePageProperty = (propertyId: string, value: string | boolean) => {
    setPageProperties((current) => current.map((property) => (
      property.id === propertyId ? { ...property, value } : property
    )));
  };

  const deletePageProperty = (propertyId: string) => {
    setPageProperties((current) => current.filter((property) => property.id !== propertyId));
  };

  const save = async () => {
    if (saving) return true;
    setSaving(true);
    const mergedContent = buildNoteContentFromBlocks(blocks);
    try {
      const updated = await updateNote({
        noteId: note.id,
        title: title.trim() || 'Untitled Note',
        content: mergedContent,
        customFont,
      });
      const nextNote = {
        ...baseNote,
        title: updated.title,
        content: mergedContent,
        updated_at: updated.updated_at,
        is_favorite: isFavorite,
        folder_id: folderId,
        custom_font: normalizeNoteFont(updated.custom_font ?? customFont),
      };
      setBaseNote(nextNote);
      setBaseBlocks(normalizeBlocks(blocks));
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
      const mergedContent = buildNoteContentFromBlocks(blocks);
      const nextNote = {
        ...baseNote,
        title,
        content: mergedContent,
        folder_id: nextFolderId,
        is_favorite: isFavorite,
        custom_font: customFont,
      };
      setBaseNote(nextNote);
      setBaseBlocks(normalizeBlocks(blocks));
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

  const runAiAssist = async () => {
    if (aiBusy) return;

    const cleanContent = stripHtml(combinedTextContent);
    const trimmedPrompt = aiPrompt.trim();
    const needsPrompt = aiAction === 'generate';

    if (needsPrompt && !trimmedPrompt) {
      Alert.alert('Prompt required', 'Enter a topic or prompt for AI to generate content.');
      return;
    }

    if (!needsPrompt && !trimmedPrompt && !cleanContent) {
      Alert.alert('No content', 'Write some note content or add an override before using AI assist.');
      return;
    }

    setAiBusy(true);
    try {
      const result = await invokeNotesAgent({
        userId: user.username,
        action: aiAction === 'grammar' ? 'grammar' : aiAction,
        content: aiAction === 'generate' ? '' : (trimmedPrompt || cleanContent).slice(0, 2000),
        topic: (aiAction === 'generate' || aiAction === 'code') ? trimmedPrompt : '',
        tone: aiTone,
        context: `${title}\n\n${cleanContent}`.slice(0, 2000),
      });
      const suggestion = stripHtml(result?.content || '').trim() || String(result?.content || '').trim();
      if (!suggestion) {
        throw new Error('AI returned empty content');
      }
      setAiSuggestion(suggestion);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process AI request';
      Alert.alert('AI assist failed', message);
    } finally {
      setAiBusy(false);
    }
  };

  const applyAiSuggestion = (mode: 'replace' | 'append') => {
    if (!aiSuggestion.trim()) return;
    updateBlocks((current) => {
      const canvases = current.filter((block) => block.type === 'canvas');
      if (mode === 'replace') {
        return [createTextBlock(aiSuggestion.trim()), ...canvases];
      }

      const next = current.slice();
      const lastTextIndex = [...next].reverse().findIndex((block) => block.type === 'text');
      if (lastTextIndex === -1) {
        next.push(createTextBlock(aiSuggestion.trim()));
        return next;
      }
      const resolvedIndex = next.length - 1 - lastTextIndex;
      const target = next[resolvedIndex];
      if (target?.type === 'text') {
        next[resolvedIndex] = {
          ...target,
          content: target.content.trim() ? `${target.content.trim()}\n\n${aiSuggestion.trim()}` : aiSuggestion.trim(),
        };
      }
      return next;
    });
    setAiSuggestion('');
    setAiPrompt('');
    setShowAiModal(false);
  };

  const exportNoteAsText = async () => {
    const body = stripHtml(getPlainNoteText(buildNoteContentFromBlocks(blocks)));
    const propertiesText = pageProperties
      .map((property) => `${property.name}: ${getPropertyDisplayValue(property)}`)
      .join('\n');
    const message = [
      title.trim() || 'Untitled Note',
      propertiesText ? `\n${propertiesText}` : '',
      body ? `\n${body}` : '',
    ].join('\n\n');

    try {
      await Share.share({
        title: title.trim() || 'Untitled Note',
        message,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Failed to export note';
      Alert.alert('Export failed', messageText);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AmbientBubbles theme={CURRENT_THEME} variant="notes" opacity={0.82} />
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.editorHeader}>
          <HapticTouchable onPress={handleBack} style={s.iconBtn} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </HapticTouchable>
          <Text style={s.editorHeaderTitle} numberOfLines={1}>
            {title.trim() ? title.toLowerCase() : 'untitled note'}
          </Text>
          <View style={s.editorActions}>
            <HapticTouchable onPress={() => setShowPropertiesModal(true)} style={s.iconBtn} haptic="selection">
              <Ionicons name="options-outline" size={18} color={GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={() => openNewCanvasAfter(blocks.length - 1)} style={s.iconBtn} haptic="selection">
              <Ionicons name="brush-outline" size={18} color={hasCanvasPayload(buildNoteContentFromBlocks(blocks)) ? ACCENT : GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={() => setShowAiModal(true)} style={s.iconBtn} haptic="selection">
              <Ionicons name="sparkles-outline" size={18} color={ACCENT} />
            </HapticTouchable>
            <HapticTouchable onPress={() => setShowExportModal(true)} style={s.iconBtn} haptic="selection">
              <Ionicons name="share-social-outline" size={18} color={ACCENT} />
            </HapticTouchable>
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
            <Text style={s.editorMetaText}>updated {formatDate(baseNote.updated_at)}</Text>
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
            style={[s.titleInput, { fontFamily: resolveNoteFont(customFont, 'title') }]}
          />

          <View style={s.fontSection}>
            <Text style={s.sectionCaption}>font</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fontChips}>
              {NOTE_FONT_OPTIONS.map((font) => (
                <HapticTouchable
                  key={font}
                  style={[s.fontChip, customFont === font && s.fontChipActive]}
                  onPress={() => setCustomFont(font)}
                  haptic="selection"
                >
                  <Text style={[s.fontChipText, customFont === font && s.fontChipTextActive, { fontFamily: resolveNoteFont(font, 'body') }]}>
                    {font}
                  </Text>
                </HapticTouchable>
              ))}
            </ScrollView>
          </View>

          <View style={s.inlineComposer}>
            <View style={s.inlineInsertRow}>
              <HapticTouchable style={s.inlineInsertBtn} onPress={() => insertTextAfter(-1)} haptic="selection">
                <Ionicons name="text-outline" size={15} color={ACCENT} />
                <Text style={s.inlineInsertBtnText}>text</Text>
              </HapticTouchable>
              <HapticTouchable style={s.inlineInsertBtn} onPress={() => openNewCanvasAfter(-1)} haptic="selection">
                <Ionicons name="brush-outline" size={15} color={ACCENT} />
                <Text style={s.inlineInsertBtnText}>canvas</Text>
              </HapticTouchable>
            </View>

            {blocks.map((block, index) => (
              <View key={block.id} style={s.inlineBlockWrap}>
                {block.type === 'text' ? (
                  <View style={s.inlineTextBlock}>
                    <TextInput
                      value={block.content}
                      onChangeText={(value) => updateTextBlock(block.id, value)}
                      placeholder={index === 0 ? 'Start writing your note...' : 'Continue writing...'}
                      placeholderTextColor={DIM2}
                      style={[s.inlineTextInput, { fontFamily: resolveNoteFont(customFont, 'body') }]}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                ) : (
                  <View style={s.inlineCanvasBlock}>
                    <View style={s.inlineCanvasHeader}>
                      <View>
                        <Text style={s.sectionCaption}>canvas</Text>
                        <Text style={s.canvasSubtext}>inline sketch block</Text>
                      </View>
                      <View style={s.inlineCanvasActions}>
                        <HapticTouchable
                          style={s.inlineMiniBtn}
                          onPress={() => {
                            setEditingCanvasBlockId(block.id);
                            setShowCanvasModal(true);
                          }}
                          haptic="selection"
                        >
                          <Ionicons name="create-outline" size={16} color={ACCENT} />
                        </HapticTouchable>
                        <HapticTouchable
                          style={s.inlineMiniBtn}
                          onPress={() => removeCanvasBlock(block.id)}
                          haptic="warning"
                        >
                          <Ionicons name="trash-outline" size={16} color={RED} />
                        </HapticTouchable>
                      </View>
                    </View>
                    <CanvasPreview canvasData={block.canvasData} theme={CURRENT_THEME} />
                  </View>
                )}

                <View style={s.inlineInsertRow}>
                  <HapticTouchable style={s.inlineInsertBtn} onPress={() => insertTextAfter(index)} haptic="selection">
                    <Ionicons name="text-outline" size={15} color={ACCENT} />
                    <Text style={s.inlineInsertBtnText}>text</Text>
                  </HapticTouchable>
                  <HapticTouchable style={s.inlineInsertBtn} onPress={() => openNewCanvasAfter(index)} haptic="selection">
                    <Ionicons name="brush-outline" size={15} color={ACCENT} />
                    <Text style={s.inlineInsertBtnText}>canvas</Text>
                  </HapticTouchable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalShell
        visible={showAiModal}
        title="AI Assist"
        subtitle="Mobile version of the browser note tools"
        onClose={() => {
          setShowAiModal(false);
          setAiSuggestion('');
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            <Text style={s.modalSectionLabel}>quick actions</Text>
            <View style={s.aiActionsWrap}>
              {[
                ['grammar', 'Fix Grammar'],
                ['improve', 'Improve'],
                ['simplify', 'Simplify'],
                ['expand', 'Expand'],
                ['summarize', 'Summarize'],
                ['continue', 'Continue'],
                ['generate', 'Generate'],
                ['tone_change', 'Tone'],
                ['code', 'Code'],
              ].map(([value, label]) => (
                <HapticTouchable
                  key={value}
                  style={[s.aiActionChip, aiAction === value && s.aiActionChipActive]}
                  onPress={() => setAiAction(value as AiAction)}
                  haptic="selection"
                >
                  <Text style={[s.aiActionChipText, aiAction === value && s.aiActionChipTextActive]}>{label}</Text>
                </HapticTouchable>
              ))}
            </View>

            {aiAction === 'tone_change' ? (
              <>
                <Text style={s.modalSectionLabel}>tone</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.inlineChips}>
                  {toneOptions.map((tone) => (
                    <FilterChip key={tone} label={tone} active={aiTone === tone} onPress={() => setAiTone(tone)} />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={s.modalSectionLabel}>
              {aiAction === 'generate' ? 'topic or prompt' : 'optional override'}
            </Text>
            <TextInput
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder={aiAction === 'generate' ? 'Explain graph algorithms for exam prep...' : 'Leave blank to use the current note content'}
              placeholderTextColor={DIM2}
              style={[s.modalInput, s.modalTextarea]}
              multiline
              textAlignVertical="top"
            />

            <Text style={s.aiHint}>
              {aiAction === 'generate'
                ? 'Generate will append or replace from your prompt.'
                : 'Without text selection on mobile, AI works on the full note by default.'}
            </Text>

            {aiSuggestion ? (
              <>
                <Text style={s.modalSectionLabel}>suggestion</Text>
                <View style={s.suggestionCard}>
                  <Text style={s.suggestionText}>{aiSuggestion}</Text>
                </View>
                <View style={s.rowActions}>
                  <HapticTouchable style={[s.secondaryBtn, { flex: 1 }]} onPress={() => applyAiSuggestion('replace')} haptic="medium">
                    <Text style={s.secondaryBtnText}>replace note</Text>
                  </HapticTouchable>
                  <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={() => applyAiSuggestion('append')} haptic="success">
                    <Text style={s.primaryBtnText}>append</Text>
                  </HapticTouchable>
                </View>
              </>
            ) : null}

            <View style={s.rowActions}>
              <HapticTouchable style={[s.secondaryBtn, { flex: 1 }]} onPress={() => setShowAiModal(false)} haptic="selection">
                <Text style={s.secondaryBtnText}>close</Text>
              </HapticTouchable>
              <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={runAiAssist} haptic="medium" disabled={aiBusy}>
                <Text style={s.primaryBtnText}>{aiBusy ? 'processing...' : 'run ai'}</Text>
              </HapticTouchable>
            </View>
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell
        visible={showPropertiesModal}
        title="Page Properties"
        subtitle="Browser page properties on mobile"
        onClose={() => setShowPropertiesModal(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            {pageProperties.map((property) => (
              <View key={property.id} style={s.propertyCard}>
                <View style={s.propertyHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.propertyName}>{property.name}</Text>
                    <Text style={s.propertyMeta}>{property.type}</Text>
                  </View>
                  <HapticTouchable style={s.templateDeleteBtn} onPress={() => deletePageProperty(property.id)} haptic="warning">
                    <Ionicons name="trash-outline" size={16} color={RED} />
                  </HapticTouchable>
                </View>
                {property.type === 'checkbox' ? (
                  <HapticTouchable style={[s.selectRow, property.value && s.selectRowActive]} onPress={() => updatePageProperty(property.id, !property.value)} haptic="selection">
                    <Text style={s.selectRowTitle}>{property.value ? 'checked' : 'unchecked'}</Text>
                    <Ionicons name={property.value ? 'checkbox' : 'square-outline'} size={20} color={property.value ? ACCENT : GOLD_D} />
                  </HapticTouchable>
                ) : (
                  <TextInput
                    value={String(property.value ?? '')}
                    onChangeText={(value) => updatePageProperty(property.id, value)}
                    placeholder={`${property.name.toLowerCase()}...`}
                    placeholderTextColor={DIM2}
                    style={s.modalInput}
                  />
                )}
              </View>
            ))}

            <View style={s.formCard}>
              <Text style={s.modalSectionLabel}>add property</Text>
              <TextInput
                value={newPropertyName}
                onChangeText={setNewPropertyName}
                placeholder="property name"
                placeholderTextColor={DIM2}
                style={s.modalInput}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.inlineChips}>
                {(['text', 'number', 'date', 'checkbox', 'tags', 'person', 'url'] as PagePropertyType[]).map((type) => (
                  <FilterChip key={type} label={type} active={newPropertyType === type} onPress={() => setNewPropertyType(type)} />
                ))}
              </ScrollView>
              <HapticTouchable style={s.primaryBtn} onPress={addPageProperty} haptic="medium">
                <Text style={s.primaryBtnText}>add property</Text>
              </HapticTouchable>
            </View>
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell
        visible={showExportModal}
        title="Export Note"
        subtitle="Browser export actions adapted for mobile"
        onClose={() => setShowExportModal(false)}
      >
        <View style={s.modalBody}>
          <HapticTouchable
            style={s.selectRow}
            onPress={async () => {
              await exportNoteAsText();
              setShowExportModal(false);
            }}
            haptic="selection"
          >
            <View style={{ flex: 1 }}>
              <Text style={s.selectRowTitle}>share note text</Text>
              <Text style={s.selectRowMeta}>exports title, properties, and plain text content</Text>
            </View>
            <Ionicons name="share-social-outline" size={20} color={ACCENT} />
          </HapticTouchable>
        </View>
      </ModalShell>

      <CanvasNoteModal
        visible={showCanvasModal}
        initialData={activeCanvasBlock?.type === 'canvas' ? activeCanvasBlock.canvasData : ''}
        theme={CURRENT_THEME}
        onClose={() => {
          if (activeCanvasBlock?.type === 'canvas' && !activeCanvasBlock.canvasData) {
            removeCanvasBlock(activeCanvasBlock.id);
          }
          setShowCanvasModal(false);
          setEditingCanvasBlockId(null);
        }}
        onSave={(nextCanvasData, nextPreviewData) => {
          if (editingCanvasBlockId) {
            updateBlocks((current) => current.map((block) => (
              block.type === 'canvas' && block.id === editingCanvasBlockId
                ? {
                    ...block,
                    canvasData: nextCanvasData,
                    canvasPreview: nextPreviewData,
                  }
                : block
            )));
          }
          setShowCanvasModal(false);
          setEditingCanvasBlockId(null);
        }}
      />
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
      <AmbientBubbles theme={CURRENT_THEME} variant="notes" opacity={0.82} />
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
                <Text style={s.notePreview} numberOfLines={2}>{getPlainNoteText(item.content) || 'No content'}</Text>
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
  onOpenMedia,
}: Props & {
  refreshTick: number;
  onCreated: () => void;
  onOpenEditor: (note: Note, folders: Folder[]) => void;
  onOpenTrash: () => void;
  onOpenMedia: () => void;
}) {
  const layout = useResponsiveLayout();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentNote[]>([]);
  const [showSmartFolders, setShowSmartFolders] = useState(false);
  const [smartFolders, setSmartFolders] = useState<SmartFolderGroup[]>([]);
  const [smartFolderName, setSmartFolderName] = useState<string | null>(null);
  const [smartFolderNoteIds, setSmartFolderNoteIds] = useState<number[] | null>(null);
  const [advancedQuery, setAdvancedQuery] = useState('');
  const [advancedFolder, setAdvancedFolder] = useState<'all' | 'none' | `${number}`>('all');
  const [advancedDateFrom, setAdvancedDateFrom] = useState('');
  const [advancedDateTo, setAdvancedDateTo] = useState('');
  const [advancedCaseSensitive, setAdvancedCaseSensitive] = useState(false);
  const [advancedRegex, setAdvancedRegex] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreating, setFolderCreating] = useState(false);

  const [showTemplates, setShowTemplates] = useState(false);
  const [templateTab, setTemplateTab] = useState<TemplateTab>('built-in');
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({ name: '', description: '', content: '' });

  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<number[]>([]);
  const [importingChat, setImportingChat] = useState(false);

  const [showConvert, setShowConvert] = useState(false);
  const [selectedConvertNoteIds, setSelectedConvertNoteIds] = useState<number[]>([]);
  const [convertTarget, setConvertTarget] = useState<ConvertTarget>('flashcards');
  const [convertDifficulty, setConvertDifficulty] = useState<Difficulty>('medium');
  const [convertCount, setConvertCount] = useState(10);
  const [converting, setConverting] = useState(false);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const [notesData, foldersData] = await Promise.all([getNotes(user.username), getFolders(user.username)]);
      setNotes(Array.isArray(notesData) ? notesData.map(buildNoteFromApi) : []);
      setFolders(foldersData?.folders ?? []);
    } catch {
      setNotes([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomTemplates = async () => {
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_TEMPLATE_KEY);
      setCustomTemplates(raw ? JSON.parse(raw) : []);
    } catch {
      setCustomTemplates([]);
    }
  };

  const loadRecentlyViewed = async () => {
    try {
      const raw = await AsyncStorage.getItem(recentNotesKey(user.username));
      setRecentlyViewed(raw ? JSON.parse(raw) : []);
    } catch {
      setRecentlyViewed([]);
    }
  };

  const loadSearchHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(advancedSearchHistoryKey(user.username));
      setSearchHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setSearchHistory([]);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, [user.username, refreshTick]);

  useEffect(() => {
    loadCustomTemplates();
    loadRecentlyViewed();
    loadSearchHistory();
  }, []);

  useEffect(() => {
    setSmartFolders(groupNotesByKeywords(notes));
  }, [notes]);

  useEffect(() => {
    if (!showChatImport) return;
    getChatSessions(user.username)
      .then((data) => setChatSessions(data?.sessions ?? []))
      .catch(() => setChatSessions([]));
  }, [showChatImport, user.username]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    let current = notes;

    if (smartFolderNoteIds) {
      current = current.filter((note) => smartFolderNoteIds.includes(note.id));
    }

    if (filter === 'favorites') {
      current = current.filter((note) => note.is_favorite);
    } else if (filter === 'source:flashcards') {
      current = current.filter((note) => matchesSource(note, 'flashcards'));
    } else if (filter === 'source:quizzes') {
      current = current.filter((note) => matchesSource(note, 'quizzes'));
    } else if (filter === 'source:roadmaps') {
      current = current.filter((note) => matchesSource(note, 'roadmaps'));
    } else if (filter.startsWith('folder:')) {
      const folderId = Number(filter.split(':')[1]);
      current = current.filter((note) => note.folder_id === folderId);
    }

    if (!query) return current;

    return current.filter((note) => (
      note.title.toLowerCase().includes(query) ||
      getPlainNoteText(note.content).toLowerCase().includes(query)
    ));
  }, [filter, notes, search, smartFolderNoteIds]);

  const advancedResults = useMemo(() => {
    const query = advancedQuery.trim();
    if (!query) return [] as Note[];

    let current = notes.slice();

    if (advancedFolder !== 'all') {
      if (advancedFolder === 'none') {
        current = current.filter((note) => !note.folder_id);
      } else {
        current = current.filter((note) => note.folder_id === Number(advancedFolder));
      }
    }

    if (advancedDateFrom) {
      current = current.filter((note) => new Date(note.updated_at) >= new Date(advancedDateFrom));
    }
    if (advancedDateTo) {
      current = current.filter((note) => new Date(note.updated_at) <= new Date(advancedDateTo));
    }

    let regex: RegExp | null = null;
    if (advancedRegex) {
      try {
        regex = new RegExp(query, advancedCaseSensitive ? '' : 'i');
      } catch {
        return [];
      }
    }

    return current.filter((note) => {
      const title = note.title || '';
      const content = getPlainNoteText(note.content);
      if (regex) {
        return regex.test(title) || regex.test(content);
      }
      const hayTitle = advancedCaseSensitive ? title : title.toLowerCase();
      const hayContent = advancedCaseSensitive ? content : content.toLowerCase();
      const needle = advancedCaseSensitive ? query : query.toLowerCase();
      return hayTitle.includes(needle) || hayContent.includes(needle);
    });
  }, [advancedCaseSensitive, advancedDateFrom, advancedDateTo, advancedFolder, advancedQuery, advancedRegex, notes]);

  const favoriteCount = notes.filter((note) => note.is_favorite).length;
  const canvasCount = notes.filter((note) => hasCanvasPayload(note.content)).length;
  const notesGridColumns = layout.threeColumn ? 3 : layout.twoColumn ? 2 : 1;
  const activeFilterLabel =
    filter === 'all'
      ? 'all notes'
      : filter === 'favorites'
        ? 'favorite notes'
        : filter === 'source:flashcards'
          ? 'flashcard notes'
          : filter === 'source:quizzes'
            ? 'quiz notes'
            : filter === 'source:roadmaps'
              ? 'roadmap notes'
              : folders.find((folder) => filter === `folder:${folder.id}`)?.name ?? 'folder notes';

  const saveSearchHistory = async (nextHistory: string[]) => {
    setSearchHistory(nextHistory);
    await AsyncStorage.setItem(advancedSearchHistoryKey(user.username), JSON.stringify(nextHistory));
  };

  const trackRecentlyViewed = async (note: Note) => {
    const viewedItem: RecentNote = {
      id: note.id,
      title: note.title,
      viewedAt: new Date().toISOString(),
    };
    const updated = [viewedItem, ...recentlyViewed.filter((item) => item.id !== note.id)].slice(0, 10);
    setRecentlyViewed(updated);
    await AsyncStorage.setItem(recentNotesKey(user.username), JSON.stringify(updated));
  };

  const handleOpenEditor = async (note: Note) => {
    await trackRecentlyViewed(note);
    onOpenEditor(note, folders);
  };

  const createNewNote = async (seed?: Partial<Pick<Note, 'title' | 'content' | 'folder_id' | 'custom_font'>>) => {
    if (creating) return;
    setCreating(true);
    try {
      const newNote = await createNote({
        userId: user.username,
        title: seed?.title ?? 'Untitled Note',
        content: seed?.content ?? '',
        folderId: seed?.folder_id ?? null,
        customFont: normalizeNoteFont(seed?.custom_font),
      });
      const note = buildNoteFromApi(newNote);
      onCreated();
      await handleOpenEditor(note);
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

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || folderCreating) return;
    setFolderCreating(true);
    try {
      await createFolder({ userId: user.username, name });
      setNewFolderName('');
      setShowFolderModal(false);
      await loadLibrary();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create folder';
      Alert.alert('Folder failed', message);
    } finally {
      setFolderCreating(false);
    }
  };

  const saveCustomTemplates = async (templates: CustomTemplate[]) => {
    setCustomTemplates(templates);
    await AsyncStorage.setItem(CUSTOM_TEMPLATE_KEY, JSON.stringify(templates));
  };

  const handleSaveTemplate = async () => {
    if (!templateDraft.name.trim() || !templateDraft.content.trim()) {
      Alert.alert('Template required', 'Add a name and content for the custom template.');
      return;
    }
    const nextTemplate: CustomTemplate = {
      id: `custom-${Date.now()}`,
      name: templateDraft.name.trim(),
      description: templateDraft.description.trim(),
      content: templateDraft.content,
      category: 'custom',
      createdAt: new Date().toISOString(),
    };
    const next = [...customTemplates, nextTemplate];
    await saveCustomTemplates(next);
    setTemplateDraft({ name: '', description: '', content: '' });
    setShowTemplateForm(false);
    setTemplateTab('custom');
  };

  const handleDeleteCustomTemplate = (templateId: string) => {
    Alert.alert('Delete template?', 'This custom template will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = customTemplates.filter((template) => template.id !== templateId);
          await saveCustomTemplates(next);
        },
      },
    ]);
  };

  const handleApplyTemplate = async (template: NoteTemplate) => {
    const filled = applyTemplateVariables(template, user.username);
    setShowTemplates(false);
    await createNewNote({
      title: template.name,
      content: filled,
    });
  };

  const handleImportChat = async () => {
    if (!selectedSessions.length || importingChat) return;
    setImportingChat(true);
    try {
      const data = await convertChatSessionsToNote({
        userId: user.username,
        sessionIds: selectedSessions,
      });
      setShowChatImport(false);
      setSelectedSessions([]);
      onCreated();
      await handleOpenEditor(buildNoteFromApi(data));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import chats';
      Alert.alert('Import failed', message);
    } finally {
      setImportingChat(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedConvertNoteIds.length || converting) return;
    setConverting(true);
    try {
      if (convertTarget === 'flashcards') {
        const data = await convertNotesToFlashcards({
          noteIds: selectedConvertNoteIds,
          cardCount: convertCount,
          difficulty: convertDifficulty,
        });
        Alert.alert(
          'Flashcards created',
          `${data?.card_count ?? convertCount} cards are ready in Flashcards.`,
        );
      } else {
        const data = await convertNotesToQuestions({
          noteIds: selectedConvertNoteIds,
          questionCount: convertCount,
          difficulty: convertDifficulty,
        });
        Alert.alert(
          'Questions created',
          `${data?.question_count ?? convertCount} questions were generated from your notes.`,
        );
      }
      setShowConvert(false);
      setSelectedConvertNoteIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to convert notes';
      Alert.alert('Convert failed', message);
    } finally {
      setConverting(false);
    }
  };

  const handleRunAdvancedSearch = async (nextQuery?: string) => {
    const query = (nextQuery ?? advancedQuery).trim();
    if (!query) return;
    const nextHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, 10);
    await saveSearchHistory(nextHistory);
  };

  const clearSearchHistory = async () => {
    setSearchHistory([]);
    await AsyncStorage.removeItem(advancedSearchHistoryKey(user.username));
  };

  const applySmartFolder = (group: SmartFolderGroup) => {
    setSmartFolderName(group.name);
    setSmartFolderNoteIds(group.notes.map((note) => note.id));
    setShowSmartFolders(false);
  };

  const clearSmartFolder = () => {
    setSmartFolderName(null);
    setSmartFolderNoteIds(null);
  };

  const quickActions = [
    { key: 'advanced', icon: 'filter-outline' as const, title: 'Advanced Search', subtitle: 'folders, dates, regex, history', onPress: () => setShowAdvancedSearch(true) },
    { key: 'recent', icon: 'time-outline' as const, title: 'Recent', subtitle: 'jump back into viewed notes', onPress: () => setShowRecentlyViewed(true) },
    { key: 'smart', icon: 'sparkles-outline' as const, title: 'Smart Folders', subtitle: 'ai-style auto grouping', onPress: () => setShowSmartFolders(true) },
    { key: 'templates', icon: 'document-text-outline' as const, title: 'Templates', subtitle: 'start from note layouts', onPress: () => setShowTemplates(true) },
    { key: 'chat', icon: 'chatbox-ellipses-outline' as const, title: 'From Chat', subtitle: 'turn chats into notes', onPress: () => setShowChatImport(true) },
    {
      key: 'convert',
      icon: 'shuffle-outline' as const,
      title: 'Convert',
      subtitle: 'notes to flashcards or questions',
      onPress: () => {
        setSelectedConvertNoteIds(filteredNotes.slice(0, 5).map((note) => note.id));
        setShowConvert(true);
      },
    },
    { key: 'media', icon: 'videocam-outline' as const, title: 'Media Notes', subtitle: 'youtube and transcript notes', onPress: onOpenMedia },
  ];

  const filterChips = [
    <FilterChip key="all" label="all" active={filter === 'all'} onPress={() => setFilter('all')} icon="albums-outline" />,
    <FilterChip key="favorites" label="favorites" active={filter === 'favorites'} onPress={() => setFilter('favorites')} icon="star-outline" />,
    ...(smartFolderName
      ? [<FilterChip key="smart-folder" label={smartFolderName} active onPress={clearSmartFolder} icon="sparkles-outline" />]
      : []),
    ...folders.map((folder) => (
      <FilterChip
        key={folder.id}
        label={folder.name}
        active={filter === `folder:${folder.id}`}
        onPress={() => setFilter(`folder:${folder.id}`)}
        icon="folder-outline"
      />
    )),
    <FilterChip
      key="flashcards"
      label={`flashcards ${countSource(notes, 'flashcards')}`}
      active={filter === 'source:flashcards'}
      onPress={() => setFilter('source:flashcards')}
      icon="duplicate-outline"
    />,
    <FilterChip
      key="quizzes"
      label={`quizzes ${countSource(notes, 'quizzes')}`}
      active={filter === 'source:quizzes'}
      onPress={() => setFilter('source:quizzes')}
      icon="help-circle-outline"
    />,
    <FilterChip
      key="roadmaps"
      label={`roadmaps ${countSource(notes, 'roadmaps')}`}
      active={filter === 'source:roadmaps'}
      onPress={() => setFilter('source:roadmaps')}
      icon="trail-sign-outline"
    />,
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AmbientBubbles theme={CURRENT_THEME} variant="notes" opacity={0.82} />
      {layout.isTablet ? (
        <View style={s.header}>
          {onBack ? (
            <HapticTouchable onPress={onBack} style={{ marginRight: 12 }} haptic="selection">
              <Ionicons name="chevron-back" size={22} color={GOLD_L} />
            </HapticTouchable>
          ) : null}
          <View style={s.headerTitleWrap}>
            <Text style={s.title}>notes</Text>
            <Text style={s.subtitle}>search · recent · smart folders · templates · imports</Text>
          </View>
          <View style={s.headerActionsRow}>
            <HapticTouchable onPress={() => setShowAdvancedSearch(true)} style={s.headerIconBtn} haptic="selection">
              <Ionicons name="filter-outline" size={17} color={GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={() => setShowRecentlyViewed(true)} style={s.headerIconBtn} haptic="selection">
              <Ionicons name="time-outline" size={17} color={GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={() => setShowFolderModal(true)} style={s.headerIconBtn} haptic="selection">
              <Ionicons name="folder-open-outline" size={17} color={GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={onOpenTrash} style={s.headerIconBtn} haptic="selection">
              <Ionicons name="trash-outline" size={18} color={GOLD_D} />
            </HapticTouchable>
            <HapticTouchable onPress={() => createNewNote()} style={[s.headerIconBtn, s.headerIconBtnPrimary]} haptic="medium" disabled={creating}>
              <Ionicons name="add" size={20} color={BG} />
            </HapticTouchable>
          </View>
        </View>
      ) : (
        <View style={s.mobileHeader}>
          {onBack ? (
            <HapticTouchable onPress={onBack} style={{ marginRight: 12 }} haptic="selection">
              <Ionicons name="chevron-back" size={22} color={GOLD_L} />
            </HapticTouchable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={s.mobileTitle}>notes</Text>
            <Text style={s.mobileSubtitle} numberOfLines={1}>capture · sketch · organize</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={`notes-grid-${notesGridColumns}`}
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          numColumns={notesGridColumns}
          columnWrapperStyle={notesGridColumns > 1 ? s.noteGridRow : undefined}
          ListHeaderComponent={(
            <View style={s.listHeader}>
              {/* Workspace — quick action grid */}
              <Text style={s.sectionLabel}>workspace</Text>
              <View style={s.actionsGrid}>
                {quickActions.map((action) => (
                  <HapticTouchable key={action.key} style={s.actionPill} onPress={action.onPress} haptic="selection">
                    <View style={s.actionPillIcon}>
                      <Ionicons name={action.icon} size={16} color={ACCENT} />
                    </View>
                    <Text style={s.actionPillText}>{action.title}</Text>
                    <Ionicons name="chevron-forward" size={13} color={GOLD_D} style={{ marginLeft: 'auto' }} />
                  </HapticTouchable>
                ))}
              </View>

              {/* Library header */}
              <View style={s.libHeader}>
                <View>
                  <Text style={s.sectionEyebrow}>library</Text>
                  {search.trim() ? (
                    <Text style={s.sectionTitle}>{filteredNotes.length} result{filteredNotes.length === 1 ? '' : 's'}</Text>
                  ) : null}
                </View>
                <Text style={s.libMeta}>{search.trim() ? 'clear search to reset' : 'sorted by latest'}</Text>
              </View>

              {/* Search + new */}
              <View style={s.searchRow}>
                <View style={s.searchBar}>
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
                <HapticTouchable style={s.searchNewBtn} onPress={() => createNewNote()} haptic="medium" disabled={creating}>
                  <Ionicons name="add" size={20} color={BG} />
                </HapticTouchable>
              </View>

              {/* Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
                {filterChips}
              </ScrollView>
            </View>
          )}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{search ? 'no results' : 'no notes yet'}</Text>
              <Text style={s.emptyHint}>start with a new note, template, or imported chat</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const preview = getPlainNoteText(item.content).slice(0, 140);
            const folderName = folders.find((folder) => folder.id === item.folder_id)?.name;
            const hasCanvas = hasCanvasPayload(item.content);

            return (
              <HapticTouchable
                style={[s.noteCard, notesGridColumns > 1 && s.noteCardGrid]}
                onPress={() => { void handleOpenEditor(item); }}
                activeOpacity={0.88}
                haptic="light"
              >
                <View style={s.noteCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={s.noteTagRow}>
                      <View style={s.noteTag}>
                        <Text style={s.noteTagText}>{formatDate(item.updated_at)}</Text>
                      </View>
                      {folderName ? (
                        <View style={s.noteTag}>
                          <Ionicons name="folder-outline" size={11} color={DIM2} />
                          <Text style={s.noteTagText}>{folderName}</Text>
                        </View>
                      ) : null}
                      {hasCanvas ? (
                        <View style={s.noteTagAccent}>
                          <Ionicons name="brush-outline" size={11} color={ACCENT} />
                          <Text style={s.noteTagAccentText}>canvas</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.noteCardTitle, { fontFamily: resolveNoteFont(item.custom_font, 'title') }]} numberOfLines={2}>{item.title || 'Untitled Note'}</Text>
                  </View>
                  <HapticTouchable onPress={() => toggleCardFavorite(item)} style={s.starBtn} haptic="selection">
                    <Ionicons name={item.is_favorite ? 'star' : 'star-outline'} size={16} color={item.is_favorite ? ACCENT : GOLD_D} />
                  </HapticTouchable>
                </View>
                <Text style={[s.notePreview, { fontFamily: resolveNoteFont(item.custom_font, 'body') }]} numberOfLines={3}>
                  {preview || 'Open this note to start writing.'}
                </Text>
                <View style={s.noteCardFooter}>
                  <Text style={s.noteMetaText}>{item.is_favorite ? 'starred note' : 'tap to open and edit'}</Text>
                  <Ionicons name="chevron-forward" size={16} color={ACCENT} />
                </View>
              </HapticTouchable>
            );
          }}
        />
      )}

      <ModalShell visible={showFolderModal} title="Create Folder" subtitle="Add a new notes folder" onClose={() => setShowFolderModal(false)}>
        <View style={s.modalBody}>
          <TextInput
            value={newFolderName}
            onChangeText={setNewFolderName}
            placeholder="folder name..."
            placeholderTextColor={DIM2}
            style={s.modalInput}
            autoFocus
          />
          <View style={s.rowActions}>
            <HapticTouchable style={[s.secondaryBtn, { flex: 1 }]} onPress={() => setShowFolderModal(false)} haptic="selection">
              <Text style={s.secondaryBtnText}>cancel</Text>
            </HapticTouchable>
            <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={handleCreateFolder} haptic="medium" disabled={folderCreating}>
              <Text style={s.primaryBtnText}>{folderCreating ? 'creating...' : 'create'}</Text>
            </HapticTouchable>
          </View>
        </View>
      </ModalShell>

      <ModalShell visible={showTemplates} title="Templates" subtitle="Browser note templates on mobile" onClose={() => setShowTemplates(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            <View style={s.templateTabs}>
              <HapticTouchable style={[s.tabBtn, templateTab === 'built-in' && s.tabBtnActive]} onPress={() => setTemplateTab('built-in')} haptic="selection">
                <Text style={[s.tabBtnText, templateTab === 'built-in' && s.tabBtnTextActive]}>built-in</Text>
              </HapticTouchable>
              <HapticTouchable style={[s.tabBtn, templateTab === 'custom' && s.tabBtnActive]} onPress={() => setTemplateTab('custom')} haptic="selection">
                <Text style={[s.tabBtnText, templateTab === 'custom' && s.tabBtnTextActive]}>custom</Text>
              </HapticTouchable>
            </View>

            {templateTab === 'custom' ? (
              <>
                {!showTemplateForm ? (
                  <HapticTouchable style={s.dashedCard} onPress={() => setShowTemplateForm(true)} haptic="selection">
                    <Ionicons name="add-circle-outline" size={22} color={ACCENT} />
                    <Text style={s.dashedCardTitle}>create custom template</Text>
                    <Text style={s.dashedCardText}>save reusable note structures on this device</Text>
                  </HapticTouchable>
                ) : (
                  <View style={s.formCard}>
                    <TextInput
                      value={templateDraft.name}
                      onChangeText={(value) => setTemplateDraft((draft) => ({ ...draft, name: value }))}
                      placeholder="template name"
                      placeholderTextColor={DIM2}
                      style={s.modalInput}
                    />
                    <TextInput
                      value={templateDraft.description}
                      onChangeText={(value) => setTemplateDraft((draft) => ({ ...draft, description: value }))}
                      placeholder="description"
                      placeholderTextColor={DIM2}
                      style={s.modalInput}
                    />
                    <TextInput
                      value={templateDraft.content}
                      onChangeText={(value) => setTemplateDraft((draft) => ({ ...draft, content: value }))}
                      placeholder="template content with {{date}}, {{time}}, {{user}}, {{title}}"
                      placeholderTextColor={DIM2}
                      style={[s.modalInput, s.modalTextarea]}
                      multiline
                      textAlignVertical="top"
                    />
                    <View style={s.rowActions}>
                      <HapticTouchable
                        style={[s.secondaryBtn, { flex: 1 }]}
                        onPress={() => {
                          setShowTemplateForm(false);
                          setTemplateDraft({ name: '', description: '', content: '' });
                        }}
                        haptic="selection"
                      >
                        <Text style={s.secondaryBtnText}>cancel</Text>
                      </HapticTouchable>
                      <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={handleSaveTemplate} haptic="medium">
                        <Text style={s.primaryBtnText}>save</Text>
                      </HapticTouchable>
                    </View>
                  </View>
                )}

                {customTemplates.map((template) => (
                  <View key={template.id} style={s.templateCard}>
                    <Pressable style={{ flex: 1 }} onPress={() => handleApplyTemplate(template)}>
                      <Text style={s.templateName}>{template.name}</Text>
                      <Text style={s.templateDesc}>{template.description || 'Custom template'}</Text>
                    </Pressable>
                    <View style={s.templateActions}>
                      <HapticTouchable style={s.templateUseBtn} onPress={() => handleApplyTemplate(template)} haptic="selection">
                        <Text style={s.templateUseBtnText}>use</Text>
                      </HapticTouchable>
                      <HapticTouchable style={s.templateDeleteBtn} onPress={() => handleDeleteCustomTemplate(template.id)} haptic="warning">
                        <Ionicons name="trash-outline" size={16} color={RED} />
                      </HapticTouchable>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              BUILT_IN_NOTE_TEMPLATES.map((template) => (
                <HapticTouchable key={template.id} style={s.templateCard} onPress={() => handleApplyTemplate(template)} haptic="light">
                  <View style={s.templateIconWrap}>
                    <Ionicons name="document-text-outline" size={18} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.templateName}>{template.name}</Text>
                    <Text style={s.templateDesc}>{template.description}</Text>
                  </View>
                </HapticTouchable>
              ))
            )}
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell visible={showChatImport} title="Import From Chat" subtitle="Convert AI chat sessions into notes" onClose={() => setShowChatImport(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            {chatSessions.length === 0 ? (
              <View style={s.emptyModalState}>
                <Text style={s.emptyTitle}>no chat sessions</Text>
                <Text style={s.emptyHint}>start a chat first, then come back here</Text>
              </View>
            ) : (
              chatSessions.map((session) => {
                const selected = selectedSessions.includes(session.id);
                return (
                  <HapticTouchable
                    key={session.id}
                    style={[s.selectRow, selected && s.selectRowActive]}
                    onPress={() => setSelectedSessions((current) => (
                      current.includes(session.id)
                        ? current.filter((id) => id !== session.id)
                        : [...current, session.id]
                    ))}
                    haptic="selection"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectRowTitle}>{session.title || 'Untitled Chat'}</Text>
                      <Text style={s.selectRowMeta}>{formatDate(session.updated_at || session.created_at)}</Text>
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? ACCENT : GOLD_D} />
                  </HapticTouchable>
                );
              })
            )}

            <View style={s.rowActions}>
              <HapticTouchable style={[s.secondaryBtn, { flex: 1 }]} onPress={() => setShowChatImport(false)} haptic="selection">
                <Text style={s.secondaryBtnText}>cancel</Text>
              </HapticTouchable>
              <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={handleImportChat} haptic="medium" disabled={importingChat || !selectedSessions.length}>
                <Text style={s.primaryBtnText}>{importingChat ? 'importing...' : `import ${selectedSessions.length}`}</Text>
              </HapticTouchable>
            </View>
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell visible={showConvert} title="Convert Notes" subtitle="Browser note conversion tools" onClose={() => setShowConvert(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            <Text style={s.modalSectionLabel}>target</Text>
            <View style={s.inlineChips}>
              <FilterChip label="flashcards" active={convertTarget === 'flashcards'} onPress={() => setConvertTarget('flashcards')} />
              <FilterChip label="questions" active={convertTarget === 'questions'} onPress={() => setConvertTarget('questions')} />
            </View>

            <Text style={s.modalSectionLabel}>difficulty</Text>
            <View style={s.inlineChips}>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((difficulty) => (
                <FilterChip key={difficulty} label={difficulty} active={convertDifficulty === difficulty} onPress={() => setConvertDifficulty(difficulty)} />
              ))}
            </View>

            <Text style={s.modalSectionLabel}>{convertTarget === 'flashcards' ? 'card count' : 'question count'}</Text>
            <View style={s.inlineChips}>
              {[5, 10, 15, 20].map((count) => (
                <FilterChip key={count} label={String(count)} active={convertCount === count} onPress={() => setConvertCount(count)} />
              ))}
            </View>

            <Text style={s.modalSectionLabel}>notes</Text>
            {notes.map((note) => {
              const selected = selectedConvertNoteIds.includes(note.id);
              return (
                <HapticTouchable
                  key={note.id}
                  style={[s.selectRow, selected && s.selectRowActive]}
                  onPress={() => setSelectedConvertNoteIds((current) => (
                    current.includes(note.id)
                      ? current.filter((id) => id !== note.id)
                      : [...current, note.id]
                  ))}
                  haptic="selection"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.selectRowTitle}>{note.title || 'Untitled Note'}</Text>
                    <Text style={s.selectRowMeta}>{formatDate(note.updated_at)}</Text>
                  </View>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? ACCENT : GOLD_D} />
                </HapticTouchable>
              );
            })}

            <View style={s.rowActions}>
              <HapticTouchable style={[s.secondaryBtn, { flex: 1 }]} onPress={() => setShowConvert(false)} haptic="selection">
                <Text style={s.secondaryBtnText}>cancel</Text>
              </HapticTouchable>
              <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={handleConvert} haptic="medium" disabled={converting || !selectedConvertNoteIds.length}>
                <Text style={s.primaryBtnText}>{converting ? 'converting...' : 'convert'}</Text>
              </HapticTouchable>
            </View>
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell visible={showAdvancedSearch} title="Advanced Search" subtitle="Search all notes with browser-style filters" onClose={() => setShowAdvancedSearch(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            <TextInput
              value={advancedQuery}
              onChangeText={setAdvancedQuery}
              onSubmitEditing={() => { void handleRunAdvancedSearch(); }}
              placeholder="Search all notes..."
              placeholderTextColor={DIM2}
              style={s.modalInput}
              autoFocus
            />

            <Text style={s.modalSectionLabel}>folder</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.inlineChips}>
              <FilterChip label="all folders" active={advancedFolder === 'all'} onPress={() => setAdvancedFolder('all')} />
              <FilterChip label="unfiled" active={advancedFolder === 'none'} onPress={() => setAdvancedFolder('none')} />
              {folders.map((folder) => (
                <FilterChip key={`adv-${folder.id}`} label={folder.name} active={advancedFolder === String(folder.id)} onPress={() => setAdvancedFolder(String(folder.id) as `${number}`)} />
              ))}
            </ScrollView>

            <Text style={s.modalSectionLabel}>modified from</Text>
            <TextInput
              value={advancedDateFrom}
              onChangeText={setAdvancedDateFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={DIM2}
              style={s.modalInput}
            />

            <Text style={s.modalSectionLabel}>modified to</Text>
            <TextInput
              value={advancedDateTo}
              onChangeText={setAdvancedDateTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={DIM2}
              style={s.modalInput}
            />

            <Text style={s.modalSectionLabel}>options</Text>
            <View style={s.inlineChips}>
              <FilterChip label="case sensitive" active={advancedCaseSensitive} onPress={() => setAdvancedCaseSensitive((value) => !value)} />
              <FilterChip label="regex" active={advancedRegex} onPress={() => setAdvancedRegex((value) => !value)} />
            </View>

            {searchHistory.length > 0 ? (
              <>
                <View style={s.historyHeaderRow}>
                  <Text style={s.modalSectionLabel}>recent searches</Text>
                  <HapticTouchable onPress={() => { void clearSearchHistory(); }} haptic="selection">
                    <Text style={s.clearHistoryText}>clear</Text>
                  </HapticTouchable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.inlineChips}>
                  {searchHistory.map((item) => (
                    <FilterChip
                      key={item}
                      label={item}
                      active={advancedQuery === item}
                      onPress={() => {
                        setAdvancedQuery(item);
                        void handleRunAdvancedSearch(item);
                      }}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <View style={s.rowActions}>
              <HapticTouchable style={[s.secondaryBtn, { flex: 1 }]} onPress={() => setShowAdvancedSearch(false)} haptic="selection">
                <Text style={s.secondaryBtnText}>close</Text>
              </HapticTouchable>
              <HapticTouchable style={[s.primaryBtn, { flex: 1 }]} onPress={() => { void handleRunAdvancedSearch(); }} haptic="medium">
                <Text style={s.primaryBtnText}>save search</Text>
              </HapticTouchable>
            </View>

            <Text style={s.modalSectionLabel}>results</Text>
            {advancedQuery.trim() ? advancedResults.map((note) => (
              <HapticTouchable
                key={`result-${note.id}`}
                style={s.selectRow}
                onPress={() => {
                  setShowAdvancedSearch(false);
                  void handleOpenEditor(note);
                }}
                haptic="selection"
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.selectRowTitle}>{note.title || 'Untitled Note'}</Text>
                  <Text style={s.selectRowMeta}>{formatDate(note.updated_at)}</Text>
                </View>
                <Ionicons name="arrow-forward-outline" size={20} color={ACCENT} />
              </HapticTouchable>
            )) : (
              <View style={s.emptyModalState}>
                <Text style={s.emptyTitle}>start searching</Text>
                <Text style={s.emptyHint}>filter by folder, dates, case sensitivity, or regex</Text>
              </View>
            )}
            {advancedQuery.trim() && advancedResults.length === 0 ? (
              <View style={s.emptyModalState}>
                <Text style={s.emptyTitle}>no results</Text>
                <Text style={s.emptyHint}>try different keywords or loosen the filters</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell visible={showRecentlyViewed} title="Recently Viewed" subtitle="Jump back into notes you opened on mobile" onClose={() => setShowRecentlyViewed(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            {recentlyViewed.length === 0 ? (
              <View style={s.emptyModalState}>
                <Text style={s.emptyTitle}>no recent notes</Text>
                <Text style={s.emptyHint}>open a note and it will appear here</Text>
              </View>
            ) : recentlyViewed.map((recent) => {
              const note = notes.find((item) => item.id === recent.id);
              return (
                <HapticTouchable
                  key={`recent-${recent.id}`}
                  style={s.selectRow}
                  onPress={() => {
                    setShowRecentlyViewed(false);
                    if (note) {
                      void handleOpenEditor(note);
                    }
                  }}
                  haptic="selection"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.selectRowTitle}>{recent.title || 'Untitled Note'}</Text>
                    <Text style={s.selectRowMeta}>{formatDate(recent.viewedAt)}</Text>
                  </View>
                  <Ionicons name="time-outline" size={20} color={ACCENT} />
                </HapticTouchable>
              );
            })}
          </View>
        </ScrollView>
      </ModalShell>

      <ModalShell visible={showSmartFolders} title="Smart Folders" subtitle="Auto-group notes like browser smart folders" onClose={() => setShowSmartFolders(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modalBody}>
            {smartFolders.length === 0 ? (
              <View style={s.emptyModalState}>
                <Text style={s.emptyTitle}>no notes to organize</Text>
                <Text style={s.emptyHint}>create a few notes and smart folders will appear</Text>
              </View>
            ) : smartFolders.map((group) => (
              <HapticTouchable key={group.name} style={s.smartFolderCard} onPress={() => applySmartFolder(group)} haptic="selection">
                <View style={s.templateIconWrap}>
                  <Ionicons name="sparkles-outline" size={18} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.templateName}>{group.name}</Text>
                  <Text style={s.templateDesc}>{group.notes.length} note{group.notes.length === 1 ? '' : 's'}</Text>
                </View>
                <Ionicons name="arrow-forward-outline" size={18} color={ACCENT} />
              </HapticTouchable>
            ))}
          </View>
        </ScrollView>
      </ModalShell>
    </SafeAreaView>
  );
}

export default function NotesScreen({ user, onBack }: Props) {
  const { selectedTheme } = useAppTheme();
  const layout = useResponsiveLayout();
  applyTheme(selectedTheme);
  s = createStyles(layout);
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [refreshTick, setRefreshTick] = useState(0);

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
            onOpenMedia={() => navigation.navigate('MediaNotes')}
            onOpenEditor={(note, folders) => navigation.navigate('NoteEditor', { note, folders })}
          />
        )}
      </NotesStack.Screen>
      <NotesStack.Screen name="NoteEditor">
        {({ route, navigation }) => (
          <NoteEditor
            user={user}
            note={route.params.note}
            folders={route.params.folders}
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
      <NotesStack.Screen name="MediaNotes">
        {({ navigation }) => (
          <AIMediaNotesScreen
            user={user}
            onBack={() => navigation.goBack()}
          />
        )}
      </NotesStack.Screen>
    </NotesStack.Navigator>
  );
}

function createStyles(layout: ReturnType<typeof useResponsiveLayout>) {
  const softAccent = rgbaFromHex(ACCENT, 0.12);
  const softAccentBorder = rgbaFromHex(ACCENT, 0.24);
  const softSuccess = rgbaFromHex(GREEN, 0.12);
  const softSuccessBorder = rgbaFromHex(GREEN, 0.24);
  const softDanger = rgbaFromHex(RED, 0.12);
  const softDangerBorder = rgbaFromHex(RED, 0.24);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    header: {
      width: '100%',
      maxWidth: layout.contentMaxWidth,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: layout.screenPadding,
      paddingTop: layout.isTablet ? 22 : 18,
      paddingBottom: 12,
      gap: 12,
      flexWrap: layout.isTablet ? 'nowrap' : 'wrap',
    },
    headerTitleWrap: { flex: 1, minWidth: 180 },
    mobileHeader: {
      width: '100%',
      maxWidth: layout.contentMaxWidth,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    mobileTitle: {
      fontFamily: 'Inter_900Black',
      fontSize: 32,
      color: GOLD_L,
      letterSpacing: -0.8,
    },
    mobileSubtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      color: DIM2,
      letterSpacing: 2.2,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    headerActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: layout.isTablet ? 'nowrap' : 'wrap',
      justifyContent: 'flex-end',
    },
    title: { fontFamily: 'Inter_900Black', fontSize: 32, color: GOLD_L, letterSpacing: -0.8 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2, letterSpacing: 2.1, marginTop: 4, textTransform: 'uppercase' },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softAccentBorder,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconBtnPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },

    listHeader: { gap: 12, paddingBottom: 4 },
    heroCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: rgbaFromHex(ACCENT, 0.2),
      backgroundColor: rgbaFromHex(SURFACE, 0.97),
      padding: layout.isTablet ? 22 : 16,
      gap: 14,
      shadowColor: ACCENT,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.13,
      shadowRadius: 24,
      elevation: 6,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    heroEyebrow: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: GOLD_D,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: 'Inter_900Black',
      fontSize: layout.isTablet ? 32 : 26,
      lineHeight: layout.isTablet ? 38 : 30,
      color: GOLD_L,
      letterSpacing: -1,
      textTransform: 'lowercase',
    },
    heroBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: softAccentBorder,
      backgroundColor: softAccent,
      paddingHorizontal: 11,
      paddingVertical: 6,
      marginTop: 4,
    },
    heroBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: ACCENT,
      textTransform: 'lowercase',
    },
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: rgbaFromHex(SURFACE_2, 0.9),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: softAccentBorder,
      overflow: 'hidden',
    },
    heroStat: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
    },
    heroStatNum: {
      fontFamily: 'Inter_900Black',
      fontSize: 20,
      color: ACCENT,
      letterSpacing: -0.5,
    },
    heroStatLbl: {
      fontFamily: 'Inter_400Regular',
      fontSize: 9,
      color: DIM2,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    heroStatDiv: {
      width: 1,
      height: 32,
      backgroundColor: BORDER,
    },
    heroBtnRow: {
      flexDirection: 'row',
      gap: 10,
    },
    heroPrimaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 14,
      backgroundColor: ACCENT,
      paddingVertical: 12,
    },
    heroPrimaryBtnText: {
      fontFamily: 'Inter_900Black',
      fontSize: 12,
      color: BG,
      textTransform: 'lowercase',
    },
    heroSecBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.9),
      paddingVertical: 12,
    },
    heroSecBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: GOLD_L,
      textTransform: 'lowercase',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    searchBar: {
      flex: 1,
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: rgbaFromHex(SURFACE, 0.96),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 14,
    },
    searchNewBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: ACCENT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: GOLD_D,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      marginTop: 4,
      marginBottom: -2,
    },
    actionsGrid: {
      gap: 8,
    },
    actionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: rgbaFromHex(SURFACE, 0.97),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    actionPillIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: softAccent,
      borderWidth: 1,
      borderColor: softAccentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPillText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: GOLD_L,
      flex: 1,
    },
    libHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 6,
    },
    sectionEyebrow: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: GOLD_D,
      letterSpacing: 1.7,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    sectionTitle: {
      fontFamily: 'Inter_900Black',
      fontSize: 21,
      color: GOLD_L,
      letterSpacing: -0.5,
      textTransform: 'lowercase',
    },
    libMeta: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: DIM2,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 0,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: GOLD_L },
    filtersRow: { gap: 10, paddingBottom: 6, marginBottom: 4 },
    filtersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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

    listContent: {
      width: '100%',
      maxWidth: layout.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.isTablet ? layout.screenPadding : 10,
      paddingTop: 10,
      paddingBottom: 120,
      flexGrow: 1,
    },
    noteGridRow: {
      gap: 12,
      marginBottom: 12,
    },
    noteCard: {
      flex: 1,
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
      borderRadius: 28,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 18,
      gap: 10,
      marginBottom: 12,
      minHeight: layout.isTablet ? 200 : undefined,
      shadowColor: ACCENT,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 26,
      elevation: 5,
    },
    noteCardGrid: {
      minWidth: 0,
    },
    noteCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    noteTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 10,
    },
    noteTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.86),
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    noteTagText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      color: DIM2,
      textTransform: 'lowercase',
    },
    noteTagAccent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: softAccentBorder,
      backgroundColor: softAccent,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    noteTagAccentText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: ACCENT,
      textTransform: 'lowercase',
    },
    noteCardTitle: { fontFamily: 'Inter_900Black', fontSize: 17, color: GOLD_L, lineHeight: 23 },
    noteMetaText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2, marginTop: 4, letterSpacing: 0.8 },
    notePreview: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, lineHeight: 19 },
    noteCardFooter: {
      marginTop: 'auto',
      paddingTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    starBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: softAccent,
      borderWidth: 1,
      borderColor: softAccentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mobileStatsInline: {
      flexDirection: 'row',
      gap: 10,
    },
    mobileStatsPill: {
      flex: 1,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    mobileStatsValue: {
      fontFamily: 'Inter_900Black',
      fontSize: 18,
      color: ACCENT,
    },
    mobileStatsLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      color: DIM2,
      textTransform: 'lowercase',
    },

    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 40 },
    emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
    emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, textAlign: 'center', letterSpacing: 1 },

    editorHeader: {
      width: '100%',
      maxWidth: layout.contentMaxWidth,
      alignSelf: 'center',
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
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: ACCENT,
    },
    saveBtnText: { fontFamily: 'Inter_900Black', fontSize: 11, color: BG, textTransform: 'lowercase' },
    editorScroll: {
      width: '100%',
      maxWidth: layout.contentMaxWidth,
      alignSelf: 'center',
      padding: 16,
      paddingBottom: 80,
    },
    editorMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    editorMetaText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 0.8 },
    trashText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: RED, textTransform: 'lowercase' },
    folderSection: { marginBottom: 16 },
    fontSection: { marginBottom: 14 },
    sectionCaption: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_D, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },
    folderChips: { gap: 10 },
    fontChips: { gap: 10, paddingRight: 6 },
    fontChip: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: rgbaFromHex(ACCENT, 0.2),
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fontChipActive: {
      borderColor: ACCENT,
      backgroundColor: rgbaFromHex(ACCENT, 0.12),
    },
    fontChipText: {
      fontSize: 12,
      color: GOLD_L,
    },
    fontChipTextActive: {
      color: ACCENT,
    },
    canvasSubtext: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: DIM2,
      lineHeight: 16,
      textTransform: 'lowercase',
    },
    inlineComposer: {
      gap: 10,
    },
    inlineBlockWrap: {
      gap: 10,
    },
    inlineTextBlock: {
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
      borderRadius: 28,
      borderWidth: 1,
      borderColor: BORDER,
      overflow: 'hidden',
    },
    inlineTextInput: {
      minHeight: 130,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 24,
      color: GOLD_L,
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
    },
    inlineCanvasBlock: {
      gap: 10,
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
      borderRadius: 28,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
    },
    inlineCanvasHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    inlineCanvasActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    inlineMiniBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineInsertRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inlineInsertBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 16,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderWidth: 1,
      borderColor: rgbaFromHex(ACCENT, 0.24),
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    inlineInsertBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: GOLD_L,
      textTransform: 'lowercase',
    },
    titleInput: {
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
      borderRadius: 28,
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
      minHeight: layout.isLandscape ? 320 : 420,
      backgroundColor: rgbaFromHex(SURFACE, 0.94),
      borderRadius: 28,
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
      borderRadius: 22,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 16,
      flexDirection: 'row',
      gap: 12,
    },
    trashMeta: { fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2, marginTop: 8, letterSpacing: 0.8 },
    trashActions: { justifyContent: 'space-between', gap: 8 },
    restoreBtn: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: softSuccess,
      borderWidth: 1,
      borderColor: softSuccessBorder,
    },
    restoreBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GREEN, textTransform: 'lowercase' },
    deleteForeverBtn: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: softDanger,
      borderWidth: 1,
      borderColor: softDangerBorder,
    },
    deleteForeverText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: RED, textTransform: 'lowercase' },

    modalRoot: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: 'rgba(10, 12, 20, 0.48)',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalKeyboard: { flex: 1, justifyContent: 'center' },
    modalCard: {
      maxHeight: '88%',
      backgroundColor: rgbaFromHex(SURFACE, 0.98),
      borderRadius: 28,
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    modalTitle: { fontFamily: 'Inter_900Black', fontSize: 22, color: GOLD_L },
    modalSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, lineHeight: 16, marginTop: 4 },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: rgbaFromHex(SURFACE_2, 0.9),
      borderWidth: 1,
      borderColor: BORDER,
    },
    modalBody: { gap: 12, paddingBottom: 6 },
    modalSectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, color: GOLD_D, letterSpacing: 1.4, textTransform: 'uppercase' },
    historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    clearHistoryText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: ACCENT, textTransform: 'lowercase' },
    modalInput: {
      backgroundColor: rgbaFromHex(SURFACE_2, 0.9),
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: GOLD_L,
    },
    modalTextarea: {
      minHeight: 116,
      paddingTop: 14,
    },
    rowActions: { flexDirection: 'row', gap: 10 },
    primaryBtn: {
      borderRadius: 16,
      backgroundColor: ACCENT,
      paddingHorizontal: 16,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { fontFamily: 'Inter_900Black', fontSize: 12, color: BG, textTransform: 'lowercase' },
    secondaryBtn: {
      borderRadius: 16,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.9),
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 16,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: GOLD_L, textTransform: 'lowercase' },

    templateTabs: { flexDirection: 'row', gap: 10 },
    tabBtn: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: rgbaFromHex(SURFACE_2, 0.9),
      borderWidth: 1,
      borderColor: BORDER,
    },
    tabBtnActive: {
      backgroundColor: ACCENT,
      borderColor: ACCENT,
    },
    tabBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: GOLD_L, textTransform: 'lowercase' },
    tabBtnTextActive: { color: BG },
    dashedCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: softAccentBorder,
      borderStyle: 'dashed',
      padding: 18,
      alignItems: 'center',
      gap: 8,
      backgroundColor: softAccent,
    },
    dashedCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_L, textTransform: 'lowercase' },
    dashedCardText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, textAlign: 'center' },
    formCard: {
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderRadius: 22,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
      gap: 10,
    },
    propertyCard: {
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderRadius: 22,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
      gap: 10,
    },
    propertyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    propertyName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_L },
    propertyMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, marginTop: 3, textTransform: 'lowercase' },
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderRadius: 20,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
    },
    templateIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softAccent,
      borderWidth: 1,
      borderColor: softAccentBorder,
    },
    templateName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_L },
    templateDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, lineHeight: 16, marginTop: 3 },
    templateActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    templateUseBtn: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: ACCENT,
    },
    templateUseBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: BG, textTransform: 'lowercase' },
    templateDeleteBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softDanger,
      borderWidth: 1,
      borderColor: softDangerBorder,
    },

    emptyModalState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
    selectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      padding: 14,
    },
    selectRowActive: {
      borderColor: ACCENT,
      backgroundColor: softAccent,
    },
    selectRowTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: GOLD_L },
    selectRowMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, marginTop: 4 },
    smartFolderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderRadius: 20,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
    },
    inlineChips: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

    aiActionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    aiActionChip: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.92),
      borderWidth: 1,
      borderColor: BORDER,
    },
    aiActionChipActive: {
      backgroundColor: ACCENT,
      borderColor: ACCENT,
    },
    aiActionChipText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: GOLD_L },
    aiActionChipTextActive: { color: BG },
    aiHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, color: DIM2 },
    suggestionCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: softAccentBorder,
      backgroundColor: rgbaFromHex(SURFACE_2, 0.95),
      padding: 14,
    },
    suggestionText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: GOLD_L },
  });
}

let s: ReturnType<typeof createStyles> = createStyles(DEFAULT_LAYOUT);
