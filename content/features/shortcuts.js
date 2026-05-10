(() => {
  const JLI = window.JLI;

  JLI.features.shortcuts = function shortcuts() {
    if (!window.location.pathname.startsWith("/feed")) return;
    [...document.querySelectorAll('button[aria-label^="Open control menu for post by"]')].forEach((menuButton) => {
      const post = JLI.findFeedPostContainer(menuButton);
      const actor = getShortcutActor(post, menuButton);
      const url = getMessagingUrl(actor);
      if (!actor.name || !url || menuButton.parentElement?.querySelector?.(".jli-message-shortcut")) return;
      const link = document.createElement("a");
      link.className = "jli-message-shortcut";
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "✉";
      link.setAttribute("aria-label", `Open messages for ${actor.name}`);
      link.setAttribute("title", `Message ${actor.name}`);
      menuButton.before(link);
    });
  };

  function getShortcutActor(post, menuButton) {
    return getSocialContextActor(post, menuButton) || getPostAuthorActor(post, menuButton);
  }

  function getSocialContextActor(post, menuButton) {
    for (const link of getProfileLinksBeforeMenu(post, menuButton)) {
      const context = getSocialContextContainer(link, post, menuButton);
      if (!context) continue;
      const name = JLI.getProfileLinkName(link);
      if (name) return { name, context: link.closest?.("a[href]") || context };
    }
    return null;
  }

  function getPostAuthorActor(post, menuButton) {
    const name = JLI.cleanPersonName(menuButton.getAttribute("aria-label")?.match(/^Open control menu for post by\s+(.+)$/i)?.[1] || "");
    return { name, context: post };
  }

  function getProfileLinksBeforeMenu(post, menuButton) {
    return JLI.getNonJliLinks(post)
      .filter((link) => link.href.includes("/in/") && Boolean(link.compareDocumentPosition(menuButton) & Node.DOCUMENT_POSITION_FOLLOWING));
  }

  function getSocialContextContainer(link, post, menuButton) {
    let node = link;
    for (let depth = 0; node && node !== post && depth < 7; depth += 1) {
      const text = JLI.getCleanText(node);
      if (!node.contains(menuButton) && text.length <= 180 && isSocialContextText(text)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function isSocialContextText(text) {
    return /\b(?:likes?|liked|commented\s+on|reposted|shared|reacted\s+to)\b.+\b(?:this|post|update)\b/i.test(text);
  }

  function getMessagingUrl(actor) {
    return JLI.getLinkedInComposeUrl(JLI.getLinkedInRecipientId(actor.context));
  }
})();
