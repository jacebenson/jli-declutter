(() => {
  const JLI = window.JLI;

  const COLLAPSED_LABELS = ["Promoted", "Feed post", "Sponsored Content"];
  const RIGHT_RAIL_KEYWORDS = ["LinkedIn News", "Ad Choices", "Advertising", "LinkedIn Corporation"];
  const RIGHT_RAIL_IFRAME_SELECTOR = 'iframe[title="advertisement"]';

  const REACTION_TYPES = {
    like: { patterns: [/likes? this$/i, /like[ds] this post$/i], label: "liked" },
    love: { patterns: [/loves? this$/i, /love[sd] this post$/i], label: "loved" },
    celebrate: { patterns: [/celebrates? this$/i, /celebrate[sd] this post$/i], label: "celebrated" },
    support: { patterns: [/supports? this$/i, /support[ed] this post$/i], label: "supported" },
    insightful: { patterns: [/finds? this insightful$/i, /found this insightful$/i], label: "found insightful" },
    funny: { patterns: [/finds? this funny$/i, /found this funny$/i], label: "found funny" },
    comment: { patterns: [/commented on this$/i, /commented on this post$/i], label: "commented on" },
    repost: { patterns: [/reposted this$/i, /reposted this post$/i, /shared this$/i], label: "reposted" }
  };

  function extractTextFromElements(element, selectors) {
    const elements = element?.querySelectorAll?.(selectors) || [];
    return [...elements].map(JLI.getText);
  }

  function findFirstMeaningfulText(element, fallback) {
    const texts = extractTextFromElements(element, "p, span, h2, h3");
    const meaningful = texts.find((text) => text && !COLLAPSED_LABELS.includes(text));
    return meaningful ? `${fallback}: ${meaningful.slice(0, 90)}` : fallback;
  }

  function isRightRailContent(node) {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.left <= window.innerWidth * 0.55) return false;
    const text = JLI.getText(node);
    if (text.includes("Feed post")) return false;
    const hasNewsKeyword = RIGHT_RAIL_KEYWORDS.some((keyword) => text.includes(keyword));
    const hasAdIframe = node.querySelector?.(RIGHT_RAIL_IFRAME_SELECTOR);
    return hasNewsKeyword || hasAdIframe;
  }

  function findRightRailContainer(element) {
    let node = element;
    let candidate = null;
    for (let depth = 0; node && depth < 10; depth += 1) {
      if (JLI.isUnsafeContainer(node)) break;
      if (isRightRailContent(node)) candidate = node;
      node = node.parentElement;
    }
    return candidate || JLI.findModuleContainer(element);
  }

  function isInsideFeed(element) {
    return Boolean(
      element?.closest?.('[role="main"]') ||
      element?.closest?.('.scaffold-finite-scroll') ||
      element?.closest?.('[data-view-name="feed-page"]')
    );
  }

  function isValidPostContainer(element) {
    if (!element || JLI.isUnsafeContainer(element)) return false;
    const tagName = element.tagName?.toLowerCase();
    return tagName !== 'body' && tagName !== 'html' && tagName !== 'main';
  }

  function findElementsContainingText(searchText) {
    const feedSelectors = ['[role="main"]', '.scaffold-finite-scroll', '[data-view-name="feed-page"]'];
    const containers = feedSelectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
    const searchRoot = containers.length > 0 ? containers : [document];
    
    return searchRoot.flatMap((root) =>
      ["p", "span", "h2", "h3"].flatMap((selector) =>
        [...root.querySelectorAll(selector)].filter((element) => {
          if (!isInsideFeed(element)) return false;
          return JLI.getText(element).includes(searchText);
        })
      )
    );
  }

  function collapseByTextMatch(textToMatch, labelPrefix) {
    const elements = JLI.findExactText(textToMatch);
    elements.forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      const title = findFirstMeaningfulText(post, labelPrefix);
      JLI.collapseElement(post, title);
    });
  }

  function collapseByPartialTextMatch(textToMatch, labelPrefix) {
    const elements = findElementsContainingText(textToMatch);
    elements.forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      const title = findFirstMeaningfulText(post, labelPrefix);
      JLI.collapseElement(post, title);
    });
  }

  function hideLinkedInNews() {
    JLI.findExactText("LinkedIn News").forEach((element) => {
      if (!isInsideFeed(element)) return;
      const container = JLI.findModuleContainer(element);
      if (!isValidPostContainer(container)) return;
      JLI.markHidden(container);
    });
  }

  function hideRightRailAds() {
    const selectors = [
      'a[href*="/news/story/"]',
      'a[href*="/news/daily-rundown/"]',
      RIGHT_RAIL_IFRAME_SELECTOR
    ];
    document.querySelectorAll(selectors.join(", ")).forEach((element) => {
      const container = findRightRailContainer(element) || element;
      JLI.markHidden(container);
    });
  }

  function hidePromotedPosts() {
    findElementsContainingText("Promoted").forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      if (!isValidPostContainer(post)) return;
      const matchedText = JLI.getText(element).slice(0, 60);
      const title = findFirstMeaningfulText(post, matchedText);
      JLI.collapseElement(post, title);
    });

    JLI.findExactText("Suggested").forEach((element) => {
      if (!isInsideFeed(element)) return;
      const post = JLI.findFeedPostContainer(element);
      if (!isValidPostContainer(post)) return;
      const matchedText = JLI.getText(element).slice(0, 60);
      const title = findFirstMeaningfulText(post, matchedText);
      JLI.collapseElement(post, title);
    });
  }

  function hideSponsoredContent() {
    const sponsoredSelectors = ['[alt*="Sponsored Content"]', '[aria-label*="Sponsored Content"]'];
    document.querySelectorAll(sponsoredSelectors.join(", ")).forEach((element) => {
      if (!isInsideFeed(element)) return;
      const container = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      if (!isValidPostContainer(container)) return;
      JLI.collapseElement(container, "Sponsored");
    });
  }

  function hideJobRecommendations() {
    JLI.findExactText("Jobs recommended for you").forEach((element) => {
      if (!isInsideFeed(element)) return;
      const container = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      if (!isValidPostContainer(container)) return;
      JLI.markHidden(container);
    });
  }

  function collapseRecommendedFollows() {
    if (!window.location.pathname.startsWith("/feed")) return;

    JLI.findExactText("Recommended for you").forEach((element) => {
      if (!isInsideFeed(element)) return;
      const post = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      if (!isValidPostContainer(post)) return;
      
      const text = JLI.getText(post);
      const hasFollowButtons = post?.querySelector?.('a[href*="/in/"], button[aria-label^="Follow "]');
      const isFollowSection = text.includes("Follow") && hasFollowButtons;
      if (!isFollowSection) return;

      const followButtons = post?.querySelectorAll?.('button[aria-label^="Follow "]') || [];
      const names = [...followButtons]
        .map((button) => button.getAttribute("aria-label")?.replace(/^Follow\s+/i, "").trim())
        .filter(Boolean);

      const summary = names.length 
        ? `Recommended follows: ${names.slice(0, 3).join(", ")}` 
        : "Recommended follows: suggested profiles";
      JLI.collapseElement(post, summary);
    });
  }

  function getReactionConfig() {
    const config = JLI.state?.config?.reactionFilters || {};
    return Object.fromEntries(
      Object.entries(REACTION_TYPES).map(([type, info]) => [
        type,
        config[type] !== undefined ? config[type] : (type !== 'comment' && type !== 'repost')
      ])
    );
  }

  function getBlockedEntities() {
    return JLI.state?.config?.blockedEntities || [];
  }

  function detectReactionType(text) {
    for (const [type, info] of Object.entries(REACTION_TYPES)) {
      for (const pattern of info.patterns) {
        if (pattern.test(text)) {
          const match = text.match(new RegExp(`^(.+?)\\s+${pattern.source.replace(/\\/g, '').replace('$', '').trim()}`, 'i'));
          const entity = match ? match[1].trim() : null;
          return { type, entity, label: info.label };
        }
      }
    }
    return null;
  }

  function shouldCollapseReaction(reactionInfo) {
    const config = getReactionConfig();
    const blockedEntities = getBlockedEntities();

    if (!config[reactionInfo.type]) return false;

    if (reactionInfo.entity && blockedEntities.length > 0) {
      const entityLower = reactionInfo.entity.toLowerCase();
      const isBlocked = blockedEntities.some(
        (blocked) => entityLower.includes(blocked.toLowerCase()) || blocked.toLowerCase().includes(entityLower)
      );
      if (isBlocked) return true;
    }
    return true;
  }

  function collapseReactionPosts() {
    if (!window.location.pathname.startsWith("/feed")) return;

    const reactionConfig = getReactionConfig();
    if (!Object.values(reactionConfig).some(Boolean)) return;

    const feedSelectors = ['[role="main"]', '.scaffold-finite-scroll', '[data-view-name="feed-page"]'];
    const containers = feedSelectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
    const searchRoot = containers.length > 0 ? containers : [document];

    searchRoot.forEach((root) => {
      root.querySelectorAll('p, span, h3, h4').forEach((element) => {
        if (!isInsideFeed(element)) return;
        const text = JLI.getText(element);
        const reaction = detectReactionType(text);
        if (!reaction) return;
        if (!shouldCollapseReaction(reaction)) return;

        const post = JLI.findFeedPostContainer(element);
        if (!isValidPostContainer(post)) return;

        const summary = reaction.entity 
          ? `${reaction.entity} ${reaction.label}`
          : `Someone ${reaction.label}`;
        JLI.collapseElement(post, summary);
      });
    });
  }

  function getPostAuthor(post) {
    const labeledElements = post?.querySelectorAll?.('[aria-label]');
    if (labeledElements) {
      for (const el of labeledElements) {
        const ariaLabel = el.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/^(.+?)(?:\s+\d+(?:st|nd|rd|th)|\s+['\u2019]s\s+post|$)/i);
        if (match && match[1].length > 2 && !ariaLabel.includes('Feed post')) {
          const name = match[1].trim();
          if (!name.match(/^(1st|2nd|3rd|\+)$/)) return name;
        }
      }
    }

    const authorLink = post?.querySelector?.('a[href*="/in/"]');
    if (authorLink) {
      const textElements = authorLink.querySelectorAll('p, span, div');
      for (const el of textElements) {
        const text = JLI.getText(el);
        if (text && text.length > 2 && text.length < 150 &&
            !text.match(/^[•\s]*(1st|2nd|3rd|\+)$/) &&
            !text.match(/^( Strategic | Championing | Enthusiast |Former |CEO |Founder)/i) &&
            text.match(/[a-zA-Z]{2,}/)) {
          return text.trim();
        }
      }
    }

    const profileImages = post?.querySelectorAll?.('img[alt*="profile"]');
    if (profileImages) {
      for (const img of profileImages) {
        const alt = img.alt || '';
        const match = alt.match(/view\s+(.+?)['\u2019]s?\s+profile/i);
        if (match) return match[1].trim();
      }
    }

    const allText = post?.textContent || '';
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines.slice(0, 10)) {
      const credentialMatch = line.match(/^([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]+)+)/);
      if (credentialMatch && credentialMatch[1].length > 3) return credentialMatch[1].trim();
      const nameMatch = line.match(/^([A-Z][a-z]+\s+[A-Z][a-zA-Z\s-]+)$/);
      if (nameMatch && nameMatch[1].length > 3 && nameMatch[1].length < 100) return nameMatch[1].trim();
    }
    return null;
  }

  function normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/[,\s]+/g, '')
      .replace(/(pmp|mspm|a-csm|ssm|dasm|cipm|mba|phd|md|jd|cpa|cfp|cissp|csm|psm|spc|lpc|ccc|dac|safe|agile|scrum|master|product|owner|coach|trainer|facilitator|practitioner|professional|certified|associate|expert|fellow|senior|lead|principal|engineer|developer|manager|director|vp|ceo|cto|cfo|coo|cmo|chief|president|founder|co-founder|owner|partner|analyst|consultant|specialist|strategist|architect|designer|writer|author|speaker|influencer|entrepreneur|innovator|champion|advocate|mentor|advisor|board|member)/gi, '')
      .replace(/[^a-z]/g, '');
  }

  function isBlockedAuthor(authorName) {
    if (!authorName) return false;
    const blockedEntities = getBlockedEntities();
    if (blockedEntities.length === 0) return false;

    const normalizedAuthor = normalizeName(authorName);
    return blockedEntities.some((blocked) => {
      if (!blocked || blocked.trim().length === 0) return false;
      const normalizedBlocked = normalizeName(blocked);
      if (normalizedAuthor.includes(normalizedBlocked)) return true;
      const authorLower = authorName.toLowerCase();
      const blockedLower = blocked.toLowerCase().trim();
      if (authorLower.includes(blockedLower)) return true;
      return false;
    });
  }

  function collapsePostsByBlockedAuthors() {
    if (!window.location.pathname.startsWith("/feed")) return;
    const blockedEntities = getBlockedEntities();
    if (blockedEntities.length === 0) return;

    const feedPosts = document.querySelectorAll('[role="listitem"]:not(details.jli-c [role="listitem"])');
    feedPosts.forEach((post) => {
      if (!isInsideFeed(post)) return;
      if (!isValidPostContainer(post)) return;

      const author = getPostAuthor(post);
      if (!author) return;

      if (isBlockedAuthor(author)) {
        JLI.collapseElement(post, `Post by ${author.slice(0, 50)}`);
      }
    });
  }

  JLI.features.cleanFeed = function cleanFeed() {
    hideLinkedInNews();
    hideRightRailAds();
    hidePromotedPosts();
    hideSponsoredContent();
    hideJobRecommendations();
    collapseRecommendedFollows();
    collapseReactionPosts();
    collapsePostsByBlockedAuthors();
  };
})();
