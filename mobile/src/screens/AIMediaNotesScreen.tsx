import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Animated, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import { processMediaYouTube, getMediaHistory, saveMediaNotes } from '../services/api';

const { width } = Dimensions.get('window');

const BG      = '#0A0A0A';
const SURFACE = '#0F0F0F';
const GOLD_XL = '#FFF0BC';
const GOLD_L  = '#E8CC88';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#8A6535';
const GOLD_XD = '#5A3F1A';
const BORDER  = '#1A1408';
const DIM     = '#3A3020';
const DIM2    = '#4A3E2A';
const INK     = '#0D0A06';
const ERR     = '#BF5D5D';

const STATUSES = [
  'extracting audio...',
  'transcribing speech...',
  'analyzing content...',
  'identifying key topics...',
  'generating notes...',
  'almost done...',
];

type ViewState = 'hub' | 'processing' | 'results';
type Tab       = 'notes' | 'transcript';

interface MediaResult {
  filename: string;
  transcript: string;
  duration: number;
  language_name: string;
  notes: { content: string };
  analysis: any;
  video_info?: { title?: string; thumbnail?: string };
}

interface HistoryItem {
  id: number;
  title: string;
  created_at: string;
  preview: string;
}

type Props = { user: AuthUser; onBack?: () => void };

// ── Pulsing ring animation ────────────────────────────────────────────
function ProcessingView({ status }: { status: string }) {
  const ring0 = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const mkRing = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0,    useNativeDriver: true }),
        Animated.delay(600 - delay),
      ]));

    const glow = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
    ]));

    const a0 = mkRing(ring0, 0);
    const a1 = mkRing(ring1, 660);
    const a2 = mkRing(ring2, 1320);
    [a0, a1, a2, glow].forEach(a => a.start());
    return () => [a0, a1, a2, glow].forEach(a => a.stop());
  }, []);

  const ringView = (anim: Animated.Value, size: number) => (
    <Animated.View style={[pr.ring, {
      width: size, height: size, borderRadius: size / 2,
      opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) }],
    }]} />
  );

  return (
    <View style={pr.container}>
      <LinearGradient colors={[BG, '#100E07', BG]} style={StyleSheet.absoluteFill} />

      <View style={pr.rings}>
        {ringView(ring0, 80)}
        {ringView(ring1, 80)}
        {ringView(ring2, 80)}
        <Animated.View style={[pr.core, { opacity: pulse }]}>
          <Ionicons name="mic" size={28} color={GOLD_L} />
        </Animated.View>
      </View>

      <Text style={pr.status}>{status}</Text>
      <Text style={pr.hint}>this may take a minute</Text>
    </View>
  );
}

const pr = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rings:     { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: GOLD_M,
  },
  core: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: GOLD_XD + '90',
    borderWidth: 1.5,
    borderColor: GOLD_M,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD_M,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  status: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: GOLD_L,
    letterSpacing: 1,
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: DIM2,
    letterSpacing: 1.5,
  },
});

