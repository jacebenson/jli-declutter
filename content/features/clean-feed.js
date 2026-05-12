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
    console.log('[JLI] Getting blocked entities. JLI.state:', JLI.state);
    const entities = JLI.state?.config?.blockedEntities || [];
    console.log('[JLI] Blocked entities from config:', entities);
    return entities;
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

    // Method 1: Look for aria-label on elements within the post (not just the post itself)
    // The aria-label often contains "Jean Seely, PMP... 1st"
    const labeledElements = post?.querySelectorAll?.('[aria-label]');
    if (labeledElements) {
      for (const el of labeledElements) {
        const ariaLabel = el.getAttribute('aria-label') || '';
        // Match patterns like "Jean Seely, PMP... 1st" or "Jean Seely's post"
        const match = ariaLabel.match(/^(.+?)(?:\s+\d+(?:st|nd|rd|th)|\s+['\u2019]s\s+post|$)/i);
        if (match && match[1].length > 2 && !ariaLabel.includes('Feed post')) {
          const name = match[1].trim();
          // Make sure it's not just a connection degree
          if (!name.match(/^(1st|2nd|3rd|\+)$/)) {
            return name;
          }
        }
      }
    }

    // Method 2: Look for the main author name in the post header
    // Based on the HTML, author name is in a <p> with specific class pattern, inside an <a> to /in/
    const authorLink = post?.querySelector?.('a[href*="/in/"]');
    if (authorLink) {
      // Find all text elements inside the author link
      const textElements = authorLink.querySelectorAll('p, span, div');
      for (const el of textElements) {
        const text = JLI.getText(el);
        // Look for text that looks like a name (contains letters, might have commas for credentials)
        // Filter out short text, connection degrees, and subtitles
        if (text &&
            text.length > 2 &&
            text.length < 150 &&
            !text.match(/^[•\s]*(1st|2nd|3rd|\+)$/) &&
            !text.match(/^( Strategic | Championing | Enthusiast |Former |CEO |Founder)/i) &&
            text.match(/[a-zA-Z]{2,}/)) {
          return text.trim();
        }
      }
    }

    // Method 3: Look at profile images with alt text
    const profileImages = post?.querySelectorAll?.('img[alt*="profile"]');
    if (profileImages) {
      for (const img of profileImages) {
        const alt = img.alt || '';
        const match = alt.match(/view\s+(.+?)['\u2019]s?\s+profile/i);
        if (match) {
          return match[1].trim();
        }
      }
    }

    // Method 4: Broad search - look for text that matches "Name, Credential" pattern
    // This catches "Jean Seely, PMP, MSPM..."
    const allText = post?.textContent || '';
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      // Pattern: Name followed by credentials (comma-separated)
      // Examples: "Jean Seely, PMP, MSPM..." or "John Smith, MBA"
      const credentialMatch = line.match(/^([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]+)+)/);
      if (credentialMatch && credentialMatch[1].length > 3) {
        return credentialMatch[1].trim();
      }
      // Simple name pattern (first and last name)
      const nameMatch = line.match(/^([A-Z][a-z]+\s+[A-Z][a-zA-Z\s-]+)$/);
      if (nameMatch && nameMatch[1].length > 3 && nameMatch[1].length < 100) {
        return nameMatch[1].trim();
      }
    }

    return null;
  }

  function normalizeName(name) {
    // Remove credentials, degrees, and extra whitespace
    // "Jean Seely, PMP, MSPM, A-CSM..." -> "jeanseely"
    return name
      .toLowerCase()
      .replace(/[,\s]+/g, '')  // Remove all commas and spaces
      .replace(/(pmp|mspm|a-csm|ssm|dasm|cipm|mba|phd|md|jd|cpa|cfp|cissp|csm|psm|spc|lpc|ccc|dac|safe|agile|scrum|master|product|owner|coach|trainer|facilitator|practitioner|professional|certified|associate|expert|fellow|senior|lead|principal|engineer|developer|manager|director|vp|ceo|cto|cfo|coo|cmo|chief|president|founder|co-founder|owner|partner|analyst|consultant|specialist|strategist|architect|designer|writer|author|speaker|influencer|entrepreneur|innovator|champion|advocate|mentor|advisor|board|member)/gi, '')  // Remove common credentials
      .replace(/[^a-z]/g, '');  // Keep only letters
  }

  function isBlockedAuthor(authorName) {
    if (!authorName) return false;

    const blockedEntities = getBlockedEntities();
    if (blockedEntities.length === 0) return false;

    const normalizedAuthor = normalizeName(authorName);

    return blockedEntities.some((blocked) => {
      if (!blocked || blocked.trim().length === 0) return false;

      const normalizedBlocked = normalizeName(blocked);

      // Check if blocked name is contained in author name (normalized)
      if (normalizedAuthor.includes(normalizedBlocked)) return true;

      // Also check original case-insensitive contains
      const authorLower = authorName.toLowerCase();
      const blockedLower = blocked.toLowerCase().trim();
      if (authorLower.includes(blockedLower)) return true;

      return false;
    });
  }

  function collapsePostsByBlockedAuthors() {
    console.log('[JLI] collapsePostsByBlockedAuthors() called');
    console.log('[JLI] Current path:', window.location.pathname);

    if (!window.location.pathname.startsWith("/feed")) {
      console.log('[JLI] Not on feed, skipping');
      return;
    }

    const blockedEntities = getBlockedEntities();
    console.log('[JLI] Blocked entities:', blockedEntities);

    if (blockedEntities.length === 0) {
      console.log('[JLI] No blocked entities, skipping');
      return;
    }

    // Find all feed post containers that haven't been collapsed yet
    const feedPosts = document.querySelectorAll('[role="listitem"]:not([data-jli-collapsed]):not([data-jli-hidden])');
    console.log('[JLI] Found', feedPosts.length, 'feed posts to check');

    let checkedCount = 0;
    let matchedCount = 0;

    feedPosts.forEach((post, index) => {
      if (!isInsideFeed(post)) {
        if (index < 2) console.log('[JLI] Post', index, 'not inside feed');
        return;
      }
      if (!isValidPostContainer(post)) {
        if (index < 2) console.log('[JLI] Post', index, 'not valid container');
        return;
      }

      const author = getPostAuthor(post);
      checkedCount++;

      // Debug: log first few authors found
      if (checkedCount <= 5 && author) {
        console.log('[JLI] Post', index, 'author:', author, '- Blocked?', isBlockedAuthor(author));
      }

      if (!author) return;

      if (isBlockedAuthor(author)) {
        matchedCount++;
        console.log('[JLI] Collapsing post by blocked author:', author);
        JLI.collapseElement(post, 'blocked-author', `Post by ${author.slice(0, 50)}`);
      }
    });

    console.log(`[JLI] Checked ${checkedCount} posts, collapsed ${matchedCount}`);
  }

  // ============================================================================
  // MAIN CLEAN FEED FUNCTION
  // ============================================================================
  
  JLI.features.cleanFeed = function cleanFeed() {
    console.log('[JLI] cleanFeed() called');

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

    console.log('[JLI] About to call collapsePostsByBlockedAuthors()');
    collapsePostsByBlockedAuthors(); // NEW: Block posts by author
    console.log('[JLI] cleanFeed() complete');
  };
})();
