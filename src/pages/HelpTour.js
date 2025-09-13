import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle, SkipForward, Play } from 'lucide-react';

const HelpTour = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const tooltipRef = useRef(null);
  const arrowRef = useRef(null);

  // Blur panes (frame around the target hole)
  const blurTopRef = useRef(null);
  const blurBottomRef = useRef(null);
  const blurLeftRef = useRef(null);
  const blurRightRef = useRef(null);

  const tourSteps = [
    { id: 'welcome', title: 'Welcome to Brainwave!', content: 'Let me show you around your personalized learning dashboard. This interactive tour will help you discover the features that make studying faster and more effective.', target: '.welcome-section', position: 'bottom' },
    { id: 'ai-assistant', title: 'AI Learning Assistant', content: 'Start a session with your personal AI tutor—ask doubts, get examples, and clarify concepts in seconds.', target: '.ai-assistant-card', position: 'right' },
    { id: 'quick-actions', title: 'Quick Actions', content: 'Jump to flashcards, notes, and other essentials instantly.', target: '.quick-actions', position: 'right'},
    { id: 'learning-stats', title: 'Learning Statistics', content: 'Track streaks, questions answered, time studied, and AI sessions. Use this to keep your momentum strong.', target: '.stats-overview-widget', position: 'left'},
    { id: 'daily-goal', title: 'Daily Goals', content: 'Set your target and watch the ring fill as you learn. Small daily wins compound fast.', target: '.daily-goal-widget', position: 'left'},
    { id: 'learning-reviews', title: 'Learning Reviews', content: 'Auto-generated quizzes from your chats. Create new reviews or continue where you left off.', target: '.learning-review-widget', position: 'left'},
    { id: 'recent-activity', title: 'Recent Activity', content: 'A quick feed of your latest study actions and scores.', target: '.recent-activity-widget', position: 'left' },
    { id: 'activity-heatmap', title: 'Activity Heatmap', content: 'See your yearly consistency. Darker means more study that day—aim for streaks.', target: '.activity-heatmap', position: 'top' },
    { id: 'customization', title: 'Dashboard Customization', content: 'Click “CUSTOMIZE” to reorder, resize, or toggle widgets to match your flow.', target: '.customize-btn', position: 'bottom' },
    { id: 'profile', title: 'Profile & Settings', content: 'Tune preferences and manage your account here.', target: '.profile-btn', position: 'bottom'}
  ];

  // Open/close (no body scroll lock)
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setCurrentStep(0);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Reposition on step change/visibility/resize
  useEffect(() => {
    if (isVisible && currentStep < tourSteps.length) updateHighlight();
    const onResize = () => isVisible && updateHighlight();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isVisible]);

  // ---------- Scroll helpers ----------
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

  const waitForScrollEnd = (node) =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const target = node === window ? window : node;
      if ('onscrollend' in window) {
        const handler = () => { target.removeEventListener('scrollend', handler); finish(); };
        target.addEventListener('scrollend', handler, { once: true });
        setTimeout(finish, 800);
      } else {
        let last = node === window ? window.scrollY : node.scrollTop;
        let still = 0;
        const tick = () => {
          const cur = node === window ? window.scrollY : node.scrollTop;
          still = Math.abs(cur - last) < 1 ? still + 1 : 0;
          last = cur;
          if (still >= 6) finish(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(finish, 900);
      }
    });

  const centerIntoView = async (element, offsetTop = 0) => {
    const parent = getScrollableParent(element);
    setIsScrolling(true);

    if (parent === window) {
      const rect = element.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - (window.innerHeight / 2 - rect.height / 2) - offsetTop;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      await waitForScrollEnd(window);
    } else {
      const parentRect = parent.getBoundingClientRect();
      const elRect = element.getBoundingClientRect();
      const current = parent.scrollTop;
      const target = current + (elRect.top - parentRect.top) - (parent.clientHeight / 2 - elRect.height / 2) - offsetTop;
      parent.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      await waitForScrollEnd(parent);
    }

    setIsScrolling(false);
  };

  const scrollToElement = (element) => centerIntoView(element, 0);

  // ---------- Placement that avoids covering target ----------
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

    arrow.style.borderWidth = '';
    arrow.style.top = '';
    arrow.style.left = '';
    arrow.style.right = '';
    arrow.style.bottom = '';

    if (side === 'top') {
      arrow.style.borderWidth = `${size}px ${size}px 0 ${size}px`;
      arrow.style.borderColor = `#ffffff transparent transparent transparent`;
      arrow.style.bottom = `-${size}px`;
      arrow.style.left = `${Math.min(tooltipRect.width - 24, Math.max(24, rect.left + rect.width / 2 - left)) - size}px`;
    } else if (side === 'bottom') {
      arrow.style.borderWidth = `0 ${size}px ${size}px ${size}px`;
      arrow.style.borderColor = `transparent transparent #ffffff transparent`;
      arrow.style.top = `-${size}px`;
      arrow.style.left = `${Math.min(tooltipRect.width - 24, Math.max(24, rect.left + rect.width / 2 - left)) - size}px`;
    } else if (side === 'left') {
      arrow.style.borderWidth = `${size}px 0 ${size}px ${size}px`;
      arrow.style.borderColor = `transparent transparent transparent #ffffff`;
      arrow.style.right = `-${size}px`;
      arrow.style.top = `${Math.min(tooltipRect.height - 24, Math.max(24, rect.top + rect.height / 2 - top)) - size}px`;
    } else if (side === 'right') {
      arrow.style.borderWidth = `${size}px ${size}px ${size}px 0`;
      arrow.style.borderColor = `transparent #ffffff transparent transparent`;
      arrow.style.left = `-${size}px`;
      arrow.style.top = `${Math.min(tooltipRect.height - 24, Math.max(24, rect.top + rect.height / 2 - top)) - size}px`;
    }
  };

  // ---------- Spotlight, blur panes & tooltip ----------
  const updateHighlight = async () => {
    const currentStepData = tourSteps[currentStep];
    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement || !tooltipRef.current) return;

    await scrollToElement(targetElement); // center first

    const padding = 14;          // hole padding around target
    const radius = 14;           // rounded corner radius
    const rect = targetElement.getBoundingClientRect();
    const hole = {
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      right: Math.min(window.innerWidth, rect.right + padding),
      bottom: Math.min(window.innerHeight, rect.bottom + padding)
    };

    // Spotlight glow box (sits exactly on the hole with extra glow)
    const spotlight = document.querySelector('.help-tour-spotlight');
    if (spotlight) {
      spotlight.style.top = `${hole.top}px`;
      spotlight.style.left = `${hole.left}px`;
      spotlight.style.width = `${hole.width}px`;
      spotlight.style.height = `${hole.height}px`;
      spotlight.style.borderRadius = `${radius}px`;
    }

    // Blur panes: position four rectangles around the hole
    const commonBlurStyle = (el) => {
      el.style.position = 'absolute';
      el.style.backdropFilter = 'blur(7px)';
      el.style.WebkitBackdropFilter = 'blur(7px)';
      el.style.background = 'rgba(10,10,12,0.35)';
      el.style.pointerEvents = 'auto';
      el.style.zIndex = 10000; // below tooltip (10002) but above page
      el.style.transition = 'all .25s ease';
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
      leftPane.style.borderTopLeftRadius = '0px';
      leftPane.style.borderBottomLeftRadius = '0px';
    }
    if (rightPane) {
      rightPane.style.top = `${hole.top}px`;
      rightPane.style.left = `${hole.right}px`;
      rightPane.style.width = `${Math.max(0, window.innerWidth - hole.right)}px`;
      rightPane.style.height = `${hole.height}px`;
      rightPane.style.borderTopRightRadius = '0px';
      rightPane.style.borderBottomRightRadius = '0px';
    }

    // Tooltip placement (smart to avoid covering the widget)
    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const { side, top, left } = placeTooltipSmart(rect, currentStepData.position, tooltipRect);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'scale(1) translateY(0)';
    tooltip.setAttribute('data-side', side);

    // arrow
    positionArrow(side, rect, tooltipRect, top, left);
  };

  // ---------- Controls ----------
  const nextStep = () => (currentStep < tourSteps.length - 1 ? setCurrentStep((s) => s + 1) : completeTour());
  const prevStep = () => currentStep > 0 && setCurrentStep((s) => s - 1);
  const skipTour = () => completeTour();
  const completeTour = () => {
    setIsVisible(false);
    localStorage.setItem('hasCompletedTour', 'true');
    onComplete && onComplete();
    onClose && onClose();
  };
  const goToStep = (i) => setCurrentStep(i);

  if (!isVisible) return null;

  const currentStepData = tourSteps[currentStep];
  const progressPercentage = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      {/* Dim base (very subtle) to help the blur feel rich */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,8,10,0.25)', pointerEvents: 'auto' }} />

      {/* 4 Blur panes forming a hole */}
      <div ref={blurTopRef} />
      <div ref={blurBottomRef} />
      <div ref={blurLeftRef} />
      <div ref={blurRightRef} />

      {/* Spotlight ring on the hole to make target pop */}
      <div
        className="help-tour-spotlight"
        style={{
          position: 'absolute',
          background: 'transparent',
          border: '3px solid #E5C49E',
          borderRadius: '14px',
          boxShadow: '0 0 0 10px rgba(229,196,158,0.15), 0 14px 38px rgba(229,196,158,0.45)',
          outline: '2px solid rgba(229,196,158,0.15)',
          transition: 'all 0.28s ease',
          pointerEvents: 'none',
          zIndex: 10001
        }}
      />

      {/* Loading */}
      {isScrolling && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.98)',
            padding: '16px 22px',
            borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10003,
            pointerEvents: 'auto'
          }}
        >
          <div style={{ width: 18, height: 18, border: '2px solid #e6e6e6', borderTop: '2px solid #D7B38C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontWeight: 600, color: '#333' }}>Navigating…</span>
        </div>
      )}

      {/* Tooltip (glassy, with arrow) */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,248,248,0.96))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 18,
          boxShadow: '0 30px 60px rgba(0,0,0,0.22)',
          maxWidth: 420,
          minWidth: 320,
          zIndex: 10002,
          pointerEvents: 'auto',
          opacity: 0,
          transform: 'scale(0.96) translateY(8px)',
          transition: 'opacity .25s ease, transform .25s ease',
          overflow: 'hidden'
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
            filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.15))'
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 8px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22, display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #D7B38C, #c19a6b)', color: '#fff' }}>
              {currentStepData.icon}
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#171717', margin: 0, lineHeight: 1.2 }}>
              {currentStepData.title}
            </h3>
          </div>
          <button
            onClick={completeTour}
            aria-label="Close tour"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 10,
              color: '#5f5f5f',
              transition: 'background .2s ease',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '10px 20px 4px 20px' }}>
          <p style={{ margin: 0, color: '#3c3c3c', lineHeight: 1.6, fontSize: 15 }}>
            {currentStepData.content}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 18px 18px 18px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            background: 'linear-gradient(180deg, #fbfbfb, #f6f6f6)'
          }}
        >
          {/* Progress */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#6b6b6b', fontWeight: 700, letterSpacing: 0.2 }}>
                Step {currentStep + 1} / {tourSteps.length}
              </span>
              <div style={{ flex: 1, height: 6, background: '#ececec', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #D7B38C, #c19a6b)', width: `${progressPercentage}%`, transition: 'width .25s ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  style={{
                    width: 9, height: 9, borderRadius: '50%', border: 'none',
                    background: index === currentStep ? '#D7B38C' : index < currentStep ? '#e3cdb2' : '#d8d8d8',
                    cursor: 'pointer', transform: index === currentStep ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform .2s ease, background .2s ease',
                    boxShadow: index === currentStep ? '0 0 0 3px rgba(215,179,140,0.28)' : 'none'
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
                color: '#6b6b6b',
                border: '2px solid transparent',
                background: 'transparent',
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
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
                  border: '1px solid #e4e4e4',
                  borderRadius: 12,
                  background: '#fff',
                  color: '#2c2c2c',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentStep === 0 ? 0.55 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 40,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
                Previous
              </button>

              <button
                onClick={nextStep}
                style={{
                  padding: '10px 18px',
                  border: '1px solid #D7B38C',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #D7B38C, #c19a6b)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 40,
                  boxShadow: '0 6px 16px rgba(215,179,140,0.38)'
                }}
              >
                {currentStep === tourSteps.length - 1 ? (
                  <>
                    <Play style={{ width: 16, height: 16 }} />
                    Start Learning
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
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
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #D7B38C, #c19a6b)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 10px 26px rgba(215,179,140,0.45)',
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
            background: '#1f1f1f',
            color: 'white',
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
            zIndex: 1001
          }}
        >
          Take a tour of the platform
          <div style={{ position: 'absolute', top: '100%', right: 20, border: '6px solid transparent', borderTopColor: '#1f1f1f' }} />
        </div>
      )}
    </div>
  );
};

export { HelpTour, HelpButton };
