import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CHECKLIST_TASKS } from '../../lib/onboardingConfig.js';
import {
  checklistProgress,
  destroyActiveTour,
  markTaskComplete,
  markTaskFromPath,
  readOnboardingState,
  shouldAutoStartTour,
  startProductTour,
  writeOnboardingState,
} from '../../lib/productTour.js';
import GettingStartedPanel from './GettingStartedPanel.jsx';

const OnboardingContext = createContext(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}

export function useOnboardingOptional() {
  return useContext(OnboardingContext);
}

export default function OnboardingProvider({ children, autoStartOnDashboard = true }) {
  const location = useLocation();
  const [state, setState] = useState(() => readOnboardingState());
  const [panelOpen, setPanelOpen] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);

  const refresh = useCallback(() => {
    setState(readOnboardingState());
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('str:onboarding-change', onChange);
    return () => window.removeEventListener('str:onboarding-change', onChange);
  }, [refresh]);

  useEffect(() => {
    const onOpen = () => setPanelOpen(true);
    window.addEventListener('str:open-getting-started', onOpen);
    return () => window.removeEventListener('str:open-getting-started', onOpen);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('help') === '1') {
      setPanelOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    markTaskFromPath(location.pathname);
  }, [location.pathname]);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const runTour = useCallback(
    ({ openChecklistAfter = true } = {}) => {
      if (tourRunning) return;
      setTourRunning(true);
      window.dispatchEvent(new CustomEvent('str:prepare-tour'));
      window.setTimeout(() => {
        startProductTour({
          onComplete: () => {
            setTourRunning(false);
            refresh();
            if (openChecklistAfter) setPanelOpen(true);
          },
          onSkip: () => {
            setTourRunning(false);
            refresh();
            if (openChecklistAfter) setPanelOpen(true);
          },
          onDismiss: () => {
            setTourRunning(false);
            refresh();
          },
        });
      }, 280);
    },
    [tourRunning, refresh],
  );

  useEffect(() => {
    if (!autoStartOnDashboard) return undefined;
    if (location.pathname !== '/dashboard') return undefined;
    if (!shouldAutoStartTour(readOnboardingState())) return undefined;

    const t = window.setTimeout(() => {
      if (shouldAutoStartTour(readOnboardingState()) && !tourRunning) {
        runTour({ openChecklistAfter: true });
      }
    }, 600);
    return () => window.clearTimeout(t);
    // Intentionally only on dashboard mount / path change — not when tourRunning flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartOnDashboard, location.pathname]);

  useEffect(() => () => destroyActiveTour(), []);

  const setTaskDone = useCallback(
    (taskId, done = true) => {
      if (done) {
        markTaskComplete(taskId);
      } else {
        writeOnboardingState({ tasks: { [taskId]: false } });
      }
      refresh();
    },
    [refresh],
  );

  const progress = useMemo(() => checklistProgress(state), [state]);

  const value = useMemo(
    () => ({
      state,
      progress,
      tasks: CHECKLIST_TASKS,
      panelOpen,
      tourRunning,
      openPanel,
      closePanel,
      runTour,
      setTaskDone,
      refresh,
    }),
    [state, progress, panelOpen, tourRunning, openPanel, closePanel, runTour, setTaskDone, refresh],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <GettingStartedPanel
        open={panelOpen}
        onClose={closePanel}
        state={state}
        progress={progress}
        onReplayTour={() => {
          closePanel();
          runTour({ openChecklistAfter: false });
        }}
        onToggleTask={(id, done) => setTaskDone(id, done)}
      />
    </OnboardingContext.Provider>
  );
}
