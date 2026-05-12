(() => {
  const JLI = window.JLI = window.JLI || {};
  JLI.features = JLI.features || {};

  // Stealth mode - no custom data attributes that can be fingerprinted
  JLI.CONFIG_KEY = "jliDeclutterConfig";
  JLI.CLEANUP_DELAY_MS = 150;
  // Use minimal class name
  JLI.UI_CLASS = "jli-c";

  JLI.DEFAULT_CONFIG = {
    features: {
      cleanFeed: true,
      collapseNotifications: true
    },
    reactionFilters: {
      like: true,
      love: true,
      celebrate: true,
      support: true,
      insightful: true,
      funny: true,
      comment: false,
      repost: false
    },
    blockedEntities: []
  };

  JLI.state = {
    config: JLI.DEFAULT_CONFIG,
    currentUrl: window.location.href
  };

  JLI.getText = function getText(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  };

  JLI.isUnsafeContainer = function isUnsafeContainer(element) {
    const tagName = element?.tagName?.toLowerCase();
    return !element || ["body", "html", "main"].includes(tagName);
  };

  // Stealth hide - uses inline style instead of data attributes
  JLI.markHidden = function markHidden(element) {
    if (!element || element === document.body || element === document.documentElement) return;
    if (element.style.display === "none") return; // Already hidden
    element.style.display = "none";
    element.style.visibility = "hidden";
    element.setAttribute("hidden", ""); // Native HTML attribute
  };

  // Stealth collapse - minimal class, no data attributes
  JLI.collapseElement = function collapseElement(element, summaryText) {
    if (!element || JLI.isUnsafeContainer(element)) return;
    
    // Check if already collapsed (look for our minimal class)
    if (element.closest?.("details.jli-c")) return;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const content = document.createElement("div");

    // Minimal class name - harder to fingerprint
    details.className = "jli-c";
    summary.textContent = summaryText;

    element.parentElement?.insertBefore(details, element);
    content.append(element);
    details.append(summary, content);
  };

  JLI.findExactText = function findExactText(text) {
    return ["p", "span", "h2", "h3"].flatMap((selector) => 
      [...document.querySelectorAll(selector)].filter((element) => JLI.getText(element) === text)
    );
  };

  JLI.findFeedPostContainer = function findFeedPostContainer(element) {
    let node = element;
    let candidate = null;
    for (let depth = 0; node && depth < 18; depth += 1) {
      if (JLI.isUnsafeContainer(node)) break;
      const text = JLI.getText(node);
      const isLikely = text.includes("Feed post") || 
        Boolean(node.querySelector?.('[aria-label^="Open control menu for post by"]')) || 
        ["Like", "Comment", "Repost", "Send"].filter((label) => text.includes(label)).length >= 3;
      if (isLikely) candidate = node;
      if (node.matches?.('[role="listitem"]') && candidate) return node;
      node = node.parentElement;
    }
    return candidate;
  };

  JLI.findModuleContainer = function findModuleContainer(element) {
    let node = element;
    let best = null;
    for (let depth = 0; node && depth < 18; depth += 1) {
      if (JLI.isUnsafeContainer(node)) break;
      best = node;
      if (node.matches?.("section, aside, article")) return node;
      if ((node.querySelectorAll?.("a[href]").length || 0) >= 3 || 
          (node.querySelectorAll?.("button").length || 0) >= 2) return node;
      node = node.parentElement;
    }
    return best;
  };

  JLI.normalizeConfig = function normalizeConfig(config) {
    const features = { ...JLI.DEFAULT_CONFIG.features, ...(config?.features || {}) };
    const reactionFilters = { ...JLI.DEFAULT_CONFIG.reactionFilters, ...(config?.reactionFilters || {}) };
    const blockedEntities = config?.blockedEntities || JLI.DEFAULT_CONFIG.blockedEntities;
    
    return {
      features: Object.fromEntries(Object.keys(JLI.DEFAULT_CONFIG.features).map((key) => [key, features[key] !== false])),
      reactionFilters: Object.fromEntries(Object.keys(JLI.DEFAULT_CONFIG.reactionFilters).map((key) => [key, reactionFilters[key] !== false])),
      blockedEntities
    };
  };

  JLI.loadState = async function loadState() {
    try {
      const stored = chrome?.storage?.local ? await chrome.storage.local.get(JLI.CONFIG_KEY) : {};
      JLI.state.config = JLI.normalizeConfig(stored[JLI.CONFIG_KEY] || JLI.DEFAULT_CONFIG);
    } catch {
      JLI.state.config = JLI.DEFAULT_CONFIG;
    }
  };

  JLI.isNotificationsPage = function isNotificationsPage() {
    return window.location.pathname.startsWith("/notifications");
  };
})();
