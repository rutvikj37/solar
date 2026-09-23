/**
 * Single source of truth for spotlight tour steps + Getting Started checklist.
 * Targets use data-tour attributes on Sidebar / Dashboard chrome.
 */

export const ONBOARDING_STORAGE_KEY = 'solarx_onboarding_v2';

/** Task ids used in localStorage.tasks */
export const TASK_IDS = {
  map: 'map',
  bulkScan: 'bulkScan',
  marketplace: 'marketplace',
  leads: 'leads',
  appointments: 'appointments',
  billing: 'billing',
};

export const CHECKLIST_TASKS = [
  {
    id: TASK_IDS.map,
    title: 'Explore Targeting map',
    body: 'Search an address, draw a lasso, and unlock high-fit homes nearby.',
    path: '/map',
    tourId: 'tour-nav-map',
  },
  {
    id: TASK_IDS.bulkScan,
    title: 'Try Bulk Scan',
    body: 'Scan an area with roof-size and panel filters to find more prospects.',
    path: '/bulk-scan',
    tourId: 'tour-nav-bulk-scan',
  },
  {
    id: TASK_IDS.marketplace,
    title: 'Browse Marketplace',
    body: 'Review qualified homeowner inquiries and place bids.',
    path: '/marketplace',
    tourId: 'tour-nav-marketplace',
  },
  {
    id: TASK_IDS.leads,
    title: 'Open Lead Manager',
    body: 'Track unlocked leads, follow-ups, notes, and quotations.',
    path: '/my-leads',
    tourId: 'tour-nav-leads',
  },
  {
    id: TASK_IDS.appointments,
    title: 'Review Appointments',
    body: 'See upcoming vs scheduled visits and survey bookings.',
    path: '/appointments',
    tourId: 'tour-nav-appointments',
  },
  {
    id: TASK_IDS.billing,
    title: 'Understand credits',
    body: 'Check remaining lead credits and plans so unlocks never surprise you.',
    path: '/billing',
    tourId: 'tour-nav-billing',
  },
];

/** Map pathname prefixes → checklist task id for auto-complete on visit */
export const PATH_TO_TASK = {
  '/map': TASK_IDS.map,
  '/bulk-scan': TASK_IDS.bulkScan,
  '/marketplace': TASK_IDS.marketplace,
  '/my-leads': TASK_IDS.leads,
  '/appointments': TASK_IDS.appointments,
  '/billing': TASK_IDS.billing,
};

/**
 * Spotlight steps. First step can be body-only (no element).
 * elementSelector is a CSS selector for [data-tour="…"].
 */
export const SPOTLIGHT_STEPS = [
  {
    id: 'welcome',
    element: '[data-tour="tour-dashboard-welcome"]',
    title: 'Welcome to SpaceToRoof',
    description:
      'A quick tour of where everything lives. We will highlight the sidebar — you stay on this page until you are ready to explore.',
  },
  {
    id: 'map',
    element: '[data-tour="tour-nav-map"]',
    title: 'Targeting map',
    description:
      'Search any address, draw a freehand or point-click lasso, then unlock high-fit homes nearby.',
  },
  {
    id: 'bulkScan',
    element: '[data-tour="tour-nav-bulk-scan"]',
    title: 'Bulk Scan',
    description:
      'Scan an area with filters: min roof size, single-family only, and skip homes that already have panels.',
  },
  {
    id: 'marketplace',
    element: '[data-tour="tour-nav-marketplace"]',
    title: 'Marketplace',
    description:
      'Bid on qualified homeowner inquiries. Contact details stay hidden until you win.',
  },
  {
    id: 'leads',
    element: '[data-tour="tour-nav-leads"]',
    title: 'Lead Manager',
    description:
      'Track unlocked leads, schedule follow-ups, log conversations, and send quotations.',
  },
  {
    id: 'appointments',
    element: '[data-tour="tour-nav-appointments"]',
    title: 'Appointments',
    description:
      'See upcoming vs scheduled visits. Booking a survey can email the homeowner a confirmation.',
  },
  {
    id: 'billing',
    element: '[data-tour="tour-nav-billing"]',
    title: 'Credits & billing',
    description:
      'Each lead unlock uses 1 credit. Check your balance and plans here anytime.',
  },
  {
    id: 'help',
    element: '[data-tour="tour-nav-help"]',
    title: 'Getting Started anytime',
    description:
      'Reopen this checklist from Help whenever you need a refresher — or replay the spotlight tour.',
  },
];

export function emptyTasks() {
  return Object.fromEntries(CHECKLIST_TASKS.map((t) => [t.id, false]));
}

export function defaultOnboardingState() {
  return {
    tourStatus: 'pending', // pending | completed | skipped
    tasks: emptyTasks(),
  };
}
