(() => {
  const JLI = window.JLI = window.JLI || {};
  JLI.features = JLI.features || {};

  JLI.HIDDEN_ATTRIBUTE = "data-jli-hidden";
  JLI.COLLAPSED_ATTRIBUTE = "data-jli-collapsed";
  JLI.CONFIG_KEY = "jliWatcherConfig";
  JLI.MENTIONS_KEY = "jliMentionItems";
  JLI.JLI_UI_SELECTOR = ".jli-mention-controls, .jli-todo-overlay, .jli-todo-left-rail, .jli-todo-floating, .jli-todo-nav";
  JLI.CLEANUP_DELAY_MS = 150;

  JLI.DEFAULT_CONFIG = {
    features: {
      cleanFeed: true,
      collapseNotifications: true,
      trackMentions: true,
      trackOutreach: true,
      messageShortcuts: true
    },
    watchers: [{
      label: "Jace Benson",
      kind: "person",
      profileUrls: ["https://www.linkedin.com/in/jacebenson/"],
      terms: ["Jace Benson"]
    }],
    messageTemplates: [
      { label: "New connection", appliesTo: ["new-connection"], body: "Hey {{firstName}}, thanks for connecting. Great to have you in my network." },
      { label: "New follower", appliesTo: ["new-follower"], body: "Hey {{firstName}}, thanks for following. Happy to connect here." },
      { label: "Catch-up", appliesTo: ["catch-up"], body: "Hey {{firstName}}, good to see your update. Hope you're doing well." }
    ]
  };

  JLI.state = {
    config: JLI.DEFAULT_CONFIG,
    items: {},
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

  JLI.getNonJliLinks = function getNonJliLinks(element) {
    return [...element?.querySelectorAll?.("a[href]") || []].filter((link) => !JLI.isInsideJliUi(link));
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

  JLI.normalizeProfileUrl = function normalizeProfileUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const url = new URL(text, "https://www.linkedin.com");
      url.hash = "";
      url.search = "";
      return url.href.replace(/\/$/, "/");
    } catch {
      return text;
    }
  };

  JLI.cleanPersonName = function cleanPersonName(value) {
    const text = String(value || "")
      .replace(/\bStatus is offline\b/gi, "")
      .replace(/\bView profile\b/gi, "")
      .replace(/\b(?:1st|2nd|3rd)\b/gi, "")
      .trim();
    const compactNameMatch = text.match(/^([\p{Lu}][\p{L}'’-]+\s+[\p{Lu}][\p{L}'’-]+)(?=[\p{Lu}][\p{Ll}])/u);
    return (compactNameMatch?.[1] || text).replace(/\s*[|,•·-]\s*.*$/, "").replace(/\s{2,}/g, " ").trim();
  };

  JLI.getProfileLinkName = function getProfileLinkName(link) {
    const ariaLabel = link.getAttribute("aria-label") || "";
    const ariaName = ariaLabel.match(/^(?:View\s+)?(.+?)(?:'s|’s)?\s+profile(?: image)?\.?$/i)?.[1];
    const imageName = link.querySelector?.("img[alt]")?.getAttribute("alt")?.replace(/^View\s+/i, "").replace(/\s+profile(?: image)?$/i, "");
    const textName = JLI.getCleanText(link);
    return JLI.cleanPersonName(ariaName || imageName || textName);
  };

  JLI.getLinkedInRecipientId = function getLinkedInRecipientId(element) {
    const text = element?.outerHTML || element?.innerHTML || "";
    const profileUrnMatch = text.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/);
    const encodedProfileUrnMatch = text.match(/urn%3Ali%3Afsd_profile%3A([A-Za-z0-9_-]+)/i);
    const memberUrnMatch = text.match(/urn:li:member:([A-Za-z0-9_-]+)/);
    const publicIdentifierMatch = text.match(/\b(ACoA[A-Za-z0-9_-]{8,})\b/);

    return profileUrnMatch?.[1] || encodedProfileUrnMatch?.[1] || memberUrnMatch?.[1] || publicIdentifierMatch?.[1] || "";
  };

  JLI.getLinkedInComposeUrl = function getLinkedInComposeUrl(recipient, pageKey = "d_flagship3_feed") {
    if (!recipient) return "";
    const params = new URLSearchParams({
      profileUrn: `urn:li:fsd_profile:${recipient}`,
      recipient,
      interop: "msgOverlay",
      lipi: `urn:li:page:${pageKey};JLI`
    });

    return `https://www.linkedin.com/messaging/compose/?${params.toString()}`;
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

  JLI.getLocalStorage = async function getLocalStorage(keys) {
    try {
      return chrome?.storage?.local ? await chrome.storage.local.get(keys) : {};
    } catch {
      return {};
    }
  };

  JLI.setLocalStorage = async function setLocalStorage(values) {
    try {
      if (chrome?.storage?.local) await chrome.storage.local.set(values);
    } catch {
      return false;
    }
    return true;
  };

  JLI.normalizeConfig = function normalizeConfig(config) {
    const features = { ...JLI.DEFAULT_CONFIG.features, ...(config?.features || {}) };
    const watchers = Array.isArray(config?.watchers) ? config.watchers : [];
    const messageTemplates = Array.isArray(config?.messageTemplates) ? config.messageTemplates : [];

    return {
      features: Object.fromEntries(Object.keys(JLI.DEFAULT_CONFIG.features).map((key) => [key, features[key] !== false])),
      watchers: watchers.map((watcher) => ({
        label: String(watcher.label || "Untitled watcher").trim(),
        kind: ["person", "product", "company", "other"].includes(watcher.kind) ? watcher.kind : "other",
        profileUrls: [...new Set((watcher.profileUrls || []).map(JLI.normalizeProfileUrl).filter(Boolean))],
        terms: [...new Set((watcher.terms || []).map((term) => String(term).trim()).filter(Boolean))]
      })),
      messageTemplates: messageTemplates.map((template) => ({
        label: String(template.label || "Untitled template").trim(),
        appliesTo: [...new Set((template.appliesTo || []).filter((type) => ["new-connection", "new-follower", "catch-up"].includes(type)))],
        body: String(template.body || "").trim()
      })).filter((template) => template.appliesTo.length && template.body)
    };
  };

  JLI.loadState = async function loadState() {
    const stored = await JLI.getLocalStorage([JLI.CONFIG_KEY, JLI.MENTIONS_KEY]);
    JLI.state.config = JLI.normalizeConfig(stored[JLI.CONFIG_KEY] || JLI.DEFAULT_CONFIG);
    JLI.state.items = stored[JLI.MENTIONS_KEY] || {};
    await JLI.pruneReactionMentionItems();
  };

  JLI.saveTodoItem = async function saveTodoItem(item) {
    const existing = JLI.state.items[item.id] || {};
    const next = { ...existing, ...item, status: existing.status || item.status || "new", createdAt: existing.createdAt || Date.now(), updatedAt: Date.now() };
    if (JSON.stringify(existing) === JSON.stringify(next)) return existing;
    JLI.state.items[item.id] = next;
    await JLI.setLocalStorage({ [JLI.MENTIONS_KEY]: JLI.state.items });
    return next;
  };

  JLI.setTodoStatus = async function setTodoStatus(id, status) {
    if (!JLI.state.items[id]) return;
    JLI.state.items[id] = { ...JLI.state.items[id], status, updatedAt: Date.now() };
    await JLI.setLocalStorage({ [JLI.MENTIONS_KEY]: JLI.state.items });
    document.querySelectorAll(`[data-jli-mention-id="${CSS.escape(id)}"]`).forEach((element) => JLI.features.mentions?.renderStatus?.(element, JLI.state.items[id]));
  };

  JLI.pruneReactionMentionItems = async function pruneReactionMentionItems() {
    const nextItems = Object.fromEntries(Object.entries(JLI.state.items).filter(([, item]) => item?.source !== "notification" || !JLI.isReactionText?.(`${item.previewText || ""} ${item.preview || ""}`)));
    if (Object.keys(nextItems).length !== Object.keys(JLI.state.items).length) {
      JLI.state.items = nextItems;
      await JLI.setLocalStorage({ [JLI.MENTIONS_KEY]: JLI.state.items });
    }
  };

  JLI.hashString = function hashString(value) {
    let hash = 0;
    for (const char of String(value || "")) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return Math.abs(hash).toString(36);
  };

  JLI.isNotificationsPage = function isNotificationsPage() {
    return window.location.pathname.startsWith("/notifications");
  };
})();
