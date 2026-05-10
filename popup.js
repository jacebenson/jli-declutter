const MENTIONS_KEY = "jliMentionItems";

const todosElement = document.querySelector("#todos");
const summaryElement = document.querySelector("#summary");
const clearAllButton = document.querySelector("#clear-all");
const template = document.querySelector("#todo-template");

let mentionItems = {};

clearAllButton.addEventListener("click", async () => {
  mentionItems = {};
  await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
  render();
});

todosElement.addEventListener("click", async (event) => {
  const button = event.target.closest?.("button[data-status]");
  if (!button) {
    return;
  }

  const card = button.closest(".todo-card");
  const item = mentionItems[card?.dataset.id];
  if (!item) {
    return;
  }

  mentionItems[item.id] = {
    ...item,
    status: button.dataset.status,
    updatedAt: Date.now()
  };

  await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
  render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[MENTIONS_KEY]) {
    return;
  }

  mentionItems = changes[MENTIONS_KEY].newValue || {};
  render();
});

init();

async function init() {
  const stored = await chrome.storage.local.get(MENTIONS_KEY);
  mentionItems = stored[MENTIONS_KEY] || {};
  render();
}

function render() {
  const items = Object.values(mentionItems)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const openItems = items.filter((item) => !["done", "dismissed"].includes(item.status));

  summaryElement.textContent = `${openItems.length} open, ${items.length} total`;
  clearAllButton.disabled = items.length === 0;
  todosElement.textContent = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No watched mentions yet.";
    todosElement.append(empty);
    return;
  }

  items.forEach((item) => todosElement.append(renderItem(item)));
}

function renderItem(item) {
  const card = template.content.firstElementChild.cloneNode(true);
  const status = item.status || "new";
  const url = item.url || item.pageUrl || "https://www.linkedin.com/";

  card.dataset.id = item.id;
  card.dataset.status = status;
  card.querySelector(".todo-title").textContent = `${statusLabel(status)}: ${item.matchedWatcherLabel || item.watcher || "Watcher"}`;
  card.querySelector(".todo-source").textContent = item.source || "mention";
  card.querySelector(".todo-meta").textContent = `${item.actorName || item.actor || "Unknown"} · ${item.matchType || "match"} · ${item.matchedValue || ""}`;
  card.querySelector(".todo-preview").textContent = item.previewText || item.preview || "";
  card.querySelector(".todo-open").href = url;
  card.querySelectorAll("button[data-status]").forEach((button) => {
    button.toggleAttribute("aria-pressed", button.dataset.status === status);
  });

  return card;
}

function statusLabel(status) {
  return {
    new: "Mention",
    "need-reply": "Need reply",
    done: "Done",
    dismissed: "Dismissed"
  }[status] || "Mention";
}
