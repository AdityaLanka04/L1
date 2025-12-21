import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import './HelpTour.css';

const HelpTour = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);

  const tourSteps = [
    {
      id: 'welcome',
      title: 'Welcome to Cerbyl!',
      content: 'Your personalized AI learning dashboard. Let me show you around.',
      target: '.greeting-card-modern',
      position: 'bottom',
    },
    {
      id: 'stats',
      title: 'Learning Stats',
      content: 'Track your progress with questions, flashcards, notes, and AI sessions.',
      target: '.stats-overview-widget',
      position: 'right',
    },
    {
      id: 'ai-assistant',
      title: 'AI Assistant',
      content: 'Your personal AI tutor. Click to start a learning session.',
      target: '.ai-assistant-card',
      position: 'left',
    },
    {
      id: 'quick-actions',
      title: 'Quick Actions',
      content: 'Fast access to flashcards, notes, quizzes, and more.',
      target: '.quick-actions-modern',
      position: 'left',
    },
    {
      id: 'heatmap',
      title: 'Activity Heatmap',
      content: 'See your learning consistency over the past year.',
      target: '.activity-heatmap',
      position: 'top',
    },
    {
      id: 'customize',
      title: 'Customize Dashboard',
      content: 'Rearrange and toggle widgets to match your workflow.',
      target: '.customize-btn',
      position: 'bottom',
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setCurrentStep(0);
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isVisible) return;
    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    return () => window.removeEventListener('resize', positionTooltip);
  }, [isVisible, currentStep]);

  const positionTooltip = () => {
    const step = tourSteps[currentStep];
    const target = document.querySelector(step.target);
    const tooltip = tooltipRef.current;
    
    if (!tooltip) return;

    if (!target) {
      // Center tooltip if target not found
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 20;

    let top, left;

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipRect.height - padding;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.right + padding;
        break;
      default:
        top = rect.bottom + padding;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
    }

    // Keep tooltip in viewport
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.transform = 'none';

    // Scroll target into view if needed
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = () => {
    setIsVisible(false);
    onComplete?.();
    onClose?.();
  };

  const skipTour = () => {
    setIsVisible(false);
    onComplete?.(); // Mark tour as completed even when skipped
    onClose?.();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const target = document.querySelector(step.target);

  return (
    <div className="help-tour-overlay">
      <div className="help-tour-backdrop" onClick={skipTour} />
      
      {target && (
        <div 
          className="help-tour-spotlight"
          style={{
            top: target.getBoundingClientRect().top - 8,
            left: target.getBoundingClientRect().left - 8,
            width: target.getBoundingClientRect().width + 16,
            height: target.getBoundingClientRect().height + 16,
          }}
        />
      )}

      <div ref={tooltipRef} className="help-tour-tooltip">
        <div className="help-tour-header">
          <div className="help-tour-step-indicator">
            {currentStep + 1} / {tourSteps.length}
          </div>
          <button className="help-tour-close" onClick={skipTour}>
            <X size={18} />
          </button>
        </div>

        <div className="help-tour-content">
          <h3 className="help-tour-title">{step.title}</h3>
          <p className="help-tour-description">{step.content}</p>
          
          {!target && (
            <p className="help-tour-missing">
              Widget not visible. It may be disabled in customization.
            </p>
          )}
        </div>

        <div className="help-tour-footer">
          <button className="help-tour-skip" onClick={skipTour}>
            Skip Tour
          </button>
          
          <div className="help-tour-nav">
            <button 
              className="help-tour-prev" 
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button className="help-tour-next" onClick={nextStep}>
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
              {currentStep < tourSteps.length - 1 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        <div className="help-tour-progress">
          {tourSteps.map((_, index) => (
            <div 
              key={index}
              className={`help-tour-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const HelpButton = ({ onStartTour }) => {
  return (
    <button className="help-button" onClick={onStartTour} title="Take a tour">
      <HelpCircle size={24} />
    </button>
  );
};

export { HelpTour, HelpButton };
