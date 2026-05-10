(() => {
  const HIDDEN_ATTRIBUTE = "data-jli-hidden";
  const HIDDEN_CLASS = "jli-hidden";
  const COLLAPSED_ATTRIBUTE = "data-jli-collapsed";
  const EXPANDED_LAYOUT_CLASS = "jli-expanded-layout";
  const CLEANUP_DELAY_MS = 150;
  const MAX_ANCESTOR_DEPTH = 18;

  let cleanupTimer = null;
  let currentUrl = window.location.href;

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

  function cleanup() {
    expandMainFeedLayout();
    hideRightRail();
    hideLinkedInNews();
    hideAdIframes();
    hidePromotedPosts();
    hideSponsoredContent();
    hideJobRecommendations();
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

  cleanup();
  watchUrlChanges();

  new MutationObserver(scheduleCleanup).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
