(() => {
  const JLI = window.JLI;
  let cleanupTimer = null;

  function cleanup() {
    if (JLI.state.config.features.cleanFeed) JLI.features.cleanFeed?.();
    if (JLI.state.config.features.collapseNotifications) JLI.features.notifications?.();
  }

  function scheduleCleanup() {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(cleanup, JLI.CLEANUP_DELAY_MS);
  }

  function watchUrlChanges() {
    window.setInterval(() => {
      if (window.location.href !== JLI.state.currentUrl) {
        JLI.state.currentUrl = window.location.href;
        scheduleCleanup();
      }
    }, 500);
  }

  JLI.loadState().then(cleanup);
  watchUrlChanges();

  chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[JLI.CONFIG_KEY]) return;
    JLI.state.config = JLI.normalizeConfig(changes[JLI.CONFIG_KEY].newValue || JLI.DEFAULT_CONFIG);
    scheduleCleanup();
  });

  new MutationObserver(scheduleCleanup).observe(document.documentElement, { childList: true, subtree: true });
})();
