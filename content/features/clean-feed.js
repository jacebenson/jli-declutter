(() => {
  const JLI = window.JLI;

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  
  const COLLAPSED_LABELS = ["Promoted", "Feed post", "Sponsored Content"];
  const RIGHT_RAIL_KEYWORDS = ["LinkedIn News", "Ad Choices", "Advertising", "LinkedIn Corporation"];
  const RIGHT_RAIL_IFRAME_SELECTOR = 'iframe[title="advertisement"]';
  const RIGHT_RAIL_IFRAME_KEYWORD = 'iframe[componentkey*="feed_ad"]';

  // Reaction types we can detect and filter
  // Each has patterns like "Name likes this", "Name commented on this"
  const REACTION_TYPES = {
    like: {
      patterns: [/likes? this$/i, /like[ds] this post$/i],
      defaultCollapse: true,
      label: "liked"
    },
    love: {
      patterns: [/loves? this$/i, /love[sd] this post$/i],
      defaultCollapse: true,
      label: "loved"
    },
    celebrate: {
      patterns: [/celebrates? this$/i, /celebrate[sd] this post$/i],
      defaultCollapse: true,
      label: "celebrated"
    },
    support: {
      patterns: [/supports? this$/i, /support[ed] this post$/i],
      defaultCollapse: true,
      label: "supported"
    },
    insightful: {
      patterns: [/finds? this insightful$/i, /found this insightful$/i],
      defaultCollapse: true,
      label: "found insightful"
    },
    funny: {
      patterns: [/finds? this funny$/i, /found this funny$/i],
      defaultCollapse: true,
      label: "found funny"
    },
    comment: {
      patterns: [/commented on this$/i, /commented on this post$/i],
      defaultCollapse: false, // User wants to see comments
      label: "commented on"
    },
    repost: {
      patterns: [/reposted this$/i, /reposted this post$/i, /shared this$/i],
      defaultCollapse: false, // User wants to see reposts
      label: "reposted"
    }
  };

  // ============================================================================
  // TEXT EXTRACTION HELPERS
  // ============================================================================
  
  function extractTextFromElements(element, selectors) {
    const elements = element?.querySelectorAll?.(selectors) || [];
    return [...elements].map(JLI.getText);
  }

  function findFirstMeaningfulText(element, fallback) {
    const texts = extractTextFromElements(element, "p, span, h2, h3");
    const meaningful = texts.find((text) => text && !COLLAPSED_LABELS.includes(text));
    return meaningful ? `${fallback}: ${meaningful.slice(0, 90)}` : fallback;
  }

  // ============================================================================
  // CONTAINER FINDERS
  // ============================================================================
  
  function isRightRailContent(node) {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.left <= window.innerWidth * 0.55) {
      return false;
    }

    const text = JLI.getText(node);
    if (text.includes("Feed post")) {
      return false;
    }

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

  // ============================================================================
  // TEXT FINDING HELPERS
  // ============================================================================
  
  function isInsideFeed(element) {
    // Check if element is within the main feed area, not header/nav
    return Boolean(
      element?.closest?.('[role="main"]') ||
      element?.closest?.('.scaffold-finite-scroll') ||
      element?.closest?.('[data-view-name="feed-page"]')
    );
  }

  function isValidPostContainer(element) {
    // Ensure we're not about to collapse the entire page
    if (!element || JLI.isUnsafeContainer(element)) return false;
    const tagName = element.tagName?.toLowerCase();
    return tagName !== 'body' && tagName !== 'html' && tagName !== 'main';
  }
  
  function findElementsContainingText(searchText) {
    // Only search within feed-related containers, not the entire page
    const feedSelectors = [
      '[role="main"]',
      '.scaffold-finite-scroll',
      '[data-view-name="feed-page"]'
    ];
    
    const containers = feedSelectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
    
    // If no feed containers found, fall back to document but be more restrictive
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

  // ============================================================================
  // COLLAPSE HELPERS
  // ============================================================================
  
  function collapseByTextMatch(textToMatch, collapseType, labelPrefix) {
    const elements = JLI.findExactText(textToMatch);
    
    elements.forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      const title = findFirstMeaningfulText(post, labelPrefix);
      JLI.collapseElement(post, collapseType, title);
    });
  }

  function collapseByPartialTextMatch(textToMatch, collapseType, labelPrefix) {
    const elements = findElementsContainingText(textToMatch);
    
    elements.forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      const title = findFirstMeaningfulText(post, labelPrefix);
      JLI.collapseElement(post, collapseType, title);
    });
  }

  function collapseByAttributeSelector(selector, collapseType, labelPrefix) {
    document.querySelectorAll(selector).forEach((element) => {
      if (!isInsideFeed(element)) return;
      
      const container = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      if (!isValidPostContainer(container)) return;
      
      const title = findFirstMeaningfulText(container, labelPrefix);
      JLI.collapseElement(container, collapseType, title);
    });
  }

  // ============================================================================
  // SPECIFIC FEATURE HANDLERS
  // ============================================================================
  
  function hideLinkedInNews() {
    JLI.findExactText("LinkedIn News").forEach((element) => {
      if (!isInsideFeed(element)) return;

      const container = JLI.findModuleContainer(element);
      if (!isValidPostContainer(container)) return;

      JLI.markHidden(container, "linkedin-news");
    });
  }

  function hideRightRailAds() {
    const selectors = [
      'a[href*="/news/story/"]',
      'a[href*="/news/daily-rundown/"]',
      RIGHT_RAIL_IFRAME_SELECTOR,
      RIGHT_RAIL_IFRAME_KEYWORD
    ];

    document.querySelectorAll(selectors.join(", ")).forEach((element) => {
      const container = findRightRailContainer(element) || element;
      JLI.markHidden(container, "right-rail");
    });
  }

  function hidePromotedPosts() {
    // Handle "Promoted" posts (including variations like "Promoted • Partnership")
    // Use partial matching since LinkedIn adds separators like "•"
    findElementsContainingText("Promoted").forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      if (!isValidPostContainer(post)) return;
      
      const matchedText = JLI.getText(element).slice(0, 60);
      const title = findFirstMeaningfulText(post, matchedText);
      JLI.collapseElement(post, "promoted-post", title);
    });

    // Handle "Suggested" posts (use exact match as this is cleaner)
    JLI.findExactText("Suggested").forEach((element) => {
      if (!isInsideFeed(element)) return;
      
      const post = JLI.findFeedPostContainer(element);
      if (!isValidPostContainer(post)) return;
      
      const matchedText = JLI.getText(element).slice(0, 60);
      const title = findFirstMeaningfulText(post, matchedText);
      JLI.collapseElement(post, "suggested-post", title);
    });
  }

  function hideSponsoredContent() {
    const sponsoredSelectors = [
      '[alt*="Sponsored Content"]',
      '[aria-label*="Sponsored Content"]'
    ];

    collapseByAttributeSelector(sponsoredSelectors.join(", "), "sponsored-content", "Ad");
  }

  function hideJobRecommendations() {
    JLI.findExactText("Jobs recommended for you").forEach((element) => {
      if (!isInsideFeed(element)) return;
      
      const container = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      if (!isValidPostContainer(container)) return;
      
      JLI.markHidden(container, "job-recommendations");
    });
  }

  function collapseRecommendedFollows() {
    if (!window.location.pathname.startsWith("/feed")) return;

    JLI.findExactText("Recommended for you").forEach((element) => {
      if (!isInsideFeed(element)) return;
      
      const post = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      if (!isValidPostContainer(post)) return;
      
      const text = JLI.getCleanText(post);
      
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
        
      JLI.collapseElement(post, "recommended-follows", summary);
    });
  }

  // ============================================================================
  // REACTION FILTERING
  // ============================================================================

  function getReactionConfig() {
    // Get user's reaction filter preferences from config
    // Returns object with reaction types as keys and boolean (should collapse) as values
    const config = JLI.state?.config?.reactionFilters || {};
    
    return Object.fromEntries(
      Object.entries(REACTION_TYPES).map(([type, info]) => [
        type,
        config[type] !== undefined ? config[type] : info.defaultCollapse
      ])
    );
  }

  function getBlockedEntities() {
    // Get list of people/brands user wants to block
    return JLI.state?.config?.blockedEntities || [];
  }

  function detectReactionType(text) {
    // Check if text matches any reaction pattern
    // Returns { type: string, entity: string } or null
    for (const [type, info] of Object.entries(REACTION_TYPES)) {
      for (const pattern of info.patterns) {
        if (pattern.test(text)) {
          // Extract the entity name (text before the pattern)
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

    // Check if this reaction type is configured to be collapsed
    if (!config[reactionInfo.type]) {
      return false;
    }

    // Check if the entity is blocked
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
    const anyReactionsEnabled = Object.values(reactionConfig).some(Boolean);
    if (!anyReactionsEnabled) return; // Skip if no reaction filtering enabled

    // Find all potential reaction indicators in the feed
    const feedSelectors = ['[role="main"]', '.scaffold-finite-scroll', '[data-view-name="feed-page"]'];
    const containers = feedSelectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
    const searchRoot = containers.length > 0 ? containers : [document];

    searchRoot.forEach((root) => {
      // Look for spans/p elements that might contain reaction text
      root.querySelectorAll('p, span, h3, h4').forEach((element) => {
        if (!isInsideFeed(element)) return;

        const text = JLI.getText(element);
        const reaction = detectReactionType(text);

        if (!reaction) return;
        if (!shouldCollapseReaction(reaction)) return;

        const post = JLI.findFeedPostContainer(element);
        if (!isValidPostContainer(post)) return;

        // Build the summary
        const summary = reaction.entity 
          ? `${reaction.entity} ${reaction.label}`
          : `Someone ${reaction.label}`;

        JLI.collapseElement(post, `reaction-${reaction.type}`, summary);
      });
    });
  }

  // ============================================================================
  // BLOCK POSTS BY AUTHOR
  // ============================================================================

  function getPostAuthor(post) {
    // Try to find the author name from the post
    // LinkedIn puts the author name in various places
    
    // Method 1: Look for aria-label on the post container
    const ariaLabel = post?.getAttribute?.('aria-label') || '';
    if (ariaLabel && !ariaLabel.includes('Feed post')) {
      // aria-label often contains "Post by [Author Name]"
      const match = ariaLabel.match(/post by\s+(.+?)(?:\s+\d|$)/i);
      if (match) return match[1].trim();
    }

    // Method 2: Look for the main author link/heading
    const authorSelectors = [
      'a[href*="/in/"] span[class*="_0a297d86"]',  // Name in profile link
      'a[href*="/in/"] .update-components-actor__name', // Alternative class
      '[class*="actor__name"]',
      'h2 span[class*="_0a297d86"]',
      '.feed-shared-actor__name'
    ];

    for (const selector of authorSelectors) {
      const el = post?.querySelector?.(selector);
      if (el) {
        const text = JLI.getText(el);
        if (text && text.length > 0 && text.length < 100) {
          return text.trim();
        }
      }
    }

    // Method 3: Look at the first link to a profile
    const profileLink = post?.querySelector?.('a[href*="/in/"]');
    if (profileLink) {
      // Check for aria-label on the link
      const linkLabel = profileLink.getAttribute('aria-label');
      if (linkLabel) {
        // Often "View [Name]'s profile"
        const match = linkLabel.match(/view\s+(.+?)['\u2019]s?\s+profile/i);
        if (match) return match[1].trim();
      }

      // Check for img alt text
      const img = profileLink.querySelector('img');
      if (img?.alt) {
        const match = img.alt.match(/view\s+(.+?)['\u2019]s?\s+profile/i);
        if (match) return match[1].trim();
      }
    }

    return null;
  }

  function isBlockedAuthor(authorName) {
    if (!authorName) return false;
    
    const blockedEntities = getBlockedEntities();
    if (blockedEntities.length === 0) return false;

    const authorLower = authorName.toLowerCase();
    
    return blockedEntities.some((blocked) => {
      const blockedLower = blocked.toLowerCase().trim();
      // Check if blocked name is contained in author name OR author name contains blocked
      return authorLower.includes(blockedLower) || blockedLower.includes(authorLower);
    });
  }

  function collapsePostsByBlockedAuthors() {
    if (!window.location.pathname.startsWith("/feed")) return;

    const blockedEntities = getBlockedEntities();
    if (blockedEntities.length === 0) return;

    // Find all feed post containers
    const feedPosts = document.querySelectorAll('[role="listitem"]');
    
    feedPosts.forEach((post) => {
      if (!isInsideFeed(post)) return;
      if (!isValidPostContainer(post)) return;
      if (post.hasAttribute('data-jli-author-checked')) return; // Already processed

      post.setAttribute('data-jli-author-checked', 'true');

      const author = getPostAuthor(post);
      if (!author) return;

      if (isBlockedAuthor(author)) {
        JLI.collapseElement(post, 'blocked-author', `Post by ${author.slice(0, 50)}`);
      }
    });
  }

  // ============================================================================
  // MAIN CLEAN FEED FUNCTION
  // ============================================================================
  
  JLI.features.cleanFeed = function cleanFeed() {
    // Remove expanded layout class
    document.documentElement.classList.remove("jli-expanded-layout");

    // Hide various feed clutter
    hideLinkedInNews();
    hideRightRailAds();
    hidePromotedPosts();
    hideSponsoredContent();
    hideJobRecommendations();
    collapseRecommendedFollows();
    collapseReactionPosts(); // Filter reaction posts
    collapsePostsByBlockedAuthors(); // NEW: Block posts by author
  };
})();
