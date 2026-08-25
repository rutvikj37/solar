/** Scroll to a section on the installer marketing landing page. */
export function scrollToMarketingSection(hash, { behavior = 'smooth' } = {}) {
  const id = String(hash || '').replace(/^#/, '');
  if (!id) return;

  const onInstallerPage = window.location.pathname === '/for-installers';
  const el = document.getElementById(id);

  if (el && onInstallerPage) {
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior });
    if (history.replaceState) {
      history.replaceState(null, '', `#${id}`);
    } else {
      window.location.hash = id;
    }
    return;
  }

  window.location.assign(`/for-installers#${id}`);
}

export function handleMarketingHashClick(event, hash) {
  if (!hash?.startsWith('#') && !hash?.includes('#')) return;
  const id = hash.includes('#') ? hash.split('#').pop() : hash.replace(/^#/, '');
  if (window.location.pathname === '/for-installers') {
    event.preventDefault();
    scrollToMarketingSection(id);
  }
}
