// src/components/HelpTour.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, ChevronLeft, ChevronRight, HelpCircle, SkipForward, Play,
  RefreshCw, AlertTriangle
} from 'lucide-react';

/**
 * Glass UI Theme — tuned for dark dashboards
 * You can tweak ACCENT_* to your brand color.
 */
const PANEL_BG_TOP = 'rgba(16, 18, 22, 0.35)';
const PANEL_BG_BOTTOM = 'rgba(18, 20, 25, 0.44)';
const PANEL_BORDER = 'rgba(255, 255, 255, 0.14)';
const PANEL_INNER_HAIRLINE = 'rgba(255,255,255,0.06)';
const PANEL_SHADOW = '0 16px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)';
const TEXT_PRIMARY = '#EDEFF3';
const TEXT_SECONDARY = 'rgba(228,234,244,0.78)';
const DIM_BG = 'rgba(2, 3, 5, 0.55)';

const ACCENT_START = '#E7B768'; // warm gold
const ACCENT_END   = '#F5D9B2'; // soft cream
const ACCENT_BORDER = 'rgba(231,183,104,0.75)';

const PROGRESS_TRACK = 'rgba(255,255,255,0.10)';
const DOT_ACTIVE_GLOW = '0 0 0 6px rgba(244,199,119,0.22)';