// ── Main screen ───────────────────────────────────────────────────────
export default function AIMediaNotesScreen({ user, onBack }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  const [view,       setView]       = useState<ViewState>('hub');
  const [tab,        setTab]        = useState<Tab>('notes');
  const [url,        setUrl]        = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [statusIdx,  setStatusIdx]  = useState(0);
  const [history,    setHistory]    = useState<HistoryItem[]>([]);
  const [result,     setResult]     = useState<MediaResult | null>(null);
  const [error,      setError]      = useState('');
  const cancelRef = useRef(false);

  const loadHistory = useCallback(() => {
    getMediaHistory(user.username)
      .then(d => { if (d?.history) setHistory(d.history); })
      .catch(() => {});
  }, [user.username]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (view !== 'processing') return;
    const iv = setInterval(() => {
      setStatusIdx(i => Math.min(i + 1, STATUSES.length - 1));
    }, 4200);
    return () => clearInterval(iv);
  }, [view]);

  const handleProcess = useCallback(async () => {
    if (!url.trim()) return;
    cancelRef.current = false;
    setError('');
    setStatusIdx(0);
    setView('processing');

    try {
      const data = await processMediaYouTube(user.username, url.trim());
      if (cancelRef.current) return;
      if (!data.success) throw new Error(data.detail || 'Processing failed');
      setResult(data);
      setTab('notes');
      setSaved(false);
      setView('results');
    } catch (e: any) {
      if (!cancelRef.current) {
        setError(e.message || 'Something went wrong. Please try again.');
        setView('hub');
      }
    }
  }, [url, user.username]);

  const handleSave = useCallback(async () => {
    if (!result || saving || saved) return;
    setSaving(true);
    try {
      const title = result.video_info?.title || result.filename || 'Media Note';
      await saveMediaNotes(user.username, title, result.notes.content, result.transcript, result.analysis);
      setSaved(true);
      loadHistory();
    } catch { // silenced
    } finally {
      setSaving(false);
    }
  }, [result, saving, saved, user.username, loadHistory]);

  const fmtDuration = (s: number) => {
    if (!s) return '';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const fmtDate = (iso: string) => {
    const d   = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'yesterday';
    if (diff < 7)  return `${diff}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!fontsLoaded) return null;

  // ── Processing ─────────────────────────────────────────────────────
  if (view === 'processing') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => { cancelRef.current = true; setView('hub'); }} style={s.iconBtn}>
            <Ionicons name="close" size={22} color={GOLD_M} />
          </TouchableOpacity>
          <Text style={s.subTitle}>processing</Text>
          <View style={s.iconBtn} />
        </View>
        <ProcessingView status={STATUSES[statusIdx]} />
      </SafeAreaView>
    );
  }

  // ── Results ────────────────────────────────────────────────────────
  if (view === 'results' && result) {
    const displayTitle = result.video_info?.title || result.filename || 'Media Note';
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => setView('hub')} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={GOLD_L} />
          </TouchableOpacity>
          <Text style={s.subTitle}>notes</Text>
          <TouchableOpacity
            style={[s.saveChip, saved && s.saveChipDone]}
            onPress={handleSave}
            disabled={saving || saved}
            activeOpacity={0.8}
          >
            {saving ? (
              <Text style={s.saveChipText}>saving...</Text>
            ) : saved ? (
              <>
                <Ionicons name="checkmark" size={12} color={INK} />
                <Text style={s.saveChipText}>saved</Text>
              </>
            ) : (
              <>
                <Ionicons name="bookmark-outline" size={12} color={INK} />
                <Text style={s.saveChipText}>save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Source meta strip */}
        <View style={s.metaStrip}>
          <View style={s.metaIconBox}>
            <Ionicons name="logo-youtube" size={16} color={GOLD_M} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.metaTitle} numberOfLines={2}>{displayTitle}</Text>
            <View style={s.metaBadges}>
              {!!result.duration && (
                <View style={s.badge}>
                  <Ionicons name="time-outline" size={9} color={GOLD_D} />
                  <Text style={s.badgeText}>{fmtDuration(result.duration)}</Text>
                </View>
              )}
              {!!result.language_name && (
                <View style={s.badge}>
                  <Ionicons name="language-outline" size={9} color={GOLD_D} />
                  <Text style={s.badgeText}>{result.language_name}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Gold divider */}
        <View style={s.metaDivider} />

        {/* Tab strip */}
        <View style={s.tabRow}>
          {(['notes', 'transcript'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={t === 'notes' ? 'document-text-outline' : 'text-outline'}
                size={12}
                color={tab === t ? GOLD_M : DIM2}
              />
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={s.resultsScroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.noteBody, tab === 'transcript' && s.transcriptBody]}>
            {tab === 'notes' ? result.notes.content : result.transcript}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Hub ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.hubScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Header */}
          <View style={s.header}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={s.iconBtn}>
                <Ionicons name="chevron-back" size={24} color={GOLD_L} />
              </TouchableOpacity>
            ) : (
              <View style={s.iconBtn} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle}>ai media notes</Text>
              <Text style={s.pageSubtitle}>audio · video · youtube</Text>
            </View>
            <Ionicons name="mic-outline" size={20} color={GOLD_D} />
          </View>

          {/* Cinematic hero tile */}
          <View style={[s.tile, s.heroTile]}>
            <LinearGradient colors={['#0A0A0A', '#1A1005', '#2E1E08']} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['transparent', GOLD_XD + 'CC', GOLD_D + '44', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Watermark */}
            <Text style={s.heroWatermark}>M</Text>
            {/* Content */}
            <View style={s.heroInner}>
              <View style={s.heroTopRow}>
                <Text style={s.heroEyebrow}>AI-POWERED TRANSCRIPTION</Text>
                <View style={s.heroBadge}>
                  <Text style={s.heroBadgeText}>BETA</Text>
                </View>
              </View>
              <Text style={s.heroHeading}>media notes</Text>
              <View style={s.heroDivider} />
              <Text style={s.heroBody}>transform any audio or video{'\n'}into structured smart notes</Text>
            </View>
            <LinearGradient colors={['transparent', GOLD_D + '70']} style={s.heroGlow} />
          </View>

          {/* Input card */}
          <View style={s.inputCard}>
            <LinearGradient colors={['#111008', '#0A0A08']} style={StyleSheet.absoluteFill} />
            <View style={s.inputCardInner}>

              <View style={s.inputLabel}>
                <Ionicons name="logo-youtube" size={14} color={GOLD_D} />
                <Text style={s.inputLabelText}>YOUTUBE URL</Text>
              </View>

              <View style={s.urlRow}>
                <Ionicons name="link-outline" size={14} color={DIM2} />
                <TextInput
                  style={s.urlInput}
                  placeholder="paste link here..."
                  placeholderTextColor={DIM2}
                  value={url}
                  onChangeText={t => { setUrl(t); setError(''); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleProcess}
                />
                {!!url && (
                  <TouchableOpacity onPress={() => setUrl('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={GOLD_D} />
                  </TouchableOpacity>
                )}
              </View>

              {!!error && (
                <View style={s.errorRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={ERR} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.processBtn, !url.trim() && { opacity: 0.45 }]}
                onPress={handleProcess}
                disabled={!url.trim()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={url.trim() ? [GOLD_L, GOLD_M, GOLD_D] : [DIM, DIM]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.processBtnGrad}
                >
                  <Ionicons name="sparkles" size={15} color={url.trim() ? INK : DIM2} />
                  <Text style={[s.processBtnText, !url.trim() && { color: DIM2 }]}>
                    GENERATE NOTES
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </View>

          {/* Feature pills */}
          <View style={s.pillRow}>
            {[
              { icon: 'mic-outline',           label: 'TRANSCRIBE' },
              { icon: 'document-text-outline', label: 'NOTES'      },
              { icon: 'sparkles-outline',      label: 'ANALYSIS'   },
            ].map((p, i) => (
              <View key={i} style={s.pill}>
                <Ionicons name={p.icon as any} size={12} color={GOLD_D} />
                <Text style={s.pillText}>{p.label}</Text>
              </View>
            ))}
          </View>

          {/* History section */}
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>RECENT</Text>
            {history.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countText}>{history.length}</Text>
              </View>
            )}
          </View>

          {history.length === 0 ? (
            <View style={s.emptyBox}>
              <View style={s.emptyIconRing}>
                <Ionicons name="mic-circle-outline" size={32} color={GOLD_D} />
              </View>
              <Text style={s.emptyTitle}>no media notes yet</Text>
              <Text style={s.emptyHint}>paste a youtube url above{'\n'}to transcribe & generate notes</Text>
            </View>
          ) : (
            history.slice(0, 8).map(item => (
              <TouchableOpacity key={item.id} style={s.histRow} activeOpacity={0.8}>
                <View style={s.histIcon}>
                  <Ionicons name="document-text-outline" size={14} color={GOLD_M} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.histTitle} numberOfLines={1}>{item.title}</Text>
                  {!!item.preview && (
                    <Text style={s.histPreview} numberOfLines={1}>
                      {item.preview.replace(/<[^>]*>/g, '').trim()}
                    </Text>
                  )}
                </View>
                <View style={s.histMeta}>
                  <Text style={s.histDate}>{fmtDate(item.created_at)}</Text>
                  <Ionicons name="chevron-forward" size={12} color={DIM} />
                </View>
              </TouchableOpacity>
            ))
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: BG },
  hubScroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 6,
    gap: 8,
  },
  iconBtn:     { width: 38, alignItems: 'flex-start' },
  pageTitle:   { fontFamily: 'Inter_900Black',   fontSize: 24, color: GOLD_L, lineHeight: 28 },
  pageSubtitle:{ fontFamily: 'Inter_400Regular', fontSize: 10, color: DIM2,   letterSpacing: 2, marginTop: 2 },

  // sub-screen header
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  subTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 18,
    color: GOLD_L,
    flex: 1,
    textAlign: 'center',
  },

  // save chip
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GOLD_M,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveChipDone: { backgroundColor: GOLD_D },
  saveChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: INK,
    letterSpacing: 0.5,
  },

  // tile base
  tile: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  // hero tile
  heroTile: {
    height: 186,
    borderColor: GOLD_D,
    borderWidth: 1.5,
    position: 'relative',
  },
  heroWatermark: {
    position: 'absolute',
    right: -18,
    bottom: -44,
    fontFamily: 'Inter_900Black',
    fontSize: 230,
    color: GOLD_D + '18',
    lineHeight: 230,
  },
  heroInner: {
    flex: 1,
    padding: 22,
    justifyContent: 'space-between',
  },
  heroTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow:  { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 3 },
  heroBadge:    {
    backgroundColor: GOLD_D + '28',
    borderWidth: 1,
    borderColor: GOLD_D + '55',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: GOLD_L, letterSpacing: 2 },
  heroHeading:  {
    fontFamily: 'Inter_900Black',
    fontSize: 40,
    color: GOLD_XL,
    lineHeight: 44,
    textShadowColor: GOLD_D + '80',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroDivider: { height: 1, backgroundColor: GOLD_D + '40', marginVertical: 8 },
  heroBody:    { fontFamily: 'Inter_400Regular', fontSize: 12, color: GOLD_D, letterSpacing: 0.5, lineHeight: 19 },
  heroGlow:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 44 },

  // input card
  inputCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GOLD_D,
    overflow: 'hidden',
  },
  inputCardInner: { padding: 18, gap: 13 },
  inputLabel:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inputLabelText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 3 },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  urlInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: GOLD_L,
  },
  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: ERR, flex: 1 },
  processBtn: { borderRadius: 16, overflow: 'hidden' },
  processBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  processBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: INK,
    letterSpacing: 2.5,
  },

  // feature pills
  pillRow:  { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
  },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: GOLD_D, letterSpacing: 1.5 },

  // section header
  sectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  sectionLabel:{ fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 3 },
  countBadge:  {
    backgroundColor: GOLD_D + '22',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: GOLD_XD, letterSpacing: 1 },

  // empty
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: GOLD_D + '15',
    borderWidth: 1,
    borderColor: GOLD_D + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'Inter_900Black',   fontSize: 16, color: GOLD_D,  textAlign: 'center' },
  emptyHint:  { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2,    textAlign: 'center', lineHeight: 18 },

  // history row
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  histIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: GOLD_D + '1E',
    borderWidth: 1,
    borderColor: GOLD_D + '35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  histTitle:   { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: GOLD_L, lineHeight: 17 },
  histPreview: { fontFamily: 'Inter_400Regular',  fontSize: 11, color: DIM2,   marginTop: 2 },
  histMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  histDate:    { fontFamily: 'Inter_400Regular',  fontSize: 10, color: DIM },

  // results meta strip
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  metaIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: GOLD_D + '20',
    borderWidth: 1,
    borderColor: GOLD_D + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  metaTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 17,
    color: GOLD_L,
    lineHeight: 22,
    flex: 1,
  },
  metaBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD_D + '1E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 1 },

  metaDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 0 },

  // tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: GOLD_D + '25' },
  tabText:       { fontFamily: 'Inter_600SemiBold', fontSize: 9,  color: DIM2,   letterSpacing: 2.5 },
  tabTextActive: { fontFamily: 'Inter_600SemiBold', fontSize: 9,  color: GOLD_M, letterSpacing: 2.5 },

  // note content
  resultsScroll: { padding: 20, paddingBottom: 80 },
  noteBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: GOLD_L,
    lineHeight: 27,
  },
  transcriptBody: {
    fontSize: 13,
    color: DIM2,
    lineHeight: 22,
  },
});
