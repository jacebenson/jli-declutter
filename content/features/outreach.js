(() => {
  const JLI = window.JLI;

  function getOutreachPageType() {
    const path = window.location.pathname;
    if (path.startsWith("/mynetwork/invite-connect/connections")) return "new-connection";
    if (path.startsWith("/mynetwork/grow")) return "new-follower";
    if (path.startsWith("/mynetwork/catch-up/all")) return "catch-up";
    return "";
  }

  function buildOutreachCandidate(link, outreachType) {
    const profileUrl = JLI.normalizeProfileUrl(link.href);
    const name = JLI.getProfileLinkName(link);
    const card = JLI.findModuleContainer(link) || link;
    const text = JLI.getCleanText(card).toLowerCase();
    const actionable = outreachType === "new-follower" ? text.includes("follows you") || text.includes("started following you") || text.includes("new follower") : outreachType === "new-connection" ? text.includes("connected") || text.includes("connection") : !text.includes("suggested") && !text.includes("people you may know");
    const recipient = JLI.getLinkedInRecipientId(link) || JLI.getLinkedInRecipientId(card);
    return profileUrl && name && actionable && !["open", "status is offline", "view profile", "connect", "message", "follow"].includes(name.toLowerCase()) ? { name, profileUrl, recipient } : null;
  }

  function buildOutreachItem(candidate, outreachType, template) {
    const sourceLabel = ({ "new-connection": "New connection", "new-follower": "New follower", "catch-up": "Catch-up" })[outreachType] || "Outreach";
    const messageText = template.body.replace(/{{\s*(name|firstName|profileUrl|source)\s*}}/g, (match, key) => ({ name: candidate.name, firstName: candidate.name.split(/\s+/)[0] || candidate.name, profileUrl: candidate.profileUrl, source: sourceLabel })[key] || "");
    return { id: `outreach:${candidate.profileUrl}`, source: "outreach", status: "need-message", matchedWatcherLabel: sourceLabel, matchedKind: "person", matchType: outreachType, matchedValue: candidate.name, actorName: candidate.name, previewText: messageText, url: JLI.getLinkedInComposeUrl(candidate.recipient, "d_flagship3_mynetwork") || candidate.profileUrl, pageUrl: window.location.href, outreachType, profileUrl: candidate.profileUrl, recipient: candidate.recipient, messageTemplateLabel: template.label, messageText };
  }

  JLI.features.outreach = function outreach() {
    const outreachType = getOutreachPageType();
    const template = JLI.state.config.messageTemplates.find((item) => item.appliesTo.includes(outreachType));
    if (!outreachType || !template) return;
    [...new Map([...document.querySelectorAll('a[href*="/in/"]')].filter((link) => !JLI.isInsideJliUi(link)).map((link) => buildOutreachCandidate(link, outreachType)).filter(Boolean).map((candidate) => [candidate.profileUrl, candidate])).values()].forEach((candidate) => JLI.saveTodoItem(buildOutreachItem(candidate, outreachType, template)));
  };
})();
