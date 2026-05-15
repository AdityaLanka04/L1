import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Loader2, AlertCircle, CheckSquare, Square,
  MessageCircle, Layers, Brain, Target, Sparkles, Zap, Clock, Folder, BookOpen
} from 'lucide-react';
import contextService from '../services/contextService';
import { API_URL } from '../config/api';
import './ContextFileAnalysis.css';

const FILE_INSIGHTS_KEY = 'ctx_file_action_stats';
const DECK_KEY = 'ctx_selected_doc_ids';
const DECK_SIZE = 8;

const FILE_ACTION_CHECKLIST = [
  { id: 'deck', label: 'Added to Context Deck' },
  { id: 'chat', label: 'Asked AI Chat' },
  { id: 'flashcards', label: 'Generated Flashcards' },
  { id: 'notes', label: 'Generated Notes' },
  { id: 'quiz', label: 'Generated Quiz' },
  { id: 'roadmap', label: 'Created Roadmap' },
];

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const loadDeck = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DECK_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveDeck = (ids) => {
  try {
    localStorage.setItem(DECK_KEY, JSON.stringify(ids));
  } catch {
    // no-op
  }
};

const loadFileActionStats = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILE_INSIGHTS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveFileActionStats = (payload) => {
  try {
    localStorage.setItem(FILE_INSIGHTS_KEY, JSON.stringify(payload || {}));
  } catch {
    // no-op
  }
};

const subjectLabel = (s) => (s || 'General').replace(/_/g, ' ');

const toArrayOfStrings = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
};

