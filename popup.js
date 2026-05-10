const MENTIONS_KEY = "jliMentionItems";

const todosElement = document.querySelector("#todos");
const summaryElement = document.querySelector("#summary");
const clearAllButton = document.querySelector("#clear-all");
const searchInput = document.querySelector("#search");
const typeFilter = document.querySelector("#type-filter");
const personFilter = document.querySelector("#person-filter");
const tabButtons = [...document.querySelectorAll(".tabs button[data-tab]")];
const template = document.querySelector("#todo-template");

let mentionItems = {};
let selectedTab = "active";

clearAllButton.addEventListener("click", async () => {
  mentionItems = {};
  await chrome.storage.local.set({ [MENTIONS_KEY]: mentionItems });
  render();
});

[searchInput, typeFilter, personFilter].forEach((control) => {
  control.addEventListener("input", render);
  control.addEventListener("change", render);
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedTab = button.dataset.tab;
    render();
  });
});

todosElement.addEventListener("click", async (event) => {
  const copyButton = event.target.closest?.(".todo-copy");
  if (copyButton) {
    await copyOutreachMessage(copyButton);
    return;
  }

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
  updateFilterOptions(items);
  updateTabs(items);
  const tabItems = items.filter(matchesSelectedTab);
  const filteredItems = tabItems.filter(matchesFilters);
  const openItems = items.filter((item) => !isCompletedStatus(item.status));
  const completedItems = items.filter((item) => isCompletedStatus(item.status));

  summaryElement.textContent = `${openItems.length} active, ${completedItems.length} completed, ${filteredItems.length} shown`;
  clearAllButton.disabled = items.length === 0;
  todosElement.textContent = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No TODOs yet.";
    todosElement.append(empty);
    return;
  }

  if (!filteredItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = selectedTab === "completed" ? "No completed TODOs match these filters." : "No active TODOs match these filters.";
    todosElement.append(empty);
    return;
  }

  filteredItems.forEach((item) => todosElement.append(renderItem(item)));
}

function updateFilterOptions(items) {
  const tabItems = items.filter(matchesSelectedTab);
  updateSelectOptions(typeFilter, getUniqueValues(tabItems, getTypeValue), "All types");
  updateSelectOptions(personFilter, getUniqueValues(tabItems, getPersonValue), "All people");
}

function updateTabs(items) {
  const activeCount = items.filter((item) => !isCompletedStatus(item.status)).length;
  const completedCount = items.length - activeCount;

  tabButtons.forEach((button) => {
    const selected = button.dataset.tab === selectedTab;
    const count = button.dataset.tab === "completed" ? completedCount : activeCount;
    button.setAttribute("aria-selected", String(selected));
    button.textContent = `${button.dataset.tab === "completed" ? "Completed" : "Active"} (${count})`;
  });
}

function updateSelectOptions(select, values, allLabel) {
  const currentValue = select.value || "all";
  select.textContent = "";
  select.append(new Option(allLabel, "all"));
  values.forEach((value) => select.append(new Option(value, value)));
  select.value = values.includes(currentValue) ? currentValue : "all";
}

function getUniqueValues(items, getValue) {
  return [...new Set(items.map(getValue).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matchesFilters(item) {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  const person = personFilter.value;

  if (type !== "all" && getTypeValue(item) !== type) {
    return false;
  }

  if (person !== "all" && getPersonValue(item) !== person) {
    return false;
  }

  if (!query) {
    return true;
  }

  return getSearchText(item).includes(query);
}

function matchesSelectedTab(item) {
  return selectedTab === "completed" ? isCompletedStatus(item.status) : !isCompletedStatus(item.status);
}

function isCompletedStatus(status) {
  return ["done", "dismissed", "messaged"].includes(status);
}

function getTypeValue(item) {
  if (item.source === "outreach") {
    return item.outreachType || item.matchType || "outreach";
  }

  return item.source || item.matchType || "mention";
}

function getPersonValue(item) {
  return item.actorName || item.actor || item.matchedValue || item.matchedWatcherLabel || item.watcher || "Unknown";
}

function getSearchText(item) {
  return [
    item.actorName,
    item.actor,
    item.matchedWatcherLabel,
    item.watcher,
    item.matchedValue,
    item.matchType,
    item.source,
    item.outreachType,
    item.profileUrl,
    item.previewText,
    item.preview,
    item.messageText,
    item.messageTemplateLabel
  ].filter(Boolean).join(" ").toLowerCase();
}

function renderItem(item) {
  const card = template.content.firstElementChild.cloneNode(true);
  const status = item.status || "new";
  const url = getOpenUrl(item);
  const isOutreach = item.source === "outreach";

  card.dataset.id = item.id;
  card.dataset.status = status;
  card.querySelector(".todo-title").textContent = `${statusLabel(status)}: ${item.matchedWatcherLabel || item.watcher || "Watcher"}`;
  card.querySelector(".todo-source").textContent = item.source || "mention";
  card.querySelector(".todo-meta").textContent = getMetaText(item);
  card.querySelector(".todo-preview").textContent = item.previewText || item.preview || "";
  card.querySelector(".todo-open").href = url;
  card.querySelector(".todo-open").textContent = isOutreach ? "Open messaging" : "Open";
  card.querySelector(".todo-profile").href = item.profileUrl || "#";
  card.querySelector(".todo-profile").hidden = !isOutreach || !item.profileUrl;
  card.querySelector(".todo-copy").hidden = !isOutreach || !item.messageText;
  card.querySelector(".todo-messaged").hidden = !isOutreach;
  card.querySelectorAll("button[data-status]").forEach((button) => {
    button.toggleAttribute("aria-pressed", button.dataset.status === status);
  });
  card.querySelector('button[data-status="need-reply"]').hidden = isOutreach;
  card.querySelector('button[data-status="done"]').hidden = isOutreach;

  return card;
}

async function copyOutreachMessage(button) {
  const card = button.closest(".todo-card");
  const item = mentionItems[card?.dataset.id];
  if (!item?.messageText) {
    return;
  }

  await navigator.clipboard.writeText(item.messageText);
  const previousText = button.textContent;
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = previousText;
  }, 1200);
}

function getMetaText(item) {
  if (item.source === "outreach") {
    return `${item.actorName || "Unknown"} · ${item.messageTemplateLabel || "Template"} · ${item.profileUrl || ""}`;
  }

  return `${item.actorName || item.actor || "Unknown"} · ${item.matchType || "match"} · ${item.matchedValue || ""}`;
}

function getOpenUrl(item) {
  if (item.source === "outreach") {
    return item.url || item.profileUrl || "https://www.linkedin.com/messaging/";
  }

  return item.url || item.pageUrl || "https://www.linkedin.com/";
}

function cleanPersonName(value) {
  const text = String(value || "")
    .replace(/\bStatus is offline\b/gi, "")
    .replace(/\bView profile\b/gi, "")
    .replace(/\b(?:1st|2nd|3rd)\b/gi, "")
    .trim();
  const compactNameMatch = text.match(/^([\p{Lu}][\p{L}'’-]+\s+[\p{Lu}][\p{L}'’-]+)(?=[\p{Lu}][\p{Ll}])/u);
  if (compactNameMatch) {
    return compactNameMatch[1].trim();
  }

  return text
    .replace(/\s*[|,•·-]\s*.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function statusLabel(status) {
  return {
    new: "Mention",
    "need-reply": "Need reply",
    "need-message": "Need message",
    messaged: "Messaged",
    done: "Done",
    dismissed: "Dismissed"
  }[status] || "Mention";
}
