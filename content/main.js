(() => {
  const JLI = window.JLI;
  let cleanupTimer = null;

  function cleanup() {
    document.querySelectorAll(".jli-todo-nav, .jli-todo-overlay, .jli-todo-left-rail, .jli-todo-floating").forEach((element) => element.remove());

    if (JLI.state.config.features.cleanFeed) JLI.features.cleanFeed?.();
    if (JLI.state.config.features.collapseNotifications) JLI.features.notifications?.();
    if (JLI.state.config.features.trackMentions) JLI.features.mentions?.();
    if (JLI.state.config.features.trackOutreach) JLI.features.outreach?.();
    if (JLI.state.config.features.messageShortcuts) JLI.features.shortcuts?.();
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
    if (areaName !== "local") return;
    if (changes[JLI.CONFIG_KEY]) JLI.state.config = JLI.normalizeConfig(changes[JLI.CONFIG_KEY].newValue || JLI.DEFAULT_CONFIG);
    if (changes[JLI.MENTIONS_KEY]) JLI.state.items = changes[JLI.MENTIONS_KEY].newValue || {};
    scheduleCleanup();
  });

  new MutationObserver(scheduleCleanup).observe(document.documentElement, { childList: true, subtree: true });
})();
