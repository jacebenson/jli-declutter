const MENTIONS_KEY = "jliMentionItems";

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[MENTIONS_KEY]) {
    updateBadge();
  }
});

updateBadge();

async function updateBadge() {
  const stored = await chrome.storage.local.get(MENTIONS_KEY);
  const items = Object.values(stored[MENTIONS_KEY] || {});
  const openCount = items.filter((item) => !["done", "dismissed"].includes(item.status)).length;

  await chrome.action.setBadgeBackgroundColor({ color: "#0a66c2" });
  await chrome.action.setBadgeText({ text: openCount ? String(openCount) : "" });
}
