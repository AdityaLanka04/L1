import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import HapticTouchable from '../components/HapticTouchable';
import { AuthUser } from '../services/auth';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  createFlashcard,
  createFlashcardSet,
  generateFlashcards,
  getFlashcardHistory,
  getFlashcardsInSet,
  getFlashcardStatistics,
} from '../services/api';
import { darkenColor, getDefaultTheme, rgbaFromHex } from '../utils/theme';

const { width: W, height: H } = Dimensions.get('window');

const DEFAULT_THEME = getDefaultTheme();
let BG = DEFAULT_THEME.bgPrimary;
let SURFACE = DEFAULT_THEME.panel;
let SURFACE_2 = DEFAULT_THEME.panelAlt;
let ACCENT = DEFAULT_THEME.accent;
let ACCENT2 = DEFAULT_THEME.accentHover;
let GOLD_L = DEFAULT_THEME.accentHover;
let GOLD_D = darkenColor(DEFAULT_THEME.accent, DEFAULT_THEME.isLight ? 10 : 26);
let GOLD_XD = darkenColor(DEFAULT_THEME.accent, DEFAULT_THEME.isLight ? 26 : 40);
let BORDER = DEFAULT_THEME.borderStrong;
let DIM = DEFAULT_THEME.panelMuted;
let DIM2 = DEFAULT_THEME.textSecondary;
let INK = DEFAULT_THEME.isLight ? darkenColor(DEFAULT_THEME.accent, 45) : darkenColor(DEFAULT_THEME.primary, 2);
let GREEN = DEFAULT_THEME.success;
let RED = DEFAULT_THEME.danger;

type FlashcardSet = {
  id: number;
  title: string;
  description: string;
  card_count: number;
  accuracy_percentage: number;
  source_type: string;
  created_at: string;
};

type Flashcard = {
  id: number;
  question: string;
  answer: string;
  difficulty: string;
};

type ManualDraftCard = {
  question: string;
  answer: string;
};

type Difficulty = 'easy' | 'medium' | 'hard';
type CreateMode = 'ai' | 'manual';

type Props = { user: AuthUser; onBack?: () => void };
type FlashcardsStackParamList = {
  FlashcardsSets: undefined;
  FlashcardsCreate: { mode?: CreateMode } | undefined;
  FlashcardsStudy: { set: FlashcardSet; cards: Flashcard[] };
  FlashcardsResults: { set: FlashcardSet; cards: Flashcard[]; stats: { correct: number; incorrect: number } };
};

const FlashcardsStack = createNativeStackNavigator<FlashcardsStackParamList>();

const difficultyOptions: Difficulty[] = ['easy', 'medium', 'hard'];
const cardCountOptions = [5, 10, 15, 20];

function applyTheme(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  BG = theme.bgPrimary;
  SURFACE = theme.panel;
  SURFACE_2 = theme.panelAlt;
  ACCENT = theme.accent;
  ACCENT2 = theme.accentHover;
  GOLD_L = theme.accentHover;
  GOLD_D = darkenColor(theme.accent, theme.isLight ? 10 : 26);
  GOLD_XD = darkenColor(theme.accent, theme.isLight ? 26 : 40);
  BORDER = theme.borderStrong;
  DIM = theme.panelMuted;
  DIM2 = theme.textSecondary;
  INK = theme.isLight ? darkenColor(theme.accent, 45) : darkenColor(theme.primary, 2);
  GREEN = theme.success;
  RED = theme.danger;
}

function buildSetDraft(input: Partial<FlashcardSet> & { id: number; title: string; card_count: number; source_type: string }): FlashcardSet {
  return {
    description: '',
    accuracy_percentage: 0,
    created_at: new Date().toISOString(),
    ...input,
  };
}

