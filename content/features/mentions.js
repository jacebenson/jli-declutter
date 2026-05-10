(() => {
  const JLI = window.JLI;

  function matchesTerm(text, term) {
    const cleanTerm = term.trim();
    if (!cleanTerm) return false;
    const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (cleanTerm.includes(" ") ? new RegExp(escaped, "i") : new RegExp(`(^|\\P{L})${escaped}(?=$|\\P{L})`, "iu")).test(text);
  }

  function findWatcherMatch(element) {
    if (!element || JLI.isInsideJliUi(element) || !JLI.state.config.watchers.length) return null;
    for (const watcher of JLI.state.config.watchers) {
      for (const link of JLI.getNonJliLinks(element)) {
        const href = JLI.normalizeProfileUrl(link.href);
        const matchedValue = watcher.profileUrls.find((profileUrl) => href === profileUrl || href.startsWith(profileUrl));
        if (matchedValue) return { watcher, matchType: "profile-url", matchedValue };
      }
      const text = JLI.getCleanText(element);
      for (const term of watcher.terms) {
        if (matchesTerm(text, term)) return { watcher, matchType: term.trim().includes(" ") ? "exact-term" : "word-term", matchedValue: term };
      }
    }
    return null;
  }

  function hasNonJliLinkedInLink(element) {
    return JLI.getNonJliLinks(element).some((link) => link.href.startsWith("https://www.linkedin.com/"));
  }

  function findNotificationContainer(element) {
    let node = element;
    let candidate = element;
    for (let depth = 0; node && depth < 8; depth += 1) {
      if (JLI.isUnsafeContainer(node)) break;
      if (node.matches?.('[role="listitem"], li, article')) candidate = node;
      node = node.parentElement;
    }
    return candidate;
  }

  function getMentionUrl(container) {
    return JLI.getNonJliLinks(container).map((link) => link.href).find((href) => href.includes("/feed/update/urn:li:activity:")) || window.location.href;
  }

  function getNotificationUrl(container) {
    const links = JLI.getNonJliLinks(container);
    return container.querySelector?.(".nt-card__headline[href]")?.href || links.map((link) => link.href).find((href) => href.includes("/feed/update/urn:li:activity:")) || links.map((link) => link.href).find((href) => href.startsWith("https://www.linkedin.com/")) || window.location.href;
  }

  function getNotificationId(notification, url, match) {
    const activityId = url.match(/urn:li:activity:\d+/)?.[0];
    const componentKey = notification.getAttribute("componentkey") || notification.querySelector?.("[componentkey]")?.getAttribute("componentkey");
    return `notification:${activityId || componentKey || JLI.hashString(`${url}:${JLI.getCleanText(notification).slice(0, 220)}:${match.watcher.label}:${match.matchedValue}`)}:${match.watcher.label}:${match.matchedValue}`;
  }

  function getActorName(container) {
    return JLI.getNonJliLinks(container).filter((link) => link.href.includes("/in/")).map(JLI.getProfileLinkName).find(Boolean) || "Unknown";
  }

  function isNotificationCard(element) {
    return Boolean(element?.matches?.('[data-view-name="notification-card-container"], .nt-card') || element?.querySelector?.('[data-view-name="notification-card-container"], .nt-card__headline'));
  }

  function getPreviewText(container) {
    return isNotificationCard(container) && JLI.getNotificationHeadlineText ? JLI.getNotificationHeadlineText(container).slice(0, 220) : JLI.getCleanText(container).slice(0, 220);
  }

  function buildMentionItem({ id, source, container, match }) {
    return { id, source, status: "new", matchedWatcherLabel: match.watcher.label, matchedKind: match.watcher.kind, matchType: match.matchType, matchedValue: match.matchedValue, actorName: getActorName(container), previewText: getPreviewText(container), url: getMentionUrl(container), pageUrl: window.location.href };
  }

  function detectMentionPosts() {
    [...new Set([...document.querySelectorAll("h2")].filter((heading) => JLI.getText(heading).includes("Feed post")).map(JLI.findFeedPostContainer).filter(Boolean))].forEach((post) => {
      const match = findWatcherMatch(post);
      if (!match) return;
      const activityId = JLI.getNonJliLinks(post).map((link) => link.href.match(/urn:li:activity:\d+/)?.[0]).find(Boolean) || "unknown-post";
      JLI.saveTodoItem(buildMentionItem({ id: `post:${activityId}`, source: "post", container: post, match })).then((item) => injectMentionControls(post, item));
    });
  }

  function detectMentionComments() {
    [...document.querySelectorAll('[componentkey^="replaceableComment_urn:li:comment:"]')].forEach((comment) => {
      const match = findWatcherMatch(comment);
      if (!match) return;
      const id = comment.getAttribute("componentkey")?.replace(/^replaceableComment_/, "") || "unknown-comment";
      JLI.saveTodoItem(buildMentionItem({ id: `comment:${id}`, source: "comment", container: comment, match })).then((item) => injectMentionControls(comment, item));
    });
  }

  function detectMentionNotifications() {
    if (!JLI.isNotificationsPage()) return;
    [...new Set([...document.querySelectorAll('[role="listitem"], li, article')].filter((element) => !JLI.isInsideJliUi(element) && hasNonJliLinkedInLink(element)).map(findNotificationContainer).filter((element) => element && !JLI.isReactionText?.(JLI.getNotificationHeadlineText?.(element))))].forEach((notification) => {
      const match = findWatcherMatch(notification);
      if (!match) return;
      const url = getNotificationUrl(notification);
      const item = buildMentionItem({ id: getNotificationId(notification, url, match), source: "notification", container: notification, match });
      item.url = url;
      JLI.saveTodoItem(item).then((savedItem) => injectMentionControls(notification, savedItem));
    });
  }

  function injectMentionControls(container, item) {
    if (!container || document.querySelector?.(`[data-jli-mention-id="${CSS.escape(item.id)}"]`)) return;
    container.classList.add("jli-mention-candidate");
    container.setAttribute("data-jli-mention-source", item.source);
    if (item.source === "comment" && injectCommentMentionActions(container, item)) return;

    const controls = document.createElement("div");
    controls.className = "jli-mention-controls";
    controls.setAttribute("data-jli-mention-id", item.id);
    controls.innerHTML = '<span class="jli-mention-label"></span><span class="jli-mention-actions"><button type="button" data-jli-status="need-reply">Need reply</button><button type="button" data-jli-status="done">Done</button><button type="button" data-jli-status="dismissed">Dismiss</button></span>';
    controls.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-jli-status]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      JLI.setTodoStatus(item.id, button.dataset.jliStatus);
    });
    renderStatus(controls, item);
    container.insertBefore(controls, container.firstElementChild || null);
  }

  function injectCommentMentionActions(container, item) {
    const replyButton = container.querySelector?.('button[aria-label="Reply"]');
    const actionRow = replyButton?.parentElement;
    if (!actionRow) return false;

    const controls = document.createElement("span");
    controls.className = "jli-mention-controls jli-mention-controls-inline";
    controls.setAttribute("data-jli-mention-id", item.id);
    controls.setAttribute("title", `${item.matchedWatcherLabel} (${item.matchType})`);
    controls.innerHTML = '<button type="button" data-jli-status="need-reply">TODO</button><button type="button" data-jli-status="done">Done</button><button type="button" data-jli-status="dismissed">Dismiss</button>';
    controls.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-jli-status]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      JLI.setTodoStatus(item.id, button.dataset.jliStatus);
    });
    renderStatus(controls, item);
    actionRow.append(controls);
    return true;
  }

  function renderStatus(controls, item) {
    if (!controls || !item) return;
    controls.dataset.jliMentionStatus = item.status;
    const label = controls.querySelector(".jli-mention-label");
    if (label) label.textContent = `${statusLabel(item.status)}: ${item.matchedWatcherLabel} (${item.matchType})`;
    controls.querySelectorAll("button[data-jli-status]").forEach((button) => button.toggleAttribute("aria-pressed", button.dataset.jliStatus === item.status));
  }

  function statusLabel(status) {
    return ({ new: "Mention", "need-reply": "Need reply", done: "Done", dismissed: "Dismissed" })[status] || "Mention";
  }

  JLI.features.mentions = function mentions() {
    detectMentionPosts();
    detectMentionComments();
    detectMentionNotifications();
  };
  JLI.features.mentions.renderStatus = renderStatus;
})();