// Spotlight ring around target
const SPOTLIGHT_BORDER = ACCENT_START; 
const SPOTLIGHT_GLOW_MAIN = '0 0 0 10px rgba(231,183,104,0.25)'; // warm gold glow
const SPOTLIGHT_GLOW_SOFT = '0 14px 38px rgba(0,0,0,0.50)';
const HelpTour = ({
  isOpen,
  onClose,
  onComplete,
  steps,
  autoSkipMissing = false,
  observeRoot = typeof document !== 'undefined' ? document.body : null,
  maxRetriesPerStep = 10,
  retryIntervalMs = 50,
  maxScrollWaitMs = 450,
  scrollBehavior = 'smooth',
}) => {
  // ---------- Steps ----------
  const defaultSteps = useMemo(
    () => [
      {
        id: 'welcome',
        title: 'Welcome to Brainwave!',
        content:
          'Let me show you around your personalized learning dashboard. This interactive tour will help you discover the features that make studying faster and more effective.',
        target: '.welcome-section',
        position: 'bottom',
      },
      {
        id: 'ai-assistant',
        title: 'AI Learning Assistant',
        content:
          'Start a session with your personal AI tutor—ask doubts, get examples, and clarify concepts in seconds.',
        target: '.ai-assistant-card',
        position: 'right',
      },
      {
        id: 'quick-actions',
        title: 'Quick Actions',
        content: 'Jump to flashcards, notes, and other essentials instantly.',
        target: '.quick-actions',
        position: 'right',
      },
      {
        id: 'learning-stats',
        title: 'Learning Statistics',
        content:
          'Track streaks, questions answered, time studied, and AI sessions. Use this to keep your momentum strong.',
        target: '.stats-overview-widget',
        position: 'left',
      },
      {
        id: 'daily-goal',
        title: 'Daily Goals',
        content:
          'Set your target and watch the ring fill as you learn. Small daily wins compound fast.',
        target: '.daily-goal-widget',
        position: 'left',
      },
      {
        id: 'learning-reviews',
        title: 'Learning Reviews',
        content:
          'Auto-generated quizzes from your chats. Create new reviews or continue where you left off.',
        target: '.learning-review-widget',
        position: 'left',
      },
      {
        id: 'recent-activity',
        title: 'Recent Activity',
        content: 'A quick feed of your latest study actions and scores.',
        target: '.recent-activity-widget',
        position: 'left',
      },
      {
        id: 'activity-heatmap',
        title: 'Activity Heatmap',
        content:
          'See your yearly consistency. Darker means more study that day—aim for streaks.',
        target: '.activity-heatmap',
        position: 'top',
      },
      {
        id: 'customization',
        title: 'Dashboard Customization',
        content:
          'Click “CUSTOMIZE” to reorder, resize, or toggle widgets to match your flow.',
        target: '.customize-btn',
        position: 'bottom',
      },
      {
        id: 'profile',
        title: 'Profile & Settings',
        content: 'Tune preferences and manage your account here.',
        target: '.profile-btn',
        position: 'bottom',
      },
      {
        id: 'progress-chart',
        title: 'Weekly Progress',
        content: 'Track questions solved per day this week at a glance.',
        target: '.progress-chart-widget',
        position: 'left',
      },
      {
        id: 'motivational-quote',
        title: 'Daily Quote',
        content: 'A little motivation to keep you going!',
        target: '.motivational-quote-widget',
        position: 'right',
      },
      
    ],
    []
  );
  const tourSteps = steps?.length ? steps : defaultSteps;

  // ---------- State ----------
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [missingTarget, setMissingTarget] = useState(false);

  // ---------- Refs ----------
  const tooltipRef = useRef(null);
  const arrowRef = useRef(null);
  const blurTopRef = useRef(null);
  const blurBottomRef = useRef(null);
  const blurLeftRef = useRef(null);
  const blurRightRef = useRef(null);
  const mutationObserverRef = useRef(null);
  const mountedRef = useRef(false);

  // ---------- Mount guards & scheduler ----------
  const schedule = (fn) => requestAnimationFrame(() => mountedRef.current && fn());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ---------- Open/close ----------
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setCurrentStep(0);
      setMissingTarget(false);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // ---------- Utilities ----------
  const getScrollableParent = (el) => {
    let p = el?.parentElement;
    while (p) {
      const s = window.getComputedStyle(p);
      const canScroll = /auto|scroll|overlay/.test(s.overflowY);
      if (canScroll && p.scrollHeight > p.clientHeight) return p;
      p = p.parentElement;
    }
    return window;
  };

  const isElementInViewport = (el, threshold = 0.85) => {
    const r = el.getBoundingClientRect?.();
    if (!r) return false;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;

    const visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const visibleW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const area = r.width * r.height || 1;
    const visibleArea = visibleH * visibleW;
    return (visibleArea / area) >= threshold;
  };

  const waitForScrollEnd = (node) =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const startTime = performance.now();
      let last = node === window ? window.scrollY : node.scrollTop;
      let still = 0;

      const tick = () => {
        if (!mountedRef.current) return finish();
        const now = performance.now();
        const cur = node === window ? window.scrollY : node.scrollTop;
        still = Math.abs(cur - last) < 1 ? still + 1 : 0;
        last = cur;

        if (still >= 4) return finish();
        if (now - startTime > maxScrollWaitMs) return finish();
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      setTimeout(finish, maxScrollWaitMs + 60);
    });

  const centerIntoView = async (element, offsetTop = 0) => {
    if (!element?.getBoundingClientRect) return;

    const parent = getScrollableParent(element);

    // Skip scrolling if already mostly visible
    if (isElementInViewport(element, 0.8)) return;

    setIsScrolling(true);

    if (parent === window) {
      const rect = element.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - (window.innerHeight / 2 - rect.height / 2) - offsetTop;
      window.scrollTo({ top: Math.max(0, targetY), behavior: scrollBehavior });
      await waitForScrollEnd(window);
    } else {
      const parentRect = parent.getBoundingClientRect();
      const elRect = element.getBoundingClientRect();
      const current = parent.scrollTop;
      const target = current + (elRect.top - parentRect.top) - (parent.clientHeight / 2 - elRect.height / 2) - offsetTop;
      parent.scrollTo({ top: Math.max(0, target), behavior: scrollBehavior });
      await waitForScrollEnd(parent);
    }

    setIsScrolling(false);
  };

  const findTargetWithRetries = async (selector) => {
    for (let i = 0; i < maxRetriesPerStep; i++) {
      const el = document.querySelector(selector);
      if (el) return el;
      await new Promise(r => setTimeout(r, retryIntervalMs));
    }
    return null;
  };

  const placeTooltipSmart = (rect, preferred, tooltipRect, margin = 20, gap = 14) => {
    const topSpace = rect.top;
    const bottomSpace = window.innerHeight - rect.bottom;
    const leftSpace = rect.left;
    const rightSpace = window.innerWidth - rect.right;

    const canTop = topSpace >= tooltipRect.height + gap + margin;
    const canBottom = bottomSpace >= tooltipRect.height + gap + margin;
    const canLeft = leftSpace >= tooltipRect.width + gap + margin;
    const canRight = rightSpace >= tooltipRect.width + gap + margin;

    const order = [preferred, 'bottom', 'right', 'left', 'top'];
    const fits = { top: canTop, bottom: canBottom, left: canLeft, right: canRight };
    const side = order.find((s) => fits[s]) || (['bottom','right','left','top'].sort((a,b) => {
      const map = { top: topSpace, bottom: bottomSpace, left: leftSpace, right: rightSpace };
      return map[b] - map[a];
    })[0]);

    let top, left;
    if (side === 'top') {
      top = rect.top - tooltipRect.height - gap;
      left = rect.left + (rect.width - tooltipRect.width) / 2;
    } else if (side === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + (rect.width - tooltipRect.width) / 2;
    } else if (side === 'left') {
      top = rect.top + (rect.height - tooltipRect.height) / 2;
      left = rect.left - tooltipRect.width - gap;
    } else {
      top = rect.top + (rect.height - tooltipRect.height) / 2;
      left = rect.right + gap;
    }

    const clampedTop = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));
    const clampedLeft = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));

    return { side, top: clampedTop, left: clampedLeft };
  };

  const positionArrow = (side, rect, tooltipRect, top, left) => {
    const arrow = arrowRef.current;
    if (!arrow) return;
    const size = 10;

    // reset
    arrow.style.borderWidth = '';
    arrow.style.top = '';
    arrow.style.left = '';
    arrow.style.right = '';
    arrow.style.bottom = '';

    const arrowColor = 'rgba(18,20,25,0.55)';

    if (side === 'top') {
      arrow.style.borderWidth = `${size}px ${size}px 0 ${size}px`;
      arrow.style.borderColor = `${arrowColor} transparent transparent transparent`;
      arrow.style.bottom = `-${size}px`;
      arrow.style.left = `${Math.min(tooltipRect.width - 24, Math.max(24, rect.left + rect.width / 2 - left)) - size}px`;
    } else if (side === 'bottom') {
      arrow.style.borderWidth = `0 ${size}px ${size}px ${size}px`;
      arrow.style.borderColor = `transparent transparent ${arrowColor} transparent`;
      arrow.style.top = `-${size}px`;
      arrow.style.left = `${Math.min(tooltipRect.width - 24, Math.max(24, rect.left + rect.width / 2 - left)) - size}px`;
    } else if (side === 'left') {
      arrow.style.borderWidth = `${size}px 0 ${size}px ${size}px`;
      arrow.style.borderColor = `transparent transparent transparent ${arrowColor}`;
      arrow.style.right = `-${size}px`;
      arrow.style.top = `${Math.min(tooltipRect.height - 24, Math.max(24, rect.top + rect.height / 2 - top)) - size}px`;
    } else if (side === 'right') {
      arrow.style.borderWidth = `${size}px ${size}px ${size}px 0`;
      arrow.style.borderColor = `transparent ${arrowColor} transparent transparent`;
      arrow.style.left = `-${size}px`;
      arrow.style.top = `${Math.min(tooltipRect.height - 24, Math.max(24, rect.top + rect.height / 2 - top)) - size}px`;
    }
  };

  // ---------- Core: updateHighlight ----------
  const updateHighlight = async () => {
    if (!mountedRef.current || !isVisible) return;

    const step = tourSteps[currentStep];
    if (!step?.target) return;

    const tooltip = tooltipRef.current;
    if (!tooltip) {
      schedule(updateHighlight);
      return;
    }

    let targetElement = document.querySelector(step.target);
    if (!targetElement) targetElement = await findTargetWithRetries(step.target);

    if (!targetElement) {
      if (autoSkipMissing && currentStep < tourSteps.length - 1) {
        setMissingTarget(false);
        setCurrentStep((s) => s + 1);
      } else {
        setMissingTarget(true);
      }
      return;
    }

    setMissingTarget(false);

    // center if needed
    await centerIntoView(targetElement, 0);
    if (!mountedRef.current) return;

    const elRect = targetElement.getBoundingClientRect?.();
    const tooltipRect = tooltip.getBoundingClientRect?.();
    if (!elRect || !tooltipRect) {
      schedule(updateHighlight);
      return;
    }

    // Spotlight ring
    const padding = 14;
    const radius = 14;
    const hole = {
      top: Math.max(0, elRect.top - padding),
      left: Math.max(0, elRect.left - padding),
      width: elRect.width + padding * 2,
      height: elRect.height + padding * 2,
      right: Math.min(window.innerWidth, elRect.right + padding),
      bottom: Math.min(window.innerHeight, elRect.bottom + padding)
    };

    const spotlight = document.querySelector('.help-tour-spotlight');
    if (spotlight) {
      spotlight.style.top = `${hole.top}px`;
      spotlight.style.left = `${hole.left}px`;
      spotlight.style.width = `${hole.width}px`;
      spotlight.style.height = `${hole.height}px`;
      spotlight.style.borderRadius = `${radius}px`;
    }

    // Blur panes (kept for screen blur around target)
    const commonBlurStyle = (el) => {
      el.style.position = 'absolute';
      el.style.backdropFilter = 'blur(8px) saturate(110%)';
      el.style.WebkitBackdropFilter = 'blur(8px) saturate(110%)';
      el.style.background = 'rgba(8,10,14,0.35)';
      el.style.pointerEvents = 'auto';
      el.style.zIndex = 10000;
      el.style.transition = 'all .25s ease';
      el.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.06)';
    };
    const topPane = blurTopRef.current;
    const bottomPane = blurBottomRef.current;
    const leftPane = blurLeftRef.current;
    const rightPane = blurRightRef.current;
    [topPane, bottomPane, leftPane, rightPane].forEach((el) => el && commonBlurStyle(el));

    if (topPane) {
      topPane.style.top = '0px';
      topPane.style.left = '0px';
      topPane.style.width = '100%';
      topPane.style.height = `${hole.top}px`;
    }
    if (bottomPane) {
      bottomPane.style.top = `${hole.bottom}px`;
      bottomPane.style.left = '0px';
      bottomPane.style.width = '100%';
      bottomPane.style.height = `${Math.max(0, window.innerHeight - hole.bottom)}px`;
    }
    if (leftPane) {
      leftPane.style.top = `${hole.top}px`;
      leftPane.style.left = '0px';
      leftPane.style.width = `${hole.left}px`;
      leftPane.style.height = `${hole.height}px`;
    }
    if (rightPane) {
      rightPane.style.top = `${hole.top}px`;
      rightPane.style.left = `${hole.right}px`;
      rightPane.style.width = `${Math.max(0, window.innerWidth - hole.right)}px`;
      rightPane.style.height = `${hole.height}px`;
    }

    // Tooltip placement
    const { side, top, left } = placeTooltipSmart(elRect, step.position, tooltipRect);
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'scale(1) translateY(0)';
    tooltip.setAttribute('data-side', side);
    positionArrow(side, elRect, tooltipRect, top, left);
  };

  // ---------- Reposition on step/visibility/resize ----------
  useEffect(() => {
    if (isVisible) schedule(updateHighlight);
    const onResize = () => schedule(updateHighlight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, currentStep, tourSteps]);

  // ---------- Route changes (SPA) ----------
  useEffect(() => {
    const onRoute = () => schedule(updateHighlight);
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // ---------- Asset load ----------
  useEffect(() => {
    const onLoad = () => schedule(updateHighlight);
    window.addEventListener('load', onLoad);
    document.fonts?.addEventListener?.('loadingdone', onLoad);
    return () => {
      window.removeEventListener('load', onLoad);
      document.fonts?.removeEventListener?.('loadingdone', onLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // ---------- MutationObserver ----------
  useEffect(() => {
    if (!isVisible || !observeRoot) return;
    let rafId = null;
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (tooltipRef.current) updateHighlight();
      });
    };

    const mo = new MutationObserver((mutations) => {
      const relevant = mutations.some(m =>
        m.type === 'childList' ||
        (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class'))
      );
      if (relevant) scheduleUpdate();
    });

    mo.observe(observeRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    mutationObserverRef.current = mo;

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      mo.disconnect();
      mutationObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, observeRoot, currentStep, tourSteps]);

  // ---------- Controls ----------
  const completeTour = () => {
    setIsVisible(false);
    localStorage.setItem('hasCompletedTour', 'true');
    onComplete && onComplete();
    onClose && onClose();
  };
  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) setCurrentStep(s => s + 1);
    else completeTour();
  };
  const prevStep = () => currentStep > 0 && setCurrentStep(s => s - 1);
  const skipTour = () => completeTour();
  const goToStep = (i) => setCurrentStep(i);

  if (!isVisible) return null;

  const currentStepData = tourSteps[currentStep];
  const progressPercentage = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      {/* Dim base */}
      <div style={{ position: 'absolute', inset: 0, background: DIM_BG, pointerEvents: 'auto' }} />

      {/* 4 Blur panes */}
      <div ref={blurTopRef} />
      <div ref={blurBottomRef} />
      <div ref={blurLeftRef} />
      <div ref={blurRightRef} />

      {/* Spotlight */}
      <div
        className="help-tour-spotlight"
        style={{
          position: 'absolute',
          background: 'transparent',
          border: `1px solid ${SPOTLIGHT_BORDER}`,
          borderRadius: '14px',
          boxShadow: `${SPOTLIGHT_GLOW_MAIN}, ${SPOTLIGHT_GLOW_SOFT}`,
          outline: `1px solid rgba(255,255,255,0.10)`,
          transition: 'all 0.28s ease',
          pointerEvents: 'none',
          zIndex: 10001
        }}
      />

      {/* Loading / Navigating */}
      {isScrolling && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(20,22,26,0.50)',
            color: TEXT_PRIMARY,
            padding: '12px 16px',
            borderRadius: '14px',
            border: `1px solid ${PANEL_BORDER}`,
            boxShadow: PANEL_SHADOW,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10003,
            pointerEvents: 'auto',
            backdropFilter: 'blur(12px) saturate(120%)',
            WebkitBackdropFilter: 'blur(12px) saturate(120%)'
          }}
        >
          <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTop: `2px solid ${ACCENT_END}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.2 }}>Navigating…</span>
        </div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          background: `linear-gradient(180deg, ${PANEL_BG_TOP}, ${PANEL_BG_BOTTOM})`,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 18,
          boxShadow: PANEL_SHADOW,
          maxWidth: 460,
          minWidth: 330,
          zIndex: 10002,
          pointerEvents: 'auto',
          opacity: 0,
          transform: 'scale(0.96) translateY(8px)',
          transition: 'opacity .25s ease, transform .25s ease',
          overflow: 'hidden',
          color: TEXT_PRIMARY,
          backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        }}
      >
        {/* Arrow */}
        <div
          ref={arrowRef}
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderColor: 'transparent',
            filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.28))'
          }}
        />

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 20px 12px 20px',
          borderBottom: `1px solid ${PANEL_INNER_HAIRLINE}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 22, display: 'grid', placeItems: 'center',
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`,
              color: '#0f1012',
              boxShadow: '0 6px 18px rgba(231,183,104,0.25), inset 0 1px 0 rgba(255,255,255,0.35)'
            }}>
              {currentStepData.icon ?? '•'}
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.2, letterSpacing: .2 }}>
              {currentStepData.title}
            </h3>
          </div>
          <button
            onClick={completeTour}
            aria-label="Close tour"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${PANEL_INNER_HAIRLINE}`,
              cursor: 'pointer',
              padding: 8,
              borderRadius: 10,
              color: TEXT_SECONDARY,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '10px 20px 10px 20px' }}>
          {!missingTarget ? (
            <p style={{ margin: 0, color: TEXT_SECONDARY, lineHeight: 1.65, fontSize: 15 }}>
              {currentStepData.content}
            </p>
          ) : (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              color: '#FFE7B8',
              background: 'rgba(73,53,12,0.35)',
              border: '1px solid rgba(255,214,143,0.25)',
              padding: 12, borderRadius: 12,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
            }}>
              <AlertTriangle style={{ width: 18, height: 18, flex: '0 0 auto' }} />
              <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>
                <strong>Widget not found. Add it from <span style={{ color: ACCENT_START }}>Customize</span>, or skip ahead.</strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 18px 18px 18px',
            borderTop: `1px solid ${PANEL_INNER_HAIRLINE}`,
            background: 'rgba(16,18,22,0.28)'
          }}
        >
          {/* Progress */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 800, letterSpacing: 0.4 }}>
                {currentStep + 1} of {tourSteps.length}
              </span>
              <div style={{ flex: 1, height: 6, background: PROGRESS_TRACK, borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)' }}>
                <div style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${ACCENT_START}, ${ACCENT_END})`,
                  width: `${progressPercentage}%`,
                  transition: 'width .25s ease',
                  boxShadow: '0 6px 14px rgba(231,183,104,0.35)'
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  style={{
                    width: 9, height: 9, borderRadius: '50%', border: 'none',
                    background:
                      index === currentStep
                        ? ACCENT_START
                        : index < currentStep
                          ? 'rgba(231,183,104,0.45)'
                          : 'rgba(255,255,255,0.20)',
                    cursor: 'pointer',
                    transform: index === currentStep ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform .2s ease, background .2s ease',
                    boxShadow: index === currentStep ? DOT_ACTIVE_GLOW : 'none'
                  }}
                  title={`Go to step ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button
              onClick={skipTour}
              style={{
                color: TEXT_SECONDARY,
                border: `1px solid ${PANEL_INNER_HAIRLINE}`,
                background: 'rgba(255,255,255,0.02)',
                padding: '10px 12px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
              }}
            >
              <SkipForward style={{ width: 16, height: 16 }} />
              Skip
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                style={{
                  padding: '10px 16px',
                  border: `1px solid ${PANEL_INNER_HAIRLINE}`,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  color: TEXT_PRIMARY,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentStep === 0 ? 0.55 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 40,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
                }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
                Previous
              </button>

              {!missingTarget ? (
                <button
                  onClick={nextStep}
                  style={{
                    padding: '10px 18px',
                    border: `1px solid ${ACCENT_BORDER}`,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`,
                    color: '#0f1012',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 40,
                    boxShadow: '0 14px 28px rgba(231,183,104,0.35), inset 0 1px 0 rgba(255,255,255,0.45)'
                  }}
                >
                  {currentStep === tourSteps.length - 1 ? (
                    <>
                      <Play style={{ width: 16, height: 16 }} />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight style={{ width: 16, height: 16 }} />
                    </>
                  )}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => schedule(updateHighlight)}
                    style={{
                      padding: '10px 14px',
                      border: `1px solid ${PANEL_INNER_HAIRLINE}`,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.02)',
                      color: TEXT_PRIMARY,
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 40,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
                    }}
                  >
                    <RefreshCw style={{ width: 16, height: 16 }} />
                    Retry
                  </button>
                  <button
                    onClick={nextStep}
                    style={{
                      padding: '10px 18px',
                      border: `1px solid ${ACCENT_BORDER}`,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`,
                      color: '#0f1012',
                      fontSize: 14,
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 40,
                      boxShadow: '0 14px 28px rgba(231,183,104,0.35), inset 0 1px 0 rgba(255,255,255,0.45)'
                    }}
                  >
                    Skip Step
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const HelpButton = ({ onStartTour }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onStartTour}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 64,
          height: 64,
          borderRadius: '18px',
          background: `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`,
          color: '#0f1012',
          border: `1px solid ${ACCENT_BORDER}`,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 16px 38px rgba(0,0,0,0.45), 0 8px 18px rgba(231,183,104,0.25)',
          transition: 'transform .2s ease, box-shadow .2s ease',
          zIndex: 1000
        }}
      >
        <HelpCircle style={{ width: 24, height: 24 }} />
      </button>

      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            right: 24,
            background: 'rgba(18,20,25,0.55)',
            border: `1px solid ${PANEL_BORDER}`,
            color: TEXT_PRIMARY,
            padding: '10px 12px',
            borderRadius: 12,
            fontSize: 12.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
            zIndex: 1001,
            backdropFilter: 'blur(12px) saturate(120%)',
            WebkitBackdropFilter: 'blur(12px) saturate(120%)'
          }}
        >
          Take a tour of the platform
          <div style={{ position: 'absolute', top: '100%', right: 20, border: '6px solid transparent', borderTopColor: 'rgba(18,20,25,0.55)' }} />
        </div>
      )}
    </div>
  );
};

export { HelpTour, HelpButton };
