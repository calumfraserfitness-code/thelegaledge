// Run before deferred application scripts: public demo URLs must use real sign-in.
(() => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  Object.defineProperty(window, 'legalEdgeProduction', {value: !local, writable: false});
  if (local) return;
  const url = new URL(location.href);
  let changed = false;
  for (const name of ['workspace', 'pilot', 'onboarding']) {
    if (url.searchParams.get(name) === 'demo') {
      url.searchParams.delete(name);
      changed = true;
    }
  }
  if (changed) history.replaceState(null, '', url.pathname + url.search + url.hash);
})();
