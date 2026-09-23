/**
 * localStorage helpers + driver.js spotlight wrapper for product onboarding.
 */
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  CHECKLIST_TASKS,
  ONBOARDING_STORAGE_KEY,
  PATH_TO_TASK,
  SPOTLIGHT_STEPS,
  defaultOnboardingState,
} from './onboardingConfig.js';

let activeDriver = null;

export function readOnboardingState() {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return defaultOnboardingState();
    const parsed = JSON.parse(raw);
    const base = defaultOnboardingState();
    return {
      tourStatus: ['pending', 'completed', 'skipped'].includes(parsed?.tourStatus)
        ? parsed.tourStatus
        : 'pending',
      tasks: { ...base.tasks, ...(parsed?.tasks && typeof parsed.tasks === 'object' ? parsed.tasks : {}) },
    };
  } catch {
    return defaultOnboardingState();
  }
}

export function writeOnboardingState(next) {
  const current = readOnboardingState();
  const merged = {
    tourStatus: next.tourStatus ?? current.tourStatus,
    tasks: { ...current.tasks, ...(next.tasks || {}) },
  };
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new CustomEvent('str:onboarding-change', { detail: merged }));
  return merged;
}

export function setTourStatus(tourStatus) {
  return writeOnboardingState({ tourStatus });
}

export function markTaskComplete(taskId) {
  if (!taskId) return readOnboardingState();
  return writeOnboardingState({ tasks: { [taskId]: true } });
}

export function markTaskFromPath(pathname) {
  const path = String(pathname || '').split('?')[0];
  const taskId = PATH_TO_TASK[path];
  if (!taskId) return readOnboardingState();
  return markTaskComplete(taskId);
}

export function checklistProgress(state = readOnboardingState()) {
  const total = CHECKLIST_TASKS.length;
  const done = CHECKLIST_TASKS.filter((t) => state.tasks?.[t.id]).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function shouldAutoStartTour(state = readOnboardingState()) {
  return state.tourStatus === 'pending';
}

export function destroyActiveTour() {
  if (activeDriver) {
    try {
      activeDriver.destroy();
    } catch {
      /* ignore */
    }
    activeDriver = null;
  }
}

/**
 * @param {{ onComplete?: () => void, onSkip?: () => void, onDismiss?: () => void }} handlers
 * onComplete — finished last step (Done)
 * onSkip — clicked Skip
 * onDismiss — Esc / overlay close without Skip or Done (does NOT change tourStatus)
 */
export function startProductTour(handlers = {}) {
  destroyActiveTour();

  const steps = SPOTLIGHT_STEPS.map((step, index) => {
    const isLast = index === SPOTLIGHT_STEPS.length - 1;
    const el = typeof document !== 'undefined' ? document.querySelector(step.element) : null;
    return {
      element: el ? step.element : undefined,
      popover: {
        title: step.title,
        description: step.description,
        side: 'right',
        align: 'start',
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: isLast ? 'Done' : 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
      },
    };
  });

  activeDriver = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.72,
    stagePadding: 8,
    stageRadius: 10,
    allowClose: true,
    smoothScroll: true,
    overlayColor: '#020617',
    popoverClass: 'str-driver-popover',
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    showButtons: ['next', 'previous', 'close'],
    steps,
    onDestroyStarted: () => {
      // Called for Esc / close click / destroy — distinguish via active index + flags
      if (!activeDriver) return;
      const isLast = activeDriver.isLastStep?.() || false;
      const hasNexted = activeDriver.getActiveIndex?.() != null;

      // If user clicked Done on last step, driver destroys after next — treat as complete
      // We set flags in onNextClick / custom close handling below.
    },
    onCloseClick: (_el, _step, { driver: d }) => {
      // Close (X) or Skip-style — mark skipped, then destroy
      setTourStatus('skipped');
      handlers.onSkip?.();
      d.destroy();
    },
    onNextClick: (_el, _step, { driver: d }) => {
      if (d.isLastStep()) {
        setTourStatus('completed');
        handlers.onComplete?.();
        d.destroy();
        return;
      }
      d.moveNext();
    },
    onPrevClick: (_el, _step, { driver: d }) => {
      d.movePrevious();
    },
    onDestroyed: () => {
      activeDriver = null;
      // Esc path: destroy without going through onCloseClick / onNextClick Done
      // If still pending, treat as dismiss (do not change status)
      const state = readOnboardingState();
      if (state.tourStatus === 'pending') {
        handlers.onDismiss?.();
      }
    },
  });

  // Relabel close button as Skip for clarity
  activeDriver.drive();

  // After DOM popover mounts, tweak close button label
  requestAnimationFrame(() => {
    const closeBtn = document.querySelector('.str-driver-popover .driver-popover-close-btn');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', 'Skip tour');
      closeBtn.title = 'Skip tour';
    }
    const footerClose = document.querySelector(
      '.str-driver-popover button.driver-popover-close-btn',
    );
    void footerClose;
  });

  return activeDriver;
}