const normalizeListField = (value) => {
  if (Array.isArray(value)) return toArrayOfStrings(value);
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return toArrayOfStrings(parsed);
  } catch {
    // fall through to simple parsing
  }
  return trimmed
    .split(',')
    .map((item) => item.replace(/["'\[\]]/g, '').trim())
    .filter(Boolean);
};

const extractSummaryPayload = (rawSummary) => {
  if (!rawSummary || typeof rawSummary !== 'string') {
    return { title: '', description: '', keyConcepts: [], topicTags: [] };
  }

  const cleaned = rawSummary
    .replace(/\$"/g, '"')
    .replace(/"\$/g, '"')
    .trim();

  const candidates = [cleaned];
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch && objectMatch[0] !== cleaned) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const normalize = (key) => key.toLowerCase().replace(/[^a-z]/g, '');
      const keyMap = Object.keys(parsed).reduce((acc, key) => {
        acc[normalize(key)] = key;
        return acc;
      }, {});

      const pick = (aliases) => {
        for (const alias of aliases) {
          const foundKey = keyMap[alias];
          if (foundKey) return parsed[foundKey];
        }
        return undefined;
      };

      const topicTags = toArrayOfStrings(pick(['topictags', 'topics', 'tags']));
      const keyConcepts = toArrayOfStrings(pick(['keyconcepts', 'concepts']));
      const title = String(pick(['title', 'name', 'topic']) || '').trim();
      const description = String(pick(['description', 'summary']) || '').trim();

      return { title, description, keyConcepts, topicTags };
    } catch {
      // try next candidate
    }
  }

  // Fallback for partially malformed JSON-like strings.
  const pullList = (pattern) => {
    const match = cleaned.match(pattern);
    if (!match || !match[1]) return [];
    return match[1]
      .split(',')
      .map((item) => item.replace(/["'\]\[]/g, '').trim())
      .filter(Boolean);
  };

  const pullLooseList = (keyPattern) => {
    const start = cleaned.search(keyPattern);
    if (start < 0) return [];
    let segment = cleaned.slice(start);
    const sep = segment.search(/[:=]/);
    if (sep < 0) return [];
    segment = segment.slice(sep + 1);
    const nextField = segment.search(/,\s*["$]?[a-zA-Z_ ]+["$]?\s*[:=]/);
    if (nextField >= 0) {
      segment = segment.slice(0, nextField);
    }
    return Array.from(segment.matchAll(/"([^"]+)"/g)).map((m) => String(m[1] || '').trim()).filter(Boolean);
  };

  const topicTags = pullList(/(?:topic[_\s-]*tags|topics)\s*["']?\s*[:=]\s*\[([^\]]+)\]/i);
  const keyConcepts = pullList(/(?:key[_\s-]*concepts|concepts)\s*["']?\s*[:=]\s*\[([^\]]+)\]/i);
  const looseTopicTags = topicTags.length > 0
    ? topicTags
    : pullLooseList(/["$]?(?:topic[_\s-]*tags|topics)["$]?\s*[:=]/i);
  const looseKeyConcepts = keyConcepts.length > 0
    ? keyConcepts
    : pullLooseList(/["$]?(?:key[_\s-]*concepts|concepts)["$]?\s*[:=]/i);
  const titleMatch = cleaned.match(/(?:title|name)\s*["']?\s*[:=]\s*"([^"]+)"/i);
  const descriptionMatch = cleaned.match(/(?:description|summary)\s*["']?\s*[:=]\s*"([^"]+)"/i);
  if (looseTopicTags.length > 0 || looseKeyConcepts.length > 0 || titleMatch || descriptionMatch) {
    return {
      title: titleMatch ? String(titleMatch[1] || '').trim() : '',
      description: descriptionMatch ? String(descriptionMatch[1] || '').trim() : '',
      keyConcepts: looseKeyConcepts,
      topicTags: looseTopicTags,
    };
  }

  return { title: '', description: '', keyConcepts: [], topicTags: [] };
};

const ContextFileAnalysis = () => {
  const navigate = useNavigate();
  const { docId } = useParams();
  const resolvedDocId = useMemo(() => decodeURIComponent(docId || ''), [docId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState(null);
  const [progress, setProgress] = useState(null);
  const [deckIds, setDeckIds] = useState(loadDeck);
  const [actionStats, setActionStats] = useState(loadFileActionStats);
  const [notesLoading, setNotesLoading] = useState(false);

  const recordAction = useCallback((actionId) => {
    if (!actionId || !doc) return;
    const targetId = String(doc.doc_id || doc.id);
    const now = new Date().toISOString();

    setActionStats((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const current = next[targetId] && typeof next[targetId] === 'object' ? next[targetId] : {};
      const actions = current.actions && typeof current.actions === 'object' ? { ...current.actions } : {};
      actions[actionId] = (actions[actionId] || 0) + 1;
      next[targetId] = {
        first_used_at: current.first_used_at || now,
        last_used_at: now,
        total_actions: (Number(current.total_actions) || 0) + 1,
        actions,
      };
      saveFileActionStats(next);
      return next;
    });
  }, [doc]);

  const loadDocAnalysis = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [docData, progressData] = await Promise.all([
        contextService.listDocuments(),
        contextService.getProgress(),
      ]);

      const userDocs = Array.isArray(docData?.user_docs) ? docData.user_docs : [];
      const matched = userDocs.find((item) => String(item.doc_id || item.id) === String(resolvedDocId));
      if (!matched) {
        setDoc(null);
        setProgress(null);
        setError('File not found. It may have been deleted or moved.');
        return;
      }

      const docProgress = (progressData?.doc_progress || []).find((item) => String(item.doc_id) === String(matched.doc_id || matched.id)) || null;
      setDoc(matched);
      setProgress(docProgress);
      setActionStats(loadFileActionStats());
      setDeckIds(loadDeck());
    } catch (e) {
      setDoc(null);
      setProgress(null);
      setError(e.message || 'Failed to load file analysis.');
    } finally {
      setLoading(false);
    }
  }, [resolvedDocId]);

  useEffect(() => {
    loadDocAnalysis();
  }, [loadDocAnalysis]);

  const inDeck = useMemo(() => {
    if (!doc) return false;
    return deckIds.map((id) => String(id)).includes(String(doc.doc_id || doc.id));
  }, [deckIds, doc]);

  const addToDeck = useCallback(() => {
    if (!doc) return;
    const targetId = doc.doc_id || doc.id;
    if (deckIds.map((id) => String(id)).includes(String(targetId))) return;
    if (deckIds.length >= DECK_SIZE) {
      alert(`Context Deck is full (${DECK_SIZE}/${DECK_SIZE}). Remove one file first.`);
      return;
    }
    const next = [...deckIds, targetId];
    setDeckIds(next);
    saveDeck(next);
    recordAction('deck');
  }, [deckIds, doc, recordAction]);

  const removeFromDeck = useCallback(() => {
    if (!doc) return;
    const targetId = String(doc.doc_id || doc.id);
    const next = deckIds.filter((id) => String(id) !== targetId);
    setDeckIds(next);
    saveDeck(next);
  }, [deckIds, doc]);

  const runDocAction = useCallback(async (target) => {
    if (!doc) return;
    const targetId = doc.doc_id || doc.id;
    const sourceName = doc.filename || doc.title || 'Untitled';
    saveDeck([targetId]);

    if (target === 'chat') {
      recordAction('chat');
      navigate('/ai-chat', {
        state: {
          initialMessage: `Use this context file: ${sourceName}. Help me study what matters most.`,
        },
      });
      return;
    }
    if (target === 'flashcards') {
      recordAction('flashcards');
      navigate('/flashcards', {
        state: {
          contextDocIds: [targetId],
          initialTopic: sourceName,
          generationMode: 'topic',
          openPanel: 'generator',
          autoGenerateFromContext: true,
        },
      });
      return;
    }
    if (target === 'quiz') {
      recordAction('quiz');
      navigate('/question-bank', {
        state: {
          contextDocIds: [targetId],
          topic: sourceName,
          openView: 'custom',
          autoGenerateFromContext: true,
        },
      });
      return;
    }
    if (target === 'notes') {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('username') || localStorage.getItem('user_id') || localStorage.getItem('email');
      if (!token || !userId) {
        alert('Please log in again.');
        return;
      }
      setNotesLoading(true);
      try {
        const response = await fetch(`${API_URL}/create_note_from_context_docs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            context_doc_ids: [targetId],
            title: `Notes: ${sourceName}`,
            depth: 'deep',
            tone: 'professional',
          }),
        });
        if (!response.ok) throw new Error(`Failed (${response.status})`);
        const data = await response.json();
        if (data?.id) {
          recordAction('notes');
          navigate(`/notes/editor/${data.id}`);
        } else {
          alert('Notes were generated, but opening the editor failed.');
        }
      } catch {
        alert('Failed to generate notes from this file.');
      } finally {
        setNotesLoading(false);
      }
      return;
    }

    recordAction('roadmap');
    navigate('/knowledge-roadmap', {
      state: {
        contextDocIds: [targetId],
        sourceSummary: sourceName,
        autoCreateFromContext: true,
      },
    });
  }, [doc, navigate, recordAction]);

  const insights = useMemo(() => {
    if (!doc) return null;
    const targetId = String(doc.doc_id || doc.id);
    const tracked = actionStats[targetId] || {};
    const actionCounts = tracked.actions && typeof tracked.actions === 'object' ? tracked.actions : {};
    const summaryPayload = extractSummaryPayload(doc.ai_summary);

    const topics = Array.from(new Set([
      ...normalizeListField(doc.topic_tags),
      ...normalizeListField(doc.key_concepts),
      ...summaryPayload.topicTags,
      ...summaryPayload.keyConcepts,
      ...(doc.subject ? [subjectLabel(doc.subject)] : []),
    ].map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 20);

    const masteredTopics = Array.isArray(progress?.mastered_topics) ? progress.mastered_topics : [];
    const weakTopics = Array.isArray(progress?.weak_topics) ? progress.weak_topics : [];
    const remainingTopics = Array.isArray(progress?.remaining_topics) ? progress.remaining_topics : [];
    const topicsTotal = Number(progress?.topics_total || topics.length || 0);
    const masteredCount = Number(progress?.mastered_topics_count || masteredTopics.length || 0);
    const weakCount = Number(progress?.weak_topics_count || weakTopics.length || 0);
    const remainingCount = Number(progress?.remaining_topics_count || remainingTopics.length || Math.max(topicsTotal - masteredCount - weakCount, 0));
    const masteryPct = Math.round(Number(progress?.mastery_pct || (topicsTotal > 0 ? (masteredCount / topicsTotal) * 100 : 0)));

    const doneActions = FILE_ACTION_CHECKLIST.filter((item) => Number(actionCounts[item.id] || 0) > 0);
    const pendingActions = FILE_ACTION_CHECKLIST.filter((item) => Number(actionCounts[item.id] || 0) === 0);
    const actionCoveragePct = Math.round((doneActions.length / FILE_ACTION_CHECKLIST.length) * 100);
    const totalActions = Object.values(actionCounts).reduce((acc, value) => acc + (Number(value) || 0), 0);

    const readinessScore = Math.max(
      5,
      Math.min(
        100,
        Math.round(masteryPct * 0.58 + actionCoveragePct * 0.3 + Math.min(totalActions, 10) * 2.2 + (inDeck ? 8 : 0))
      )
    );

    let recommendation = {
      action: 'chat',
      title: 'Ask AI for a walkthrough',
      detail: 'Use AI chat to understand structure, key ideas, and likely exam angles.',
    };
    if (weakCount > 0) {
      recommendation = {
        action: 'quiz',
        title: 'Practice weak topics',
        detail: `Run a focused quiz on: ${weakTopics.slice(0, 2).join(', ') || 'your weak areas'}.`,
      };
    } else if (remainingCount > 0 && Number(actionCounts.notes || 0) === 0) {
      recommendation = {
        action: 'notes',
        title: 'Generate deep notes',
        detail: 'Convert unfinished areas into a structured, revision-ready note.',
      };
    } else if (Number(actionCounts.flashcards || 0) === 0) {
      recommendation = {
        action: 'flashcards',
        title: 'Build memory cards',
        detail: 'Create flashcards to lock retention for the main concepts.',
      };
    } else if (!inDeck) {
      recommendation = {
        action: 'deck',
        title: 'Add this file to Context Deck',
        detail: 'Prioritize this file in future AI responses.',
      };
    } else if (Number(actionCounts.roadmap || 0) === 0) {
      recommendation = {
        action: 'roadmap',
        title: 'Create a study roadmap',
        detail: 'Build a step-wise plan from this file’s topic graph.',
      };
    }

    const rawSummaryText = typeof doc.ai_summary === 'string' ? doc.ai_summary : '';

    return {
      topics,
      summaryTitle: summaryPayload.title,
      summaryText: summaryPayload.description || (!rawSummaryText.trim().startsWith('{') ? rawSummaryText : ''),
      masteredTopics,
      weakTopics,
      remainingTopics,
      topicsTotal,
      masteredCount,
      weakCount,
      remainingCount,
      masteryPct,
      doneActions,
      pendingActions,
      actionCounts,
      actionCoveragePct,
      readinessScore,
      recommendation,
      totalActions,
      lastUsedAt: tracked.last_used_at || '',
    };
  }, [actionStats, doc, inDeck, progress]);

  if (loading) {
    return (
      <div className="cfp-root">
        <div className="cfp-state">
          <Loader2 size={28} className="cfp-spin" />
          <p>Loading detailed file analysis…</p>
        </div>
      </div>
    );
  }

  if (error || !doc || !insights) {
    return (
      <div className="cfp-root">
        <div className="cfp-topbar">
          <button className="cfp-back-btn" onClick={() => navigate('/contexthub')}>
            <ArrowLeft size={14} /> Back to ContextHub
          </button>
        </div>
        <div className="cfp-state cfp-state-error">
          <AlertCircle size={26} />
          <p>{error || 'Could not open this file.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cfp-root">
      <div className="cfp-topbar">
        <button className="cfp-back-btn" onClick={() => navigate('/contexthub')}>
          <ArrowLeft size={14} /> Back to ContextHub
        </button>
      </div>

      <main className="cfp-main">
        <section className="cfp-hero">
          <p className="cfp-eyebrow">FULL FILE ANALYSIS</p>
          <h1>{doc.filename || doc.title || 'Untitled file'}</h1>
          <p className="cfp-sub">
            Detailed intelligence for this document: topics, progress, weak/strong areas, completed actions, pending actions, and next-step recommendations.
          </p>
          <div className="cfp-badges">
            <span><BookOpen size={12} /> {subjectLabel(doc.subject || 'General')}</span>
            <span><Folder size={12} /> {doc.folder_name || 'Uncategorized'}</span>
            <span><FileText size={12} /> {doc.chunk_count || 0} chunks</span>
            <span><Clock size={12} /> Uploaded {fmtDate(doc.created_at)}</span>
            <span className={inDeck ? 'accent' : ''}><Zap size={12} /> {inDeck ? 'In Context Deck' : 'Not in Deck'}</span>
          </div>
        </section>

        <section className="cfp-actions">
          <button className="cfp-action cfp-action-chat" onClick={() => runDocAction('chat')}><MessageCircle size={14} /> AI Chat</button>
          <button className="cfp-action cfp-action-flash" onClick={() => runDocAction('flashcards')}><Layers size={14} /> Flashcards</button>
          <button className="cfp-action cfp-action-notes" onClick={() => runDocAction('notes')} disabled={notesLoading}>
            {notesLoading ? <Loader2 size={14} className="cfp-spin" /> : <FileText size={14} />} Notes
          </button>
          <button className="cfp-action cfp-action-quiz" onClick={() => runDocAction('quiz')}><Brain size={14} /> Quiz</button>
          <button className="cfp-action cfp-action-roadmap" onClick={() => runDocAction('roadmap')}><Target size={14} /> Roadmap</button>
          <button className="cfp-action cfp-action-deck" onClick={() => (inDeck ? removeFromDeck() : addToDeck())}>
            {inDeck ? <CheckSquare size={14} /> : <Square size={14} />}
            {inDeck ? 'Remove from Deck' : 'Add to Deck'}
          </button>
        </section>

        <section className="cfp-grid">
          <article className="cfp-card">
            <h3>Performance Snapshot</h3>
            <div className="cfp-metrics">
              <div><span>Readiness</span><strong>{insights.readinessScore}%</strong></div>
              <div><span>Mastery</span><strong>{insights.masteryPct}%</strong></div>
              <div><span>Done Topics</span><strong>{insights.masteredCount}/{insights.topicsTotal}</strong></div>
              <div><span>Action Coverage</span><strong>{insights.actionCoveragePct}%</strong></div>
            </div>
            <div className="cfp-chip-row">
              <span className="ok">Done {insights.masteredCount}</span>
              <span className="warn">Left {insights.remainingCount}</span>
              <span className="bad">Weak {insights.weakCount}</span>
            </div>
          </article>

          <article className="cfp-card">
            <h3>Recommended Next Step</h3>
            <p className="cfp-reco-title">{insights.recommendation.title}</p>
            <p className="cfp-muted">{insights.recommendation.detail}</p>
            <button
              className="cfp-reco-btn"
              onClick={() => {
                if (insights.recommendation.action === 'deck') {
                  inDeck ? removeFromDeck() : addToDeck();
                  return;
                }
                runDocAction(insights.recommendation.action);
              }}
            >
              <Sparkles size={13} /> Run Recommendation
            </button>
          </article>

          <article className="cfp-card cfp-card-wide">
            <h3>Topics Found</h3>
            {insights.topics.length > 0 ? (
              <div className="cfp-tags">
                {insights.topics.map((topic, idx) => <span key={`${topic}-${idx}`}>{topic}</span>)}
              </div>
            ) : (
              <p className="cfp-muted">No topic tags found yet.</p>
            )}
            {insights.summaryTitle && <p className="cfp-reco-title">{insights.summaryTitle}</p>}
            {insights.summaryText && <p className="cfp-muted">{insights.summaryText}</p>}
          </article>

          <article className="cfp-card">
            <h3>Strong Areas</h3>
            {insights.masteredTopics.length > 0 ? (
              <div className="cfp-list">
                {insights.masteredTopics.map((item, idx) => <span key={`mastered-${idx}`}>• {item}</span>)}
              </div>
            ) : <p className="cfp-muted">No mastered topics detected yet.</p>}
          </article>

          <article className="cfp-card">
            <h3>Weak Areas</h3>
            {insights.weakTopics.length > 0 ? (
              <div className="cfp-list">
                {insights.weakTopics.map((item, idx) => <span key={`weak-${idx}`}>• {item}</span>)}
              </div>
            ) : <p className="cfp-muted">No weak topics detected from current mastery data.</p>}
          </article>

          <article className="cfp-card">
            <h3>Not Done Yet</h3>
            {insights.remainingTopics.length > 0 ? (
              <div className="cfp-list">
                {insights.remainingTopics.map((item, idx) => <span key={`remaining-${idx}`}>• {item}</span>)}
              </div>
            ) : <p className="cfp-muted">No remaining topics detected.</p>}
          </article>

          <article className="cfp-card">
            <h3>Action History</h3>
            <div className="cfp-checks">
              {FILE_ACTION_CHECKLIST.map((item) => {
                const count = Number(insights.actionCounts[item.id] || 0);
                return (
                  <span key={item.id} className={count > 0 ? 'done' : ''}>
                    {item.label} {count > 0 ? `(${count})` : ''}
                  </span>
                );
              })}
            </div>
            <p className="cfp-muted">
              Total actions: {insights.totalActions} · Last activity: {insights.lastUsedAt ? fmtDate(insights.lastUsedAt) : 'none yet'}
            </p>
          </article>
        </section>
      </main>
    </div>
  );
};

export default ContextFileAnalysis;
