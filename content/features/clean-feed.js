(() => {
  const JLI = window.JLI;

  function findRightRailContainer(element) {
    let node = element;
    let candidate = null;
    for (let depth = 0; node && depth < 10; depth += 1) {
      if (JLI.isUnsafeContainer(node)) break;
      const rect = node.getBoundingClientRect?.();
      const text = JLI.getText(node);
      if (rect && rect.left > window.innerWidth * 0.55 && !text.includes("Feed post") && (text.includes("LinkedIn News") || text.includes("Ad Choices") || text.includes("Advertising") || text.includes("LinkedIn Corporation") || node.querySelector?.('iframe[title="advertisement"]'))) {
        candidate = node;
      }
      node = node.parentElement;
    }
    return candidate || JLI.findModuleContainer(element);
  }

  function getCollapsedTitle(element, fallback) {
    const visibleText = [...element?.querySelectorAll?.("p, span, h2, h3") || []].map(JLI.getText).find((text) => text && !["Promoted", "Feed post", "Sponsored Content"].includes(text));
    return visibleText ? `${fallback}: ${visibleText.slice(0, 90)}` : fallback;
  }

  function collapseRecommendedFollows() {
    if (!window.location.pathname.startsWith("/feed")) return;
    JLI.findExactText("Recommended for you").forEach((element) => {
      const post = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      const text = JLI.getCleanText(post);
      if (post && text.includes("Follow") && post.querySelector?.('a[href*="/in/"], button[aria-label^="Follow "]')) {
        const names = [...post.querySelectorAll('button[aria-label^="Follow "]')].map((button) => button.getAttribute("aria-label")?.replace(/^Follow\s+/i, "").trim()).filter(Boolean);
        JLI.collapseElement(post, "recommended-follows", `Recommended follows: ${names.length ? names.slice(0, 3).join(", ") : "suggested profiles"}`);
      }
    });
  }

  JLI.features.cleanFeed = function cleanFeed() {
    document.documentElement.classList.remove("jli-expanded-layout");
    JLI.findExactText("LinkedIn News").forEach((element) => JLI.markHidden(JLI.findModuleContainer(element), "linkedin-news"));
    document.querySelectorAll('a[href*="/news/story/"], a[href*="/news/daily-rundown/"], iframe[title="advertisement"], iframe[componentkey*="feed_ad"]').forEach((element) => JLI.markHidden(findRightRailContainer(element) || element, "right-rail"));
    [...JLI.findExactText("Promoted"), ...JLI.findExactText("Suggested")].forEach((element) => {
      const post = JLI.findFeedPostContainer(element);
      JLI.collapseElement(post, JLI.getText(element) === "Suggested" ? "suggested-post" : "promoted-post", getCollapsedTitle(post, JLI.getText(element) === "Suggested" ? "Suggested" : "Ad"));
    });
    document.querySelectorAll('[alt*="Sponsored Content"], [aria-label*="Sponsored Content"]').forEach((element) => {
      const container = JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element);
      JLI.collapseElement(container, "sponsored-content", getCollapsedTitle(container, "Ad"));
    });
    JLI.findExactText("Jobs recommended for you").forEach((element) => JLI.markHidden(JLI.findFeedPostContainer(element) || JLI.findModuleContainer(element), "job-recommendations"));
    collapseRecommendedFollows();
  };
})();
