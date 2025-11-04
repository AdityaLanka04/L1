import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, ChevronLeft, ChevronRight, HelpCircle, SkipForward, Play,
  RefreshCw, AlertTriangle
} from 'lucide-react';
import { API_URL } from '../config';

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
        title: 'Welcome to cerbyl!',
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
          'Click "CUSTOMIZE" to reorder, resize, or toggle widgets to match your flow.',
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

    const arrowColor = 'var(--tour-panel-bg-bottom)';

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
      el.style.background = 'var(--tour-blur-bg)';
      el.style.pointerEvents = 'auto';
      el.style.zIndex = 10000;
      el.style.transition = 'all .25s ease';
      el.style.boxShadow = 'inset 0 0 0 1px var(--tour-blur-border)';
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
    <div className="help-tour-overlay">
      {/* Dim base */}
      <div className="help-tour-dim" />

      {/* 4 Blur panes */}
      <div ref={blurTopRef} className="help-tour-blur-pane" />
      <div ref={blurBottomRef} className="help-tour-blur-pane" />
      <div ref={blurLeftRef} className="help-tour-blur-pane" />
      <div ref={blurRightRef} className="help-tour-blur-pane" />

      {/* Spotlight */}
      <div className="help-tour-spotlight" />

      {/* Loading / Navigating */}
      {isScrolling && (
        <div className="help-tour-loading">
          <div className="help-tour-spinner" />
          <span className="help-tour-loading-text">Navigating…</span>
        </div>
      )}

      {/* Tooltip */}
      <div ref={tooltipRef} className="help-tour-tooltip">
        {/* Arrow */}
        <div ref={arrowRef} className="help-tour-arrow" />

        {/* Header */}
        <div className="help-tour-header">
          <div className="help-tour-header-left">
            <span className="help-tour-icon">
              {currentStepData.icon ?? '•'}
            </span>
            <h3 className="help-tour-title">
              {currentStepData.title}
            </h3>
          </div>
          <button
            onClick={completeTour}
            aria-label="Close tour"
            className="help-tour-close-btn"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div className="help-tour-content">
          {!missingTarget ? (
            <p className="help-tour-description">
              {currentStepData.content}
            </p>
          ) : (
            <div className="help-tour-missing-target">
              <AlertTriangle style={{ width: 18, height: 18, flex: '0 0 auto' }} />
              <div className="help-tour-missing-text">
                <strong>Widget not found. Add it from <span className="help-tour-accent">Customize</span>, or skip ahead.</strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="help-tour-footer">
          {/* Progress */}
          <div className="help-tour-progress-section">
            <div className="help-tour-progress-info">
              <span className="help-tour-step-counter">
                {currentStep + 1} of {tourSteps.length}
              </span>
              <div className="help-tour-progress-bar">
                <div 
                  className="help-tour-progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
            <div className="help-tour-dots">
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  className={`help-tour-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                  title={`Go to step ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="help-tour-controls">
            <button
              onClick={skipTour}
              className="help-tour-skip-btn"
            >
              <SkipForward style={{ width: 16, height: 16 }} />
              Skip
            </button>

            <div className="help-tour-nav-buttons">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="help-tour-prev-btn"
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
                Previous
              </button>

              {!missingTarget ? (
                <button
                  onClick={nextStep}
                  className="help-tour-next-btn"
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
                <div className="help-tour-missing-controls">
                  <button
                    onClick={() => schedule(updateHighlight)}
                    className="help-tour-retry-btn"
                  >
                    <RefreshCw style={{ width: 16, height: 16 }} />
                    Retry
                  </button>
                  <button
                    onClick={nextStep}
                    className="help-tour-skip-step-btn"
                  >
                    Skip Step
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



const HelpButton = ({ onStartTour }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="help-button-container">
      <button
        onClick={onStartTour}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="help-button"
      >
        <HelpCircle style={{ width: 24, height: 24 }} />
      </button>

      {showTooltip && (
        <div className="help-button-tooltip">
          Take a tour of the platform
          <div className="help-button-tooltip-arrow" />
        </div>
      )}
    </div>
  );
};

export { HelpTour, HelpButton };