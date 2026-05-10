(() => {
  const HIDDEN_ATTRIBUTE = "data-jli-hidden";
  const HIDDEN_CLASS = "jli-hidden";
  const COLLAPSED_ATTRIBUTE = "data-jli-collapsed";
  const EXPANDED_LAYOUT_CLASS = "jli-expanded-layout";
  const CONFIG_KEY = "jliWatcherConfig";
  const MENTIONS_KEY = "jliMentionItems";
  const JLI_UI_SELECTOR = ".jli-mention-controls, .jli-todo-overlay, .jli-todo-left-rail, .jli-todo-floating, .jli-todo-nav";
  const CLEANUP_DELAY_MS = 150;
  const AUTO_LOAD_MORE_DELAY_MS = 250;
  const AUTO_LOAD_MORE_THROTTLE_MS = 2500;
  const AUTO_LOAD_MORE_BOTTOM_DISTANCE_PX = 1200;
  const MAX_ANCESTOR_DEPTH = 18;

  const DEFAULT_CONFIG = {
    watchers: [
      {
        label: "Jace Benson",
        kind: "person",
        profileUrls: ["https://www.linkedin.com/in/jacebenson/"],
        terms: ["Jace Benson"]
      }
    ]
  };

  let cleanupTimer = null;
  let currentUrl = window.location.href;
  let watcherConfig = DEFAULT_CONFIG;
  let mentionItems = {};
  let autoLoadMoreTimer = null;
  let lastAutoLoadMoreAt = 0;

  const exactTextSelectors = [
    "p",
    "span",
    "h2",
    "h3"
  ];

  function markHidden(element, reason) {
    if (!element || element === document.body || element === document.documentElement) {
      return;
    }

    if (element.getAttribute(HIDDEN_ATTRIBUTE) === "true") {
      return;
    }

    element.setAttribute(HIDDEN_ATTRIBUTE, "true");
    element.setAttribute("data-jli-reason", reason);
    element.classList.add(HIDDEN_CLASS);
  }

  function collapseElement(element, reason, summaryText) {
    if (
      !element ||
      isUnsafeContainer(element) ||
      element.getAttribute(COLLAPSED_ATTRIBUTE) === "true" ||
      element.closest?.(`[${COLLAPSED_ATTRIBUTE}="true"]`)
    ) {
      return;
    }

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const content = document.createElement("div");

    details.className = "jli-collapsed-card";
    details.setAttribute(COLLAPSED_ATTRIBUTE, "true");
    details.setAttribute("data-jli-reason", reason);
    summary.textContent = summaryText;
    content.className = "jli-collapsed-content";

    element.parentElement?.insertBefore(details, element);
    content.appendChild(element);
    details.append(summary, content);
  }

  function getText(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function getCleanText(element) {
    const clone = element?.cloneNode?.(true);
    if (!clone) {
      return "";
    }

    clone.querySelectorAll?.(JLI_UI_SELECTOR).forEach((node) => node.remove());
    return getText(clone);
  }

  function isInsideJliUi(element) {
    return Boolean(element?.matches?.(JLI_UI_SELECTOR) || element?.closest?.(JLI_UI_SELECTOR));
  }

  function getNonJliLinks(element) {
    return [...element?.querySelectorAll?.("a[href]") || []].filter((link) => !isInsideJliUi(link));
  }

  function isElementVisible(element) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function hasExactText(element, text) {
    return getText(element) === text;
  }

  function isUnsafeContainer(element) {
    if (!element) {
      return true;
    }

    const tagName = element.tagName?.toLowerCase();
    return tagName === "body" || tagName === "html" || tagName === "main";
  }

  function containsMainFeedSignals(element) {
    if (!element) {
      return false;
    }

    const text = getText(element);
    return text.includes("Start a post") || text.includes("Feed post");
  }

  function countPostActionSignals(element) {
    if (!element) {
      return 0;
    }

    const text = getText(element);
    return ["Like", "Comment", "Repost", "Send"].filter((label) => text.includes(label)).length;
  }

  function isLikelyFeedPost(element) {
    if (!element) {
      return false;
    }

    const text = getText(element);
    const hasFeedPostHeading = text.includes("Feed post");
    const hasControlMenu = Boolean(element.querySelector?.('[aria-label^="Open control menu for post by"]'));
    const hasPostActions = countPostActionSignals(element) >= 3;
    const hasFeedListItem = element.matches?.('[role="listitem"]') || Boolean(element.querySelector?.('[role="listitem"]'));

    return hasFeedPostHeading || hasControlMenu || hasPostActions || hasFeedListItem;
  }

  function findFeedPostContainer(element) {
    let node = element;
    let candidate = null;

    for (let depth = 0; node && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      if (isLikelyFeedPost(node)) {
        candidate = node;
      }

      if (node.matches?.('[role="listitem"]') && candidate) {
        return node;
      }

      node = node.parentElement;
    }

    return candidate;
  }

  function getCollapsedTitle(element, fallback) {
    const visibleText = [...element.querySelectorAll?.("p, span, h2, h3") || []]
      .map(getText)
      .find((text) => text && !["Promoted", "Feed post", "Sponsored Content"].includes(text));

    return visibleText ? `${fallback}: ${visibleText.slice(0, 90)}` : fallback;
  }

  function findModuleContainer(element) {
    let node = element;
    let best = null;

    for (let depth = 0; node && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      best = node;

      if (node.matches?.("section, aside, article")) {
        return node;
      }

      const linkCount = node.querySelectorAll?.("a[href]").length || 0;
      const buttonCount = node.querySelectorAll?.("button").length || 0;

      if (linkCount >= 3 || buttonCount >= 2) {
        return node;
      }

      node = node.parentElement;
    }

    return best;
  }

  function findRightRailContainer(element) {
    let node = element;
    let candidate = null;

    for (let depth = 0; node && depth < 10; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      const rect = node.getBoundingClientRect?.();
      const isRightSide = rect && rect.left > window.innerWidth * 0.55;
      const text = getText(node);
      const hasRightRailSignals =
        text.includes("LinkedIn News") ||
        text.includes("Ad Choices") ||
        text.includes("Advertising") ||
        text.includes("LinkedIn Corporation") ||
        Boolean(node.querySelector?.('iframe[title="advertisement"]'));

      if (isRightSide && hasRightRailSignals && !containsMainFeedSignals(node)) {
        candidate = node;
      }

      node = node.parentElement;
    }

    return candidate || findModuleContainer(element);
  }

  function hideRightRail() {
    const signals = [
      ...findElementsWithExactText("LinkedIn News"),
      ...document.querySelectorAll('iframe[title="advertisement"], iframe[componentkey*="feed_ad"]')
    ];

    signals.forEach((signal) => {
      const container = findRightRailContainer(signal);
      markHidden(container || signal, "right-rail");
    });
  }

  function hideLeftRail() {
    const signals = [
      ...findElementsWithExactText("Profile viewers"),
      ...findElementsWithExactText("Post impressions"),
      ...findElementsWithExactText("Saved items"),
      ...findElementsWithExactText("Groups")
    ];

    signals.forEach((signal) => {
      const container = findLeftRailContainer(signal);
      markHidden(container || signal, "left-rail");
    });
  }

  function findLeftRailContainer(element) {
    let node = element;
    let candidate = null;

    for (let depth = 0; node && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      const rect = node.getBoundingClientRect?.();
      const text = getText(node);
      const isLeftSide = rect && rect.right < window.innerWidth * 0.45;
      const hasLeftRailSignals =
        text.includes("Profile viewers") ||
        text.includes("Post impressions") ||
        text.includes("Saved items") ||
        text.includes("Groups");

      if (isLeftSide && hasLeftRailSignals && !containsMainFeedSignals(node)) {
        candidate = node;
      }

      node = node.parentElement;
    }

    return candidate || findModuleContainer(element);
  }

  function hideLinkedInNews() {
    findElementsWithExactText("LinkedIn News").forEach((element) => {
      markHidden(findModuleContainer(element), "linkedin-news");
    });

    document.querySelectorAll('a[href*="/news/story/"], a[href*="/news/daily-rundown/"]').forEach((link) => {
      const container = findRightRailContainer(link);
      markHidden(container || link, "linkedin-news-link");
    });
  }

  function hideAdIframes() {
    document.querySelectorAll('iframe[title="advertisement"], iframe[componentkey*="feed_ad"]').forEach((iframe) => {
      const container = findRightRailContainer(iframe) || findModuleContainer(iframe);
      markHidden(container || iframe, "ad-iframe");
    });
  }

  function hidePromotedPosts() {
    findElementsWithExactText("Promoted").forEach((element) => {
      const post = findFeedPostContainer(element);
      if (post) {
        collapseElement(post, "promoted-post", getCollapsedTitle(post, "Ad"));
      }
    });
  }

  function hideSponsoredContent() {
    const sponsoredElements = document.querySelectorAll([
      '[alt*="Sponsored Content"]',
      '[aria-label*="Sponsored Content"]'
    ].join(","));

    sponsoredElements.forEach((element) => {
      const post = findFeedPostContainer(element);
      const container = post || findModuleContainer(element);
      collapseElement(container, "sponsored-content", getCollapsedTitle(container, "Ad"));
    });
  }

  function hideJobRecommendations() {
    findElementsWithExactText("Jobs recommended for you").forEach((element) => {
      const post = findFeedPostContainer(element) || findModuleContainer(element);
      markHidden(post, "job-recommendations");
    });
  }

  function expandMainFeedLayout() {
    if (!window.location.pathname.startsWith("/feed")) {
      document.documentElement.classList.remove(EXPANDED_LAYOUT_CLASS);
      return;
    }

    document.documentElement.classList.add(EXPANDED_LAYOUT_CLASS);

    const feedHeading = [...document.querySelectorAll("h2")]
      .find((heading) => getText(heading).includes("Feed post"));
    const feedPost = feedHeading ? findFeedPostContainer(feedHeading) : null;
    const feedMain = findFeedColumn(feedPost);
    const feedShell = findFeedShell(feedMain);

    feedMain?.setAttribute("data-jli-feed-main", "true");
    feedShell?.setAttribute("data-jli-feed-shell", "true");
    markFeedAncestors(feedPost);
    markFeedRoot(feedPost);
    markFeedCards();
  }

  function markFeedRoot(element) {
    let node = element;
    let root = null;

    for (let depth = 0; node && depth < 30; depth += 1) {
      if (!node || node === document.body || node === document.documentElement) {
        break;
      }

      root = node;
      node = node.parentElement;
    }

    root?.setAttribute("data-jli-feed-root", "true");
    setImportantStyle(root, {
      boxSizing: "border-box",
      display: "flex",
      justifyContent: "center",
      marginLeft: "calc(50% - 50vw)",
      marginRight: "calc(50% - 50vw)",
      maxWidth: "100vw",
      paddingInline: "16px",
      width: "100vw"
    });
  }

  function markFeedAncestors(element) {
    let node = element;

    for (let depth = 0; node && depth < 30; depth += 1) {
      if (!node || node === document.body || node === document.documentElement) {
        break;
      }

      node.setAttribute("data-jli-feed-ancestor", "true");
      setImportantStyle(node, {
        flex: "1 1 auto",
        maxWidth: "100%",
        minWidth: "0",
        width: "100%"
      });
      node = node.parentElement;
    }
  }

  function markFeedCards() {
    [...document.querySelectorAll("h2")]
      .filter((heading) => getText(heading).includes("Feed post"))
      .forEach((heading) => {
        const card = findFeedPostContainer(heading);
        widenFeedCard(card);
      });

    document.querySelectorAll('[data-jli-collapsed="true"]').forEach((details) => {
      widenFeedCard(details);
    });
  }

  function widenFeedCard(card) {
    if (!card) {
      return;
    }

    card.setAttribute("data-jli-feed-card", "true");
    setImportantStyle(card, {
      flexBasis: "var(--jli-feed-card-width)",
      marginInline: "auto",
      maxWidth: "var(--jli-feed-card-width)",
      width: "var(--jli-feed-card-width)"
    });

    card.querySelectorAll?.('div, section, article, a, figure, img, video, [style*="aspect-ratio"]').forEach((child) => {
      setImportantStyle(child, {
        maxWidth: "100%"
      });
    });

    card.querySelectorAll?.('img, video, figure, [style*="aspect-ratio"]').forEach((media) => {
      setImportantStyle(media, {
        width: "100%"
      });
    });
  }

  function setImportantStyle(element, styles) {
    if (!element) {
      return;
    }

    Object.entries(styles).forEach(([property, value]) => {
      element.style.setProperty(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value, "important");
    });
  }

  function findFeedColumn(element) {
    let node = element;
    let candidate = null;

    for (let depth = 0; node && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      const rect = node.getBoundingClientRect?.();
      const hasMultiplePosts = (node.querySelectorAll?.("h2") || [])
        .length >= 2;

      if (rect && rect.width >= 450 && rect.width <= 760 && hasMultiplePosts) {
        candidate = node;
      }

      node = node.parentElement;
    }

    return candidate;
  }

  function findFeedShell(element) {
    let node = element;
    let candidate = null;

    for (let depth = 0; node && depth < 8; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      const rect = node.getBoundingClientRect?.();
      const hasFeedColumn = Boolean(node.querySelector?.('[data-jli-feed-main="true"]')) || node === element;
      const hasSidebarSignals = getText(node).includes("Profile viewers") || getText(node).includes("LinkedIn News");

      if (rect && rect.width >= 700 && hasFeedColumn && hasSidebarSignals) {
        candidate = node;
      }

      node = node.parentElement;
    }

    return candidate;
  }

  function findElementsWithExactText(text) {
    return exactTextSelectors.flatMap((selector) => {
      return [...document.querySelectorAll(selector)].filter((element) => hasExactText(element, text));
    });
  }

  async function loadWatcherState() {
    if (!chrome?.storage?.local) {
      return;
    }

    const stored = await chrome.storage.local.get([CONFIG_KEY, MENTIONS_KEY]);
    watcherConfig = normalizeConfig(stored[CONFIG_KEY] || DEFAULT_CONFIG);
    mentionItems = stored[MENTIONS_KEY] || {};
    await pruneReactionMentionItems();
  }

  function normalizeConfig(config) {
    const watchers = Array.isArray(config?.watchers) ? config.watchers : [];

    return {
      watchers: watchers.map((watcher) => ({
        label: String(watcher.label || "Untitled watcher").trim(),
        kind: ["person", "product", "company", "other"].includes(watcher.kind) ? watcher.kind : "other",
        profileUrls: [...new Set((watcher.profileUrls || []).map(normalizeProfileUrl).filter(Boolean))],
        terms: [...new Set((watcher.terms || []).map((term) => String(term).trim()).filter(Boolean))]
      }))
    };
  }

  function normalizeProfileUrl(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }

    try {
      const url = new URL(text, "https://www.linkedin.com");
      url.hash = "";
      url.search = "";
      return url.href.replace(/\/$/, "/");
    } catch {
      return text;
    }
  }

  function findWatcherMatch(element) {
    if (!element || isInsideJliUi(element) || !watcherConfig.watchers.length) {
      return null;
    }

    for (const watcher of watcherConfig.watchers) {
      const profileMatch = findProfileUrlMatch(element, watcher);
      if (profileMatch) {
        return profileMatch;
      }

      const termMatch = findTermMatch(element, watcher);
      if (termMatch) {
        return termMatch;
      }
    }

    return null;
  }

  function findProfileUrlMatch(element, watcher) {
    for (const link of getNonJliLinks(element)) {
      const href = normalizeProfileUrl(link.href);
      const matchedValue = watcher.profileUrls.find((profileUrl) => href === profileUrl || href.startsWith(profileUrl));

      if (matchedValue) {
        return {
          watcher,
          matchType: "profile-url",
          matchedValue
        };
      }
    }

    return null;
  }

  function findTermMatch(element, watcher) {
    const text = getCleanText(element);

    for (const term of watcher.terms) {
      if (matchesTerm(text, term)) {
        return {
          watcher,
          matchType: term.trim().includes(" ") ? "exact-term" : "word-term",
          matchedValue: term
        };
      }
    }

    return null;
  }

  function matchesTerm(text, term) {
    const cleanTerm = term.trim();
    if (!cleanTerm) {
      return false;
    }

    const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = cleanTerm.includes(" ")
      ? new RegExp(escaped, "i")
      : new RegExp(`(^|\\P{L})${escaped}(?=$|\\P{L})`, "iu");

    return pattern.test(text);
  }

  function getPostActivityId(post) {
    const activityLink = [...post.querySelectorAll?.('a[href*="/feed/update/urn:li:activity:"]') || []]
      .map((link) => link.href.match(/urn:li:activity:\d+/)?.[0])
      .find(Boolean);

    return activityLink || window.location.href.match(/urn:li:activity:\d+/)?.[0] || "unknown-post";
  }

  function getCommentId(comment) {
    const componentKey = comment.getAttribute("componentkey") || comment.querySelector?.('[componentkey^="replaceableComment_urn:li:comment:"]')?.getAttribute("componentkey") || "";
    return componentKey.replace(/^replaceableComment_/, "") || "unknown-comment";
  }

  function getActorName(container) {
    const profileLink = getNonJliLinks(container)
      .filter((link) => link.href.includes("/in/"))
      .map(getProfileLinkLabel)
      .find((text) => text && !["Open", "Status is offline"].includes(text));

    return profileLink || "Unknown";
  }

  function getProfileLinkLabel(link) {
    const ariaLabel = link.getAttribute("aria-label") || "";
    const ariaName = ariaLabel.match(/^View (.+?)(?:'s|’s) profile\.?$/i)?.[1];
    const imageName = link.querySelector?.("img[alt]")?.getAttribute("alt");
    const textName = getCleanText(link).replace(/\bStatus is offline\b/gi, "").trim();

    return ariaName || imageName || textName;
  }

  function getPreviewText(container) {
    if (isNotificationCard(container)) {
      return getNotificationHeadlineText(container).slice(0, 220);
    }

    return getCleanText(container).slice(0, 220);
  }

  function isNotificationCard(element) {
    return Boolean(element?.matches?.('[data-view-name="notification-card-container"], .nt-card') || element?.querySelector?.('[data-view-name="notification-card-container"], .nt-card__headline'));
  }

  function getNotificationHeadlineText(notification) {
    const headline = notification.querySelector?.(".nt-card__headline") || notification;
    const clone = headline.cloneNode?.(true);
    if (!clone) {
      return "";
    }

    clone.querySelectorAll?.(`${JLI_UI_SELECTOR}, .visually-hidden`).forEach((node) => node.remove());

    return getText(clone)
      .replace(/\bStatus is offline\b/gi, "")
      .replace(/\bUnread notification\.\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function pruneReactionMentionItems() {
    const nextItems = Object.fromEntries(
      Object.entries(mentionItems).filter(([, item]) => !isStoredReactionNotification(item))
    );

    if (Object.keys(nextItems).length === Object.keys(mentionItems).length) {
      return;
    }

    mentionItems = nextItems;
    await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
  }

  function isStoredReactionNotification(item) {
    if (item?.source !== "notification") {
      return false;
    }

    return isReactionText(`${item.previewText || ""} ${item.preview || ""}`);
  }

  async function saveMentionItem(item) {
    const existing = mentionItems[item.id] || {};
    const nextStatus = existing.status || item.status || "new";
    const unchanged = existing.id && [
      "source",
      "status",
      "matchedWatcherLabel",
      "matchedKind",
      "matchType",
      "matchedValue",
      "actorName",
      "previewText",
      "url",
      "pageUrl"
    ].every((key) => existing[key] === (key === "status" ? nextStatus : item[key]));

    if (unchanged) {
      return existing;
    }

    const next = {
      ...existing,
      ...item,
      status: nextStatus,
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    mentionItems[item.id] = next;

    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
    }

    return next;
  }

  async function setMentionStatus(id, status) {
    const item = mentionItems[id];
    if (!item) {
      return;
    }

    mentionItems[id] = {
      ...item,
      status,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
    document.querySelectorAll(`[data-jli-mention-id="${CSS.escape(id)}"]`).forEach((element) => {
      renderMentionStatus(element, mentionItems[id]);
    });
  }

  async function clearAllMentionItems() {
    mentionItems = {};

    document.querySelectorAll(".jli-mention-controls").forEach((element) => element.remove());
    document.querySelectorAll(".jli-mention-candidate").forEach((element) => {
      element.classList.remove("jli-mention-candidate");
      element.removeAttribute("data-jli-mention-source");
    });

    await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[char]));
  }

  function detectMentionCandidates() {
    detectMentionPosts();
    detectMentionComments();
    detectMentionNotifications();
  }

  function detectMentionPosts() {
    const posts = [...document.querySelectorAll('h2')]
      .filter((heading) => getText(heading).includes("Feed post"))
      .map(findFeedPostContainer)
      .filter(Boolean);

    [...new Set(posts)].forEach((post) => {
      const match = findWatcherMatch(post);
      if (!match) {
        return;
      }

      const activityId = getPostActivityId(post);
      const id = `post:${activityId}`;
      const item = buildMentionItem({
        id,
        source: "post",
        container: post,
        match
      });

      saveMentionItem(item).then((savedItem) => injectMentionControls(post, savedItem));
    });
  }

  function detectMentionComments() {
    const comments = [...document.querySelectorAll('[componentkey^="replaceableComment_urn:li:comment:"]')]
      .filter((comment) => comment.getAttribute("componentkey")?.startsWith("replaceableComment_urn:li:comment:"));

    [...new Map(comments.map((comment) => [getCommentId(comment), comment])).values()].forEach((comment) => {
      const match = findWatcherMatch(comment);
      if (!match) {
        return;
      }

      const commentId = getCommentId(comment);
      const item = buildMentionItem({
        id: `comment:${commentId}`,
        source: "comment",
        container: comment,
        match
      });

      saveMentionItem(item).then((savedItem) => injectMentionControls(comment, savedItem));
    });
  }

  function detectMentionNotifications() {
    if (!window.location.pathname.startsWith("/notifications")) {
      return;
    }

    const candidates = [...document.querySelectorAll('[role="listitem"], li, article')]
      .filter((element) => !isInsideJliUi(element))
      .filter(hasNonJliLinkedInLink)
      .map(findNotificationContainer)
      .filter((element) => element && !isInsideJliUi(element) && hasNonJliLinkedInLink(element) && !isReactionNotification(element));

    [...new Set(candidates)].forEach((notification) => {
      const match = findWatcherMatch(notification);
      if (!match) {
        return;
      }

      const url = getNotificationUrl(notification);
      const id = getNotificationId(notification, url, match);
      const item = buildMentionItem({
        id,
        source: "notification",
        container: notification,
        match
      });
      item.url = url;

      saveMentionItem(item).then((savedItem) => injectMentionControls(notification, savedItem));
    });
  }

  function findNotificationContainer(element) {
    let node = element;
    let candidate = element;

    for (let depth = 0; node && depth < 8; depth += 1) {
      if (isUnsafeContainer(node)) {
        break;
      }

      if (node.matches?.('[role="listitem"], li, article')) {
        candidate = node;
      }

      node = node.parentElement;
    }

    return candidate;
  }

  function hasNonJliLinkedInLink(element) {
    return getNonJliLinks(element).some((link) => link.href.startsWith("https://www.linkedin.com/"));
  }

  function hideReactionNotifications() {
    if (!window.location.pathname.startsWith("/notifications")) {
      return;
    }

    [...document.querySelectorAll('[data-view-name="notification-card-container"], .nt-card, article')]
      .filter(isReactionNotification)
      .forEach((notification) => collapseElement(notification, "reaction-notification", getReactionNotificationSummary(notification)));
  }

  function collapseAnalyticsNotifications() {
    if (!window.location.pathname.startsWith("/notifications")) {
      return;
    }

    [...document.querySelectorAll('[data-view-name="notification-card-container"], .nt-card, article')]
      .filter(isAnalyticsNotification)
      .forEach((notification) => collapseElement(notification, "analytics-notification", getAnalyticsNotificationSummary(notification)));
  }

  function getReactionNotificationSummary(notification) {
    const headline = getNotificationHeadlineText(notification);
    const reactedMatch = headline.match(/^(.*?)\s+reacted to\s+(.+?)(?:\s+that mentioned you\.?|\.)?$/i);
    const likedMatch = headline.match(/^(.*?)\s+liked\s+(.+?)(?:\s+that mentioned you\.?|\.)?$/i);
    const match = reactedMatch || likedMatch;

    if (!match) {
      return headline ? `Reaction: ${headline}` : "Reaction notification";
    }

    const actorText = match[1].trim();
    const targetText = match[2].trim();
    const count = getReactionActorCount(actorText);

    return `${count} ${count === 1 ? "person" : "people"} reacted to ${targetText}`;
  }

  function getReactionActorCount(actorText) {
    const otherMatch = actorText.match(/\band\s+([\d,]+)\s+others?\b/i);
    if (otherMatch) {
      return Number(otherMatch[1].replace(/,/g, "")) + 1;
    }

    return 1;
  }

  function isReactionNotification(element) {
    return isReactionText(getNotificationHeadlineText(element));
  }

  function isAnalyticsNotification(element) {
    const text = getNotificationHeadlineText(element).toLowerCase();

    return text.includes("your post got") && (text.includes("impressions") || text.includes("profile viewers"));
  }

  function getAnalyticsNotificationSummary(notification) {
    const headline = getNotificationHeadlineText(notification);
    return headline ? `Analytics: ${headline}` : "Post analytics notification";
  }

  function isReactionText(value) {
    const text = String(value || "").toLowerCase();

    return /\b(liked|likes|reacted)\b/.test(text) || /\b\d+\s+reactions?\b/.test(text);
  }

  function getNotificationId(notification, url, match) {
    const activityId = url.match(/urn:li:activity:\d+/)?.[0];
    const watcherLabel = match.watcher.label;
    if (activityId) {
      return `notification:${activityId}:${watcherLabel}:${match.matchedValue}`;
    }

    const componentKey = notification.getAttribute("componentkey") || notification.querySelector?.("[componentkey]")?.getAttribute("componentkey");
    if (componentKey) {
      return `notification:${componentKey}:${watcherLabel}:${match.matchedValue}`;
    }

    return `notification:${hashString(`${url}:${getStableNotificationText(notification)}:${watcherLabel}:${match.matchedValue}`)}`;
  }

  function getStableNotificationText(notification) {
    return getCleanText(notification).slice(0, 220);
  }

  function buildMentionItem({ id, source, container, match }) {
    return {
      id,
      source,
      status: "new",
      matchedWatcherLabel: match.watcher.label,
      matchedKind: match.watcher.kind,
      matchType: match.matchType,
      matchedValue: match.matchedValue,
      actorName: getActorName(container),
      previewText: getPreviewText(container),
      url: getMentionUrl(container),
      pageUrl: window.location.href
    };
  }

  function getMentionUrl(container) {
    const postUrl = getNonJliLinks(container)
      .filter((link) => link.href.includes("/feed/update/urn:li:activity:"))
      .map((link) => link.href)
      .find(Boolean);

    return postUrl || window.location.href;
  }

  function getNotificationUrl(container) {
    const links = getNonJliLinks(container);
    const headlineUrl = container.querySelector?.(".nt-card__headline[href]")?.href;
    const updateUrl = links
      .filter((link) => link.href.includes("/feed/update/urn:li:activity:"))
      .map((link) => link.href)
      .find(Boolean);
    const firstLinkedInUrl = links
      .map((link) => link.href)
      .find((href) => href.startsWith("https://www.linkedin.com/"));

    return headlineUrl || updateUrl || firstLinkedInUrl || window.location.href;
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "");

    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
  }

  function injectMentionControls(container, item) {
    if (!container || container.querySelector?.(`[data-jli-mention-id="${CSS.escape(item.id)}"]`)) {
      return;
    }

    container.classList.add("jli-mention-candidate");
    container.setAttribute("data-jli-mention-source", item.source);

    const controls = document.createElement("div");
    controls.className = "jli-mention-controls";
    controls.setAttribute("data-jli-mention-id", item.id);
    controls.innerHTML = `
      <span class="jli-mention-label"></span>
      <button type="button" data-jli-status="need-reply">Need reply</button>
      <button type="button" data-jli-status="done">Done</button>
      <button type="button" data-jli-status="dismissed">Dismiss</button>
    `;

    controls.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-jli-status]");
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setMentionStatus(item.id, button.dataset.jliStatus);
    });

    renderMentionStatus(controls, item);
    container.insertBefore(controls, container.firstElementChild || null);
  }

  function renderMentionStatus(controls, item) {
    if (!controls || !item) {
      return;
    }

    controls.dataset.jliMentionStatus = item.status;
    const label = controls.querySelector(".jli-mention-label");
    if (label) {
      label.textContent = `${item.statusLabel || statusLabel(item.status)}: ${item.matchedWatcherLabel} (${item.matchType})`;
    }

    controls.querySelectorAll("button[data-jli-status]").forEach((button) => {
      button.toggleAttribute("aria-pressed", button.dataset.jliStatus === item.status);
    });
  }

  function statusLabel(status) {
    return {
      new: "Mention",
      "need-reply": "Need reply",
      done: "Done",
      dismissed: "Dismissed"
    }[status] || "Mention";
  }

  function isFeedPage() {
    return window.location.pathname === "/feed" || window.location.pathname === "/feed/";
  }

  function isNotificationsPage() {
    return window.location.pathname.startsWith("/notifications");
  }

  function distanceFromPageBottom() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const pageHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    );

    return pageHeight - (scrollTop + viewportHeight);
  }

  function findAutoLoadMoreButton() {
    const labels = isNotificationsPage() ? ["Show more results"] : ["Load more"];

    return [...document.querySelectorAll("button")]
      .filter((button) => !isInsideJliUi(button) && !button.disabled && labels.includes(getCleanText(button)))
      .find(isElementVisible) || null;
  }

  function maybeAutoLoadMore() {
    if ((!isFeedPage() && !isNotificationsPage()) || distanceFromPageBottom() > AUTO_LOAD_MORE_BOTTOM_DISTANCE_PX) {
      return;
    }

    const now = Date.now();
    if (now - lastAutoLoadMoreAt < AUTO_LOAD_MORE_THROTTLE_MS) {
      return;
    }

    const button = findAutoLoadMoreButton();
    if (!button) {
      return;
    }

    lastAutoLoadMoreAt = now;
    button.click();
  }

  function scheduleAutoLoadMore() {
    window.clearTimeout(autoLoadMoreTimer);
    autoLoadMoreTimer = window.setTimeout(maybeAutoLoadMore, AUTO_LOAD_MORE_DELAY_MS);
  }

  function cleanup() {
    removePageTodoUi();
    expandMainFeedLayout();
    hideRightRail();
    hideLinkedInNews();
    hideAdIframes();
    hidePromotedPosts();
    hideSponsoredContent();
    hideJobRecommendations();
    hideReactionNotifications();
    collapseAnalyticsNotifications();
    detectMentionCandidates();
    scheduleAutoLoadMore();
  }

  function removePageTodoUi() {
    document.querySelectorAll(".jli-todo-nav, .jli-todo-overlay, .jli-todo-left-rail, .jli-todo-floating").forEach((element) => element.remove());
  }

  function scheduleCleanup() {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(cleanup, CLEANUP_DELAY_MS);
  }

  function watchUrlChanges() {
    window.setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        scheduleCleanup();
      }
    }, 500);
  }

  loadWatcherState().then(() => cleanup());
  watchUrlChanges();
  window.addEventListener("scroll", scheduleAutoLoadMore, { passive: true });
  window.addEventListener("resize", scheduleAutoLoadMore, { passive: true });

  chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[CONFIG_KEY]) {
      watcherConfig = normalizeConfig(changes[CONFIG_KEY].newValue || DEFAULT_CONFIG);
      scheduleCleanup();
    }

    if (changes[MENTIONS_KEY]) {
      mentionItems = changes[MENTIONS_KEY].newValue || {};
      scheduleCleanup();
    }
  });

  new MutationObserver(scheduleCleanup).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