function ResultsView({
  stats,
  onBack,
  onRestart,
}: {
  stats: { correct: number; incorrect: number };
  onBack: () => void;
  onRestart: () => void;
}) {
  const total = stats.correct + stats.incorrect;
  const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.studyHeader}>
        <HapticTouchable onPress={onBack} haptic="selection">
          <Ionicons name="chevron-back" size={22} color={GOLD_L} />
        </HapticTouchable>
        <Text style={s.studyTitle}>session complete</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={s.resultsWrap}>
        <Text style={[s.bigPct, { color: pct >= 70 ? GREEN : RED }]}>{pct}%</Text>
        <Text style={s.resultsLabel}>accuracy</Text>
        <View style={s.resultsRow}>
          <View style={s.resultStat}>
            <Text style={[s.resultNum, { color: GREEN }]}>{stats.correct}</Text>
            <Text style={s.resultLbl}>correct</Text>
          </View>
          <View style={[s.resultStat, { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
            <Text style={[s.resultNum, { color: RED }]}>{stats.incorrect}</Text>
            <Text style={s.resultLbl}>incorrect</Text>
          </View>
        </View>
        <HapticTouchable style={s.actionBtn} onPress={onRestart} haptic="medium">
          <Text style={s.actionBtnText}>study again</Text>
        </HapticTouchable>
        <HapticTouchable style={[s.actionBtn, s.actionBtnOutline]} onPress={onBack} haptic="selection">
          <Text style={[s.actionBtnText, { color: ACCENT }]}>back to sets</Text>
        </HapticTouchable>
      </View>
    </SafeAreaView>
  );
}

function StudyView({
  set,
  cards,
  onBack,
  onComplete,
}: {
  set: FlashcardSet;
  cards: Flashcard[];
  onBack: () => void;
  onComplete: (stats: { correct: number; incorrect: number }) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const card = cards[idx];

  const doFlip = () => {
    if (!card) return;
    Animated.timing(scaleAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setFlipped((value) => !value);
      Animated.timing(scaleAnim, { toValue: 1, duration: 130, useNativeDriver: true }).start();
    });
  };

  const answer = (correct: boolean) => {
    const key = correct ? 'correct' : 'incorrect';
    const next = { ...stats, [key]: stats[key] + 1 };
    setStats(next);
    Animated.timing(scaleAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setFlipped(false);
      scaleAnim.setValue(0);
      if (idx + 1 >= cards.length) {
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start(() => onComplete(next));
      } else {
        setIdx((value) => value + 1);
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      }
    });
  };

  if (!card) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.studyHeader}>
          <HapticTouchable onPress={onBack} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </HapticTouchable>
          <Text style={s.studyTitle}>flashcards</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.empty}>
          <Text style={s.emptyTitle}>no cards in this set</Text>
          <Text style={s.emptyHint}>create a few cards and try again</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.studyHeader}>
        <HapticTouchable onPress={onBack} haptic="selection">
          <Ionicons name="chevron-back" size={22} color={GOLD_L} />
        </HapticTouchable>
        <Text style={s.studyTitle} numberOfLines={1}>{set.title.toLowerCase()}</Text>
        <Text style={[s.studyCounter, { color: GOLD_D }]}>{idx + 1}/{cards.length}</Text>
      </View>

      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${(idx / cards.length) * 100}%` as const }]} />
      </View>

      <View style={s.cardWrap}>
        <Animated.View style={{ transform: [{ scaleX: scaleAnim }] }}>
          <HapticTouchable
            style={[s.card, flipped && { backgroundColor: ACCENT, borderColor: ACCENT2 }]}
            onPress={doFlip}
            activeOpacity={0.95}
            haptic="light"
          >
            <Text style={[s.cardSide, flipped && { color: INK, opacity: 0.5 }]}>
              {flipped ? 'ANSWER' : 'QUESTION'}
            </Text>
            <Text style={[s.cardText, flipped && { color: INK }]}>
              {flipped ? card.answer : card.question}
            </Text>
            {!flipped && <Text style={s.tapHint}>tap to reveal answer</Text>}
            {flipped && (
              <View style={s.diffPill}>
                <Text style={s.diffText}>{card.difficulty?.toUpperCase() ?? 'MEDIUM'}</Text>
              </View>
            )}
          </HapticTouchable>
        </Animated.View>
      </View>

      <View style={s.answerRow}>
        <HapticTouchable style={s.wrongBtn} onPress={() => answer(false)} haptic="warning">
          <Ionicons name="close" size={30} color={RED} />
          <Text style={s.wrongLabel}>incorrect</Text>
        </HapticTouchable>
        <HapticTouchable style={s.rightBtn} onPress={() => answer(true)} haptic="success">
          <Ionicons name="checkmark" size={30} color={GREEN} />
          <Text style={s.rightLabel}>correct</Text>
        </HapticTouchable>
      </View>
    </SafeAreaView>
  );
}

function OptionPill({
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
      style={[s.optionPill, active && s.optionPillActive]}
      onPress={onPress}
      activeOpacity={0.85}
      haptic="selection"
    >
      <Text style={[s.optionPillText, active && s.optionPillTextActive]}>{label}</Text>
    </HapticTouchable>
  );
}

function FlashcardsCreate({
  user,
  initialMode = 'ai',
  onBack,
  onCreated,
}: {
  user: AuthUser;
  initialMode?: CreateMode;
  onBack: () => void;
  onCreated: (set: FlashcardSet, cards: Flashcard[]) => void;
}) {
  const [mode, setMode] = useState<CreateMode>(initialMode);
  const [topic, setTopic] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [additionalSpecs, setAdditionalSpecs] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualCards, setManualCards] = useState<ManualDraftCard[]>([
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const updateManualCard = (index: number, field: keyof ManualDraftCard, value: string) => {
    setManualCards((cards) => cards.map((card, cardIndex) => (
      cardIndex === index ? { ...card, [field]: value } : card
    )));
  };

  const addManualCard = () => {
    setManualCards((cards) => [...cards, { question: '', answer: '' }]);
  };

  const removeManualCard = (index: number) => {
    setManualCards((cards) => (
      cards.length === 1 ? cards : cards.filter((_, cardIndex) => cardIndex !== index)
    ));
  };

  const submitAI = async () => {
    if (!topic.trim()) {
      Alert.alert('Topic required', 'Enter a topic to generate flashcards.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await generateFlashcards({
        userId: user.username,
        topic: topic.trim(),
        cardCount,
        difficulty,
        additionalSpecs: additionalSpecs.trim(),
        setTitle: `Flashcards: ${topic.trim()}`,
      });

      const cards = (data?.cards ?? data?.flashcards ?? []) as Flashcard[];
      if (!cards.length) {
        Alert.alert('No cards generated', 'Try a broader topic or adjust the prompt.');
        return;
      }

      const set = buildSetDraft({
        id: data.set_id,
        title: data.set_title || `Flashcards: ${topic.trim()}`,
        description: 'Generated from topic',
        card_count: cards.length,
        source_type: 'ai',
      });

      onCreated(set, cards);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate flashcards';
      Alert.alert('Generation failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitManual = async () => {
    const validCards = manualCards.filter((card) => card.question.trim() && card.answer.trim());
    if (!manualTitle.trim()) {
      Alert.alert('Title required', 'Add a title for your flashcard set.');
      return;
    }
    if (!validCards.length) {
      Alert.alert('Cards required', 'Add at least one question and answer pair.');
      return;
    }

    setSubmitting(true);
    try {
      const setData = await createFlashcardSet({
        userId: user.username,
        title: manualTitle.trim(),
        description: `Custom set with ${validCards.length} cards`,
      });

      for (const card of validCards) {
        await createFlashcard({
          setId: setData.set_id,
          question: card.question.trim(),
          answer: card.answer.trim(),
          difficulty: 'medium',
        });
      }

      const createdSet = buildSetDraft({
        id: setData.set_id,
        title: setData.title || manualTitle.trim(),
        description: `Custom set with ${validCards.length} cards`,
        card_count: validCards.length,
        source_type: 'manual',
      });
      const freshSet = await getFlashcardsInSet(setData.set_id);
      const cards = (freshSet?.flashcards ?? []) as Flashcard[];
      onCreated(createdSet, cards);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create flashcards';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <HapticTouchable onPress={onBack} style={{ marginRight: 12 }} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </HapticTouchable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>create set</Text>
            <Text style={s.subtitle}>mobile-first creator</Text>
          </View>
          <Ionicons name="sparkles-outline" size={20} color={GOLD_D} />
        </View>

        <ScrollView
          contentContainerStyle={s.createContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.modeSwitch}>
            <OptionPill label="AI Generate" active={mode === 'ai'} onPress={() => setMode('ai')} />
            <OptionPill label="Manual" active={mode === 'manual'} onPress={() => setMode('manual')} />
          </View>

          {mode === 'ai' ? (
            <>
              <View style={s.heroCreateCard}>
                <Text style={s.heroEyebrow}>SMART BUILD</Text>
                <Text style={s.heroTitle}>Generate a ready-to-study set from one topic.</Text>
                <Text style={s.heroBody}>
                  Uses the same flashcard generation endpoint as the browser flow, but in a compact mobile form.
                </Text>
              </View>

              <View style={s.formCard}>
                <Text style={s.inputLabel}>topic</Text>
                <TextInput
                  value={topic}
                  onChangeText={setTopic}
                  placeholder="Cell biology, world war 2, derivatives..."
                  placeholderTextColor={DIM2}
                  style={s.input}
                />

                <Text style={s.inputLabel}>card count</Text>
                <View style={s.optionRow}>
                  {cardCountOptions.map((value) => (
                    <OptionPill
                      key={value}
                      label={String(value)}
                      active={cardCount === value}
                      onPress={() => setCardCount(value)}
                    />
                  ))}
                </View>

                <Text style={s.inputLabel}>difficulty</Text>
                <View style={s.optionRow}>
                  {difficultyOptions.map((value) => (
                    <OptionPill
                      key={value}
                      label={value}
                      active={difficulty === value}
                      onPress={() => setDifficulty(value)}
                    />
                  ))}
                </View>

                <Text style={s.inputLabel}>extra instructions</Text>
                <TextInput
                  value={additionalSpecs}
                  onChangeText={setAdditionalSpecs}
                  placeholder="Optional: focus on formulas, definitions, exam-style recall..."
                  placeholderTextColor={DIM2}
                  style={[s.input, s.inputMultiline]}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </>
          ) : (
            <>
              <View style={s.heroCreateCard}>
                <Text style={s.heroEyebrow}>MANUAL BUILD</Text>
                <Text style={s.heroTitle}>Write your own set with quick card blocks sized for phone editing.</Text>
                <Text style={s.heroBody}>
                  This uses the same set and card creation endpoints as the browser flow.
                </Text>
              </View>

              <View style={s.formCard}>
                <Text style={s.inputLabel}>set title</Text>
                <TextInput
                  value={manualTitle}
                  onChangeText={setManualTitle}
                  placeholder="AP Biology Unit 3"
                  placeholderTextColor={DIM2}
                  style={s.input}
                />
              </View>

              {manualCards.map((card, index) => (
                <View key={index} style={s.manualCard}>
                  <View style={s.manualCardHeader}>
                    <Text style={s.manualCardIndex}>card {index + 1}</Text>
                    {manualCards.length > 1 ? (
                      <HapticTouchable onPress={() => removeManualCard(index)} haptic="warning">
                        <Text style={s.removeText}>remove</Text>
                      </HapticTouchable>
                    ) : null}
                  </View>
                  <TextInput
                    value={card.question}
                    onChangeText={(value) => updateManualCard(index, 'question', value)}
                    placeholder="Question"
                    placeholderTextColor={DIM2}
                    style={[s.input, s.inputMultiline]}
                    multiline
                    textAlignVertical="top"
                  />
                  <TextInput
                    value={card.answer}
                    onChangeText={(value) => updateManualCard(index, 'answer', value)}
                    placeholder="Answer"
                    placeholderTextColor={DIM2}
                    style={[s.input, s.inputMultiline, { marginTop: 12 }]}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              ))}

              <HapticTouchable style={s.addCardBtn} onPress={addManualCard} activeOpacity={0.85} haptic="light">
                <Ionicons name="add" size={18} color={GOLD_L} />
                <Text style={s.addCardText}>add another card</Text>
              </HapticTouchable>
            </>
          )}

          <HapticTouchable
            style={[s.createSubmitBtn, submitting && s.createSubmitBtnDisabled]}
            onPress={mode === 'ai' ? submitAI : submitManual}
            disabled={submitting}
            activeOpacity={0.88}
            haptic="medium"
          >
            {submitting ? (
              <ActivityIndicator color={INK} />
            ) : (
              <>
                <Text style={s.createSubmitText}>
                  {mode === 'ai' ? 'generate flashcards' : 'create flashcard set'}
                </Text>
                <Text style={s.createSubmitSubtext}>
                  {mode === 'ai' ? 'generate and open study mode' : 'save cards and open study mode'}
                </Text>
              </>
            )}
          </HapticTouchable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FlashcardsSets({
  user,
  onBack,
  refreshTick,
  onOpenCreate,
  onOpenStudy,
}: Props & {
  refreshTick: number;
  onOpenCreate: (mode?: CreateMode) => void;
  onOpenStudy: (set: FlashcardSet, cards: Flashcard[]) => void;
}) {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [fcStats, setFcStats] = useState<Record<string, number> | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    setLoading(true);
    getFlashcardHistory(user.username)
      .then((data) => {
        setSets(data?.flashcard_history ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    getFlashcardStatistics(user.username).then(setFcStats).catch(() => {});
  }, [user.username, refreshTick]);

  const startStudy = async (set: FlashcardSet) => {
    setLoadingCards(true);
    try {
      const data = await getFlashcardsInSet(set.id);
      const cards = (data?.flashcards ?? []) as Flashcard[];
      onOpenStudy(set, cards);
    } catch {
      Alert.alert('Unable to open set', 'The flashcards could not be loaded.');
    } finally {
      setLoadingCards(false);
    }
  };

  const totalCards = fcStats?.total_cards ?? '—';
  const totalSets = fcStats?.total_sets ?? '—';
  const mastered = fcStats?.cards_mastered ?? '—';
  const accuracy = fcStats?.average_accuracy != null ? `${Math.round(fcStats.average_accuracy)}%` : '—';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        {onBack ? (
          <HapticTouchable onPress={onBack} style={{ marginRight: 12 }} haptic="selection">
            <Ionicons name="chevron-back" size={22} color={GOLD_L} />
          </HapticTouchable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.title}>flashcards</Text>
          <Text style={s.subtitle}>study · create · retain</Text>
        </View>
        <Ionicons name="layers-outline" size={22} color={GOLD_D} />
      </View>

      <View style={s.statsStrip}>
        {[
          { val: totalSets, lbl: 'SETS' },
          { val: totalCards, lbl: 'CARDS' },
          { val: mastered, lbl: 'MASTERED' },
          { val: accuracy, lbl: 'ACCURACY' },
        ].map((item, index) => (
          <View key={item.lbl} style={[s.statCell, index > 0 && { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLbl}>{item.lbl}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sets}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <View style={s.createRow}>
              <HapticTouchable style={s.createBtnPrimary} onPress={() => onOpenCreate('ai')} haptic="medium">
                <Ionicons name="sparkles" size={15} color={INK} />
                <Text style={s.createBtnPrimaryText}>AI generate</Text>
              </HapticTouchable>
              <HapticTouchable style={s.createBtnSecondary} onPress={() => onOpenCreate('manual')} haptic="light">
                <Ionicons name="add" size={16} color={GOLD_L} />
                <Text style={s.createBtnSecondaryText}>manual</Text>
              </HapticTouchable>
            </View>
          )}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Text style={s.emptyTitle}>no flashcard sets yet</Text>
              <Text style={s.emptyHint}>start with AI generate or manual create</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <HapticTouchable
              style={[s.setCard, index % 2 === 0 && { borderColor: GOLD_XD }]}
              onPress={() => startStudy(item)}
              activeOpacity={0.85}
              haptic="light"
            >
              <View style={s.setCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.setTitle} numberOfLines={2}>{item.title.toLowerCase()}</Text>
                  {!!item.description && (
                    <Text style={s.setDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                </View>
                <View style={s.countBadge}>
                  <Text style={s.countText}>{item.card_count}</Text>
                  <Text style={s.countLbl}>cards</Text>
                </View>
              </View>

              <View style={s.masteryRow}>
                <View style={s.masteryBar}>
                  <View style={[s.masteryFill, { width: `${item.accuracy_percentage}%` as const }]} />
                </View>
                <Text style={s.masteryPct}>{Math.round(item.accuracy_percentage)}%</Text>
              </View>

              <View style={s.setCardBottom}>
                <View style={[s.sourcePill, item.source_type !== 'manual' && { backgroundColor: GOLD_XD }]}>
                  <Text style={s.sourceText}>{(item.source_type ?? 'manual').replace('_', ' ').toUpperCase()}</Text>
                </View>
                <View style={s.studyBtn}>
                  <Text style={s.studyBtnText}>study</Text>
                </View>
              </View>
            </HapticTouchable>
          )}
        />
      )}

      {loadingCards && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[s.emptyHint, { marginTop: 12 }]}>loading cards…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function FlashcardsScreen({ user, onBack }: Props) {
  const { selectedTheme } = useAppTheme();
  applyTheme(selectedTheme);
  s = createStyles();
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [refreshTick, setRefreshTick] = useState(0);

  if (!fontsLoaded) return null;

  return (
    <FlashcardsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <FlashcardsStack.Screen name="FlashcardsSets">
        {({ navigation }) => (
          <FlashcardsSets
            user={user}
            onBack={onBack}
            refreshTick={refreshTick}
            onOpenCreate={(mode) => navigation.navigate('FlashcardsCreate', { mode })}
            onOpenStudy={(set, cards) => navigation.navigate('FlashcardsStudy', { set, cards })}
          />
        )}
      </FlashcardsStack.Screen>
      <FlashcardsStack.Screen name="FlashcardsCreate">
        {({ navigation, route }) => (
          <FlashcardsCreate
            user={user}
            initialMode={route.params?.mode ?? 'ai'}
            onBack={() => navigation.goBack()}
            onCreated={(set, cards) => {
              setRefreshTick((value) => value + 1);
              navigation.replace('FlashcardsStudy', { set, cards });
            }}
          />
        )}
      </FlashcardsStack.Screen>
      <FlashcardsStack.Screen name="FlashcardsStudy">
        {({ route, navigation }) => (
          <StudyView
            set={route.params.set}
            cards={route.params.cards}
            onBack={() => navigation.goBack()}
            onComplete={(stats) => navigation.reset({
              index: 1,
              routes: [
                { name: 'FlashcardsSets' },
                { name: 'FlashcardsResults', params: { set: route.params.set, cards: route.params.cards, stats } },
              ],
            })}
          />
        )}
      </FlashcardsStack.Screen>
      <FlashcardsStack.Screen name="FlashcardsResults">
        {({ route, navigation }) => (
          <ResultsView
            stats={route.params.stats}
            onBack={() => navigation.goBack()}
            onRestart={() => navigation.replace('FlashcardsStudy', { set: route.params.set, cards: route.params.cards })}
          />
        )}
      </FlashcardsStack.Screen>
    </FlashcardsStack.Navigator>
  );
}

const CARD_H = H * 0.46;

function createStyles() {
  const softAccent = rgbaFromHex(ACCENT, 0.12);
  const softAccentBorder = rgbaFromHex(ACCENT, 0.26);
  const softAccentFill = rgbaFromHex(ACCENT, 0.18);
  const softDanger = rgbaFromHex(RED, 0.12);
  const softDangerBorder = rgbaFromHex(RED, 0.26);
  const softSuccess = rgbaFromHex(GREEN, 0.12);
  const softSuccessBorder = rgbaFromHex(GREEN, 0.26);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: { fontFamily: 'Inter_900Black', fontSize: 30, color: ACCENT },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, letterSpacing: 3, marginTop: 2 },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    marginHorizontal: 16,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 6,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statVal: { fontFamily: 'Inter_900Black', fontSize: 18, color: ACCENT },
  statLbl: { fontFamily: 'Inter_400Regular', fontSize: 8, color: DIM2, letterSpacing: 1.5, marginTop: 2 },

  listContent: { padding: 16, gap: 12, paddingBottom: 120, flexGrow: 1 },
  createRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  createBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  createBtnPrimaryText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: INK },
  createBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: softAccentBorder, backgroundColor: SURFACE_2,
  },
  createBtnSecondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: GOLD_L },

  setCard: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    gap: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  setCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  setTitle: { fontFamily: 'Inter_900Black', fontSize: 17, color: GOLD_L, lineHeight: 22 },
  setDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, marginTop: 3, lineHeight: 16 },

  countBadge: {
    backgroundColor: softAccent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: softAccentBorder,
  },
  countText: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_L },
  countLbl: { fontFamily: 'Inter_400Regular', fontSize: 8, color: GOLD_D, letterSpacing: 1, marginTop: 1 },

  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  masteryBar: { flex: 1, height: 3, backgroundColor: DIM, borderRadius: 2, overflow: 'hidden' },
  masteryFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  masteryPct: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_D, width: 36, textAlign: 'right' },

  setCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourcePill: { backgroundColor: softAccent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: softAccentBorder },
  sourceText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: GOLD_L, letterSpacing: 1.5 },
  studyBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 8 },
  studyBtnText: { fontFamily: 'Inter_900Black', fontSize: 12, color: INK },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 50 },
  emptyTitle: { fontFamily: 'Inter_900Black', fontSize: 18, color: GOLD_D },
  emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, letterSpacing: 1, textAlign: 'center' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG + 'EE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  createContent: { padding: 16, gap: 14, paddingBottom: 120 },
  heroCreateCard: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: softAccentBorder,
    padding: 18,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
  heroEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: GOLD_D, letterSpacing: 2.6, marginBottom: 10 },
  heroTitle: { fontFamily: 'Inter_900Black', fontSize: 22, lineHeight: 28, color: GOLD_L },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21, color: DIM2, marginTop: 8 },
  modeSwitch: { flexDirection: 'row', gap: 10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionPillActive: { backgroundColor: ACCENT, borderColor: ACCENT2 },
  optionPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: GOLD_L, textTransform: 'lowercase' },
  optionPillTextActive: { color: INK },
  formCard: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GOLD_D, letterSpacing: 1.8, textTransform: 'uppercase', marginTop: 14 },
  input: {
    marginTop: 10,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: GOLD_L,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  inputMultiline: { minHeight: 112 },
  manualCard: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 4,
  },
  manualCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  manualCardIndex: { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_L, textTransform: 'lowercase' },
  removeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: RED, textTransform: 'lowercase' },
  addCardBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: softAccentBorder,
    backgroundColor: SURFACE_2,
  },
  addCardText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: GOLD_L },
  createSubmitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    minHeight: 76,
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  createSubmitBtnDisabled: { opacity: 0.7 },
  createSubmitText: { fontFamily: 'Inter_900Black', fontSize: 15, color: INK, textTransform: 'lowercase' },
  createSubmitSubtext: { fontFamily: 'Inter_400Regular', fontSize: 11, color: INK, opacity: 0.7, marginTop: 4, textTransform: 'lowercase' },

  studyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  studyTitle: { fontFamily: 'Inter_900Black', fontSize: 15, color: GOLD_L, flex: 1, textAlign: 'center', marginHorizontal: 12 },
  studyCounter: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  progressBar: { height: 2, backgroundColor: DIM, marginHorizontal: 20 },
  progressFill: { height: '100%', backgroundColor: ACCENT },

  cardWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginVertical: 16 },
  card: {
    width: W - 40,
    height: CARD_H,
    backgroundColor: SURFACE,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: softAccentBorder,
    padding: 26,
    justifyContent: 'space-between',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  cardSide: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: GOLD_D, letterSpacing: 2.5 },
  cardText: { fontFamily: 'Inter_900Black', fontSize: 20, color: GOLD_L, lineHeight: 28, flex: 1, marginTop: 16 },
  tapHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM2, textAlign: 'center', letterSpacing: 1 },
  diffPill: { alignSelf: 'flex-start', backgroundColor: softAccentFill, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: softAccentBorder },
  diffText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: INK, letterSpacing: 1.5 },

  answerRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  wrongBtn: {
    flex: 1,
    backgroundColor: softDanger,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: softDangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 5,
  },
  rightBtn: {
    flex: 1,
    backgroundColor: softSuccess,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: softSuccessBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 5,
  },
  wrongLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: RED, letterSpacing: 1 },
  rightLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: GREEN, letterSpacing: 1 },

  resultsWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  bigPct: { fontFamily: 'Inter_900Black', fontSize: 88, lineHeight: 94 },
  resultsLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM2, letterSpacing: 3, marginBottom: 8 },
  resultsRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  resultStat: { flex: 1, alignItems: 'center', padding: 22 },
  resultNum: { fontFamily: 'Inter_900Black', fontSize: 40 },
  resultLbl: { fontFamily: 'Inter_400Regular', fontSize: 9, color: DIM2, letterSpacing: 1.5, marginTop: 4 },
  actionBtn: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: GOLD_D },
  actionBtnText: { fontFamily: 'Inter_900Black', fontSize: 14, color: INK },
});
}

let s: ReturnType<typeof createStyles> = createStyles();
