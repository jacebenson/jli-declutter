(() => {
  const JLI = window.JLI;

  function getNotificationHeadlineText(notification) {
    const clone = (notification.querySelector?.(".nt-card__headline") || notification).cloneNode?.(true);
    if (!clone) return "";
    clone.querySelectorAll?.(".visually-hidden").forEach((node) => node.remove());
    return JLI.getText(clone).replace(/\bStatus is offline\b/gi, "").replace(/\bUnread notification\.\b/gi, "").trim();
  }

  function isReactionText(value) {
    return /\b(liked|likes|reacted)\b/i.test(String(value || "")) || /\b\d+\s+reactions?\b/i.test(String(value || ""));
  }

  function isReactionNotification(element) {
    return isReactionText(getNotificationHeadlineText(element));
  }

  function isAnalyticsNotification(element) {
    const text = getNotificationHeadlineText(element).toLowerCase();
    return text.includes("your post got") && (text.includes("impressions") || text.includes("profile viewers"));
  }

  function getReactionSummary(notification) {
    const headline = getNotificationHeadlineText(notification);
    const match = headline.match(/^(.*?)\s+(?:reacted to|liked)\s+(.+?)(?:\s+that mentioned you\.?|\.)?$/i);
    if (!match) return headline ? `Reaction: ${headline}` : "Reaction notification";
    const otherMatch = match[1].match(/\band\s+([\d,]+)\s+others?\b/i);
    const count = otherMatch ? Number(otherMatch[1].replace(/,/g, "")) + 1 : 1;
    return `${count} ${count === 1 ? "person" : "people"} reacted to ${match[2].trim()}`;
  }

  function getAnalyticsSummary(notification) {
    const headline = getNotificationHeadlineText(notification);
    return headline ? `Analytics: ${headline}` : "Post analytics notification";
  }

  JLI.features.notifications = function notifications() {
    if (!JLI.isNotificationsPage()) return;
    
    [...document.querySelectorAll('[data-view-name="notification-card-container"], .nt-card, article')]
      .filter(isReactionNotification)
      .forEach((notification) => JLI.collapseElement(notification, getReactionSummary(notification)));
    
    [...document.querySelectorAll('[data-view-name="notification-card-container"], .nt-card, article')]
      .filter(isAnalyticsNotification)
      .forEach((notification) => JLI.collapseElement(notification, getAnalyticsSummary(notification)));
  };
})();
