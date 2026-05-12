(() => {
  const JLI = window.JLI = window.JLI || {};
  JLI.features = JLI.features || {};

  JLI.HIDDEN_ATTRIBUTE = "data-jli-hidden";
  JLI.COLLAPSED_ATTRIBUTE = "data-jli-collapsed";
  JLI.CONFIG_KEY = "jliDeclutterConfig";
  JLI.JLI_UI_SELECTOR = ".jli-collapsed-card";
  JLI.CLEANUP_DELAY_MS = 150;

  JLI.DEFAULT_CONFIG = {
    features: {
      cleanFeed: true,
      collapseNotifications: true
    },
    reactionFilters: {
      // Default: collapse reactions, keep comments and reposts visible
      like: true,
      love: true,
      celebrate: true,
      support: true,
      insightful: true,
      funny: true,
      comment: false,
      repost: false
    },
    blockedEntities: [] // Array of names to always collapse
  };

  JLI.state = {
    config: JLI.DEFAULT_CONFIG,
    currentUrl: window.location.href
  };

  JLI.getText = function getText(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  };

  JLI.getCleanText = function getCleanText(element) {
    const clone = element?.cloneNode?.(true);
    if (!clone) return "";
    clone.querySelectorAll?.(JLI.JLI_UI_SELECTOR).forEach((node) => node.remove());
    return JLI.getText(clone);
  };

  JLI.isInsideJliUi = function isInsideJliUi(element) {
    return Boolean(element?.matches?.(JLI.JLI_UI_SELECTOR) || element?.closest?.(JLI.JLI_UI_SELECTOR));
  };

  JLI.isUnsafeContainer = function isUnsafeContainer(element) {
    const tagName = element?.tagName?.toLowerCase();
    return !element || ["body", "html", "main"].includes(tagName);
  };

  JLI.markHidden = function markHidden(element, reason) {
    if (!element || element === document.body || element === document.documentElement || element.getAttribute(JLI.HIDDEN_ATTRIBUTE) === "true") return;
    element.setAttribute(JLI.HIDDEN_ATTRIBUTE, "true");
    element.setAttribute("data-jli-reason", reason);
    element.classList.add("jli-hidden");
  };

  JLI.collapseElement = function collapseElement(element, reason, summaryText) {
    if (!element || JLI.isUnsafeContainer(element) || element.getAttribute(JLI.COLLAPSED_ATTRIBUTE) === "true" || element.closest?.(`[${JLI.COLLAPSED_ATTRIBUTE}="true"]`)) return;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const content = document.createElement("div");

    details.className = "jli-collapsed-card";
    details.setAttribute(JLI.COLLAPSED_ATTRIBUTE, "true");
    details.setAttribute("data-jli-reason", reason);
    summary.textContent = summaryText;
    content.className = "jli-collapsed-content";

    element.parentElement?.insertBefore(details, element);
    content.append(element);
    details.append(summary, content);
  };

  JLI.findExactText = function findExactText(text) {
    return ["p", "span", "h2", "h3"].flatMap((selector) => [...document.querySelectorAll(selector)].filter((element) => JLI.getText(element) === text));
  };

  JLI.findFeedPostContainer = function findFeedPostContainer(element) {
    let node = element;
    let candidate = null;
    for (let depth = 0; node && depth < 18; depth += 1) {
      if (JLI.isUnsafeContainer(node)) break;
      const text = JLI.getText(node);
      const isLikely = text.includes("Feed post") || Boolean(node.querySelector?.('[aria-label^="Open control menu for post by"]')) || ["Like", "Comment", "Repost", "Send"].filter((label) => text.includes(label)).length >= 3;
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
      if ((node.querySelectorAll?.("a[href]").length || 0) >= 3 || (node.querySelectorAll?.("button").length || 0) >= 2) return node;
      node = node.parentElement;
    }
    return best;
  };

  JLI.normalizeConfig = function normalizeConfig(config) {
    // Merge features
    const features = { ...JLI.DEFAULT_CONFIG.features, ...(config?.features || {}) };
    
    // Merge reaction filters
    const reactionFilters = { ...JLI.DEFAULT_CONFIG.reactionFilters, ...(config?.reactionFilters || {}) };
    
    // Get blocked entities (use stored or default)
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
