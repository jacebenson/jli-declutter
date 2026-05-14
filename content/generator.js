/**
 * JLI LinkedIn Declutter
 * 
 * Detects feed posts and notifications, applies styles to collapse/hide clutter.
 * Uses inline styles to avoid DOM modifications (stealth mode).
 */

(function() {
  'use strict';

  function getPageType() {
    return window.location.pathname.includes('/notifications') ? 'notifications' : 'feed';
  }

  let PAGE_TYPE = getPageType();
  let currentUrl = window.location.href;
  let observer = null;
  const processedElements = new WeakSet();
  const originalStyles = new WeakMap();

  // Configuration
  const CONFIG = {
    waitTime: 500,
    logPrefix: '[JLI Declutter]',
    
    // Feed page configuration
    feed: {
      selector: '[role="listitem"]',
      reactionPatterns: {
        like: /(\w+(?:\s+\w+)?)\s+likes?\s+this/i,
        love: /(\w+(?:\s+\w+)?)\s+loves?\s+this/i,
        celebrate: /(\w+(?:\s+\w+)?)\s+celebrates?\s+this/i,
        support: /(\w+(?:\s+\w+)?)\s+supports?\s+this/i,
        insightful: /(\w+(?:\s+\w+)?)\s+(?:found|finds?)\s+this\s+insightful/i,
        funny: /(\w+(?:\s+\w+)?)\s+(?:finds?|found)\s+this\s+funny/i
      },
      keepPatterns: [
        /commented\s+on\s+this/i,
        /reposted\s+this/i,
        /shared\s+this/i
      ]
    },
    
    // Notifications page configuration
    notifications: {
      selector: 'main a[href*="/feed/update/"]',
      containerSelector: 'main',
      reactionPatterns: {
        reacted: /(\w+(?:\s+\w+)?)(?:\s+and\s+\d+\s+others)?\s+reacted\s+to/i,
        liked: /(\w+(?:\s+\w+)?)\s+liked\s+(?:your\s+(?:post|comment)|this)/i
      },
      keepPatterns: [
        /commented\s+on/i,
        /reposted/i,
        /mentioned/i
      ],
      analyticsPattern: /impressions|profile viewers|post got.*analytics/i
    }
  };

  /**
   * Check if we're in developer mode
   */
  function isDeveloperMode() {
    try {
      const manifest = chrome?.runtime?.getManifest?.();
      return !!manifest && !manifest.update_url;
    } catch {
      return false;
    }
  }

  /**
   * Log helper
   */
  function log(message, ...args) {
    if (isDeveloperMode()) {
      console.log(`${CONFIG.logPrefix} ${message}`, ...args);
    }
  }

  /**
   * Get text content from element
   */
  function getText(element) {
    return (element?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Find elements to process based on page type
   */
  function findElements() {
    const config = CONFIG[PAGE_TYPE];
    return document.querySelectorAll(config.selector);
  }

  /**
   * Check if text matches keep patterns for current page
   */
  function shouldKeep(text) {
    const patterns = CONFIG[PAGE_TYPE].keepPatterns;
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect element type on feed page
   */
  function detectFeedElement(element) {
    const text = getText(element);
    const patterns = CONFIG.feed.reactionPatterns;
    
    if (shouldKeep(text)) return null;

    // Check reaction patterns
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        return { type: 'reaction', subtype: type, name: match[1] };
      }
    }

    // Check for suggested
    if (text.includes('Suggested') && element.querySelector('button[aria-label^="Follow "]')) {
      const name = element.querySelector('a[href*="/in/"] span')?.textContent;
      return { type: 'suggested', name };
    }

    // Check for promoted
    if (text.includes('Promoted')) {
      return { type: 'promoted' };
    }

    // Check for job recs
    if (text.includes('Jobs recommended for you')) {
      return { type: 'job-recs' };
    }

    // Check for follow recs
    if (text.includes('Recommended for you') && text.includes('Follow')) {
      return { type: 'follow-recs' };
    }

    return null;
  }

  /**
   * Detect element type on notifications page
   */
  function detectNotificationElement(element) {
    const text = getText(element);
    const patterns = CONFIG.notifications.reactionPatterns;
    
    // Check analytics notifications FIRST (hide these)
    if (CONFIG.notifications.analyticsPattern.test(text)) {
      return { type: 'analytics' };
    }

    // Check reaction patterns SECOND (reactions take priority over mentions)
    for (const [subtype, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        return { type: 'reaction', subtype, name: match[1] };
      }
    }
    
    // Only keep comments and reposts (not mentions on reaction notifications)
    if (/commented\s+on/i.test(text) || /reposted/i.test(text)) {
      return null;
    }

    return null;
  }

  /**
   * Detect element type based on current page
   */
  function detectElement(element) {
    return PAGE_TYPE === 'notifications' 
      ? detectNotificationElement(element)
      : detectFeedElement(element);
  }

  /**
   * Generate label based on detection
   */
  function generateLabel(detection) {
    const { type, subtype, name } = detection;

    // Notifications page labels
    if (PAGE_TYPE === 'notifications') {
      switch (type) {
        case 'reaction':
          return name 
            ? `${name} reacted, hidden - hover to expand`
            : `Reaction notification - hover to expand`;
        case 'analytics':
          return `Post analytics - hover to expand`;
        default:
          return `Hidden notification - hover to expand`;
      }
    }

    // Feed page labels
    switch (type) {
      case 'reaction':
        const verb = subtype || 'reacted to';
        return name 
          ? `${name} ${verb}, hidden post - hover to expand`
          : `Reaction post - hover to expand`;
      case 'suggested':
        return name
          ? `Suggested post by ${name} - hover to expand`
          : `Suggested post - hover to expand`;
      case 'promoted':
        return name
          ? `Promoted post by ${name} - hover to expand`
          : `Promoted post - hover to expand`;
      case 'job-recs':
        return `Job recommendations - hover to expand`;
      case 'follow-recs':
        return `Recommended follows - hover to expand`;
      default:
        return `Hidden post - hover to expand`;
    }
  }

  /**
   * Get the element to actually collapse (may differ from detection element)
   */
  function getCollapseTarget(element) {
    if (PAGE_TYPE === 'notifications') {
      // For notifications, collapse the parent container, not just the <a> tag
      // Walk up to find the notification card container
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        // Check if this looks like a notification container
        if (parent.children.length <= 3 && parent.offsetHeight > 50) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }
    return element;
  }

  /**
   * Collapse an element with label
   */
  function collapseElement(element, label) {
    // Get the actual element to collapse (might be parent for notifications)
    const target = getCollapseTarget(element);
    const labelSelector = ':scope > .jli-declutter-label';
    
    if (target.style.maxHeight === '40px' || target.querySelector(labelSelector)) {
      processedElements.add(element);
      return;
    }

    // Store original styles
    originalStyles.set(target, {
      maxHeight: target.style.maxHeight || '',
      overflow: target.style.overflow || '',
      padding: target.style.padding || '',
      borderBottom: target.style.borderBottom || ''
    });

    // Apply collapse
    target.style.maxHeight = '40px';
    target.style.overflow = 'hidden';
    target.style.position = 'relative';
    
    // For notifications, also reduce padding to make it cleaner
    if (PAGE_TYPE === 'notifications') {
      target.style.padding = '8px';
      target.style.borderBottom = '1px solid #e0e0e0';
    }

    // Create label
    const labelEl = document.createElement('div');
    labelEl.className = 'jli-declutter-label';
    labelEl.textContent = label;
    labelEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 10px;
      background: #f3f2ef;
      color: #000 !important;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px !important;
      line-height: 20px !important;
      z-index: 1;
    `;

    // Click to expand
    labelEl.addEventListener('click', (e) => {
      e.stopPropagation();
      expandElement(target, labelEl);
    });

    // Hover to expand
    target.addEventListener('mouseenter', () => {
      expandElement(target, labelEl);
    });

    target.appendChild(labelEl);
    
    // Also mark the original element so we don't process it again
    processedElements.add(element);
  }

  /**
   * Expand a collapsed element
   */
  function expandElement(element, labelEl) {
    const original = originalStyles.get(element) || {};
    element.style.maxHeight = original.maxHeight || '';
    element.style.overflow = original.overflow || '';
    element.style.padding = original.padding || '';
    element.style.borderBottom = original.borderBottom || '';
    
    if (labelEl) {
      labelEl.style.display = 'none';
    }

    // Re-collapse on mouseleave
    element.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!element.matches(':hover')) {
          element.style.maxHeight = '40px';
          element.style.overflow = 'hidden';
          if (PAGE_TYPE === 'notifications') {
            element.style.padding = '8px';
            element.style.borderBottom = '1px solid #e0e0e0';
          }
          if (labelEl) labelEl.style.display = 'block';
        }
      }, 500);
    }, { once: true });
  }

  /**
   * Main scan and process
   */
  function scanAndProcess() {
    log(`Starting ${PAGE_TYPE} scan...`);

    const elements = findElements();
    
    if (elements.length === 0) {
      log(`No ${PAGE_TYPE} elements found, skipping`);
      return 0;
    }

    log(`Found ${elements.length} ${PAGE_TYPE} elements`);

    let hiddenCount = 0;
    const summary = {};
    
    elements.forEach((element) => {
      // Skip already processed elements
      if (processedElements.has(element)) return;
      
      // Skip if parent is already collapsed (for notifications)
      if (PAGE_TYPE === 'notifications') {
        const parent = getCollapseTarget(element);
        if (parent.style.maxHeight === '40px') {
          processedElements.add(element);
          return;
        }
      }
      
      const detection = detectElement(element);
      if (detection) {
        const label = generateLabel(detection);
        collapseElement(element, label);
        hiddenCount++;
        summary[detection.type] = (summary[detection.type] || 0) + 1;
      }
    });

    log(`Collapsed ${hiddenCount} ${PAGE_TYPE} items:`, summary);
    return hiddenCount;
  }

  /**
   * Setup MutationObserver
   */
  function setupMutationObserver() {
    let debounceTimer = null;
    const config = CONFIG[PAGE_TYPE];
    observer?.disconnect();
    
    observer = new MutationObserver((mutations) => {
      // Check for new elements
      const hasNewElements = mutations.some(mutation => 
        [...mutation.addedNodes].some(node => {
          if (node.nodeType !== 1) return false;
          
          // Check if node itself matches
          if (node.matches?.(config.selector)) return true;
          
          // Check if node contains matches
          if (node.querySelector?.(config.selector)) return true;
          
          return false;
        })
      );

      if (hasNewElements) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          log(`New ${PAGE_TYPE} elements detected, re-scanning...`);
          scanAndProcess();
        }, 300);
      }
    });

    const target = PAGE_TYPE === 'notifications' 
      ? document.querySelector(config.containerSelector) || document.body
      : document.body;

    observer.observe(target, {
      childList: true,
      subtree: true
    });

    log('MutationObserver setup complete');
  }

  function watchUrlChanges() {
    window.setInterval(() => {
      if (window.location.href === currentUrl) return;

      currentUrl = window.location.href;
      PAGE_TYPE = getPageType();
      log(`URL changed, switching to ${PAGE_TYPE} page scan`);

      setTimeout(() => {
        scanAndProcess();
        setupMutationObserver();
      }, CONFIG.waitTime);
    }, 500);
  }

  /**
   * Initialize
   */
  function initialize() {
    log(`Initializing JLI LinkedIn Declutter on ${PAGE_TYPE} page...`);

    setTimeout(() => {
      scanAndProcess();
    }, CONFIG.waitTime);

    setupMutationObserver();
    watchUrlChanges();
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
