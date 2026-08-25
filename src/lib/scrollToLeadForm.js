/** Scroll to the homeowner lead form, or navigate home first if needed. */
export function scrollToLeadForm() {
  const el = document.getElementById('lead-form');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (history.replaceState) {
      history.replaceState(null, '', '#lead-form');
    } else {
      window.location.hash = 'lead-form';
    }
    return;
  }

  window.location.assign('/#lead-form');
}
