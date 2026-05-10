const CONFIG_KEY = "jliWatcherConfig";

const DEFAULT_CONFIG = {
  features: {
    cleanFeed: true,
    collapseNotifications: true,
    trackMentions: true,
    trackOutreach: true,
    messageShortcuts: true
  },
  watchers: [
    {
      label: "Jace Benson",
      kind: "person",
      profileUrls: ["https://www.linkedin.com/in/jacebenson/"],
      terms: ["Jace Benson"]
    }
  ],
  messageTemplates: [
    {
      label: "New connection",
      appliesTo: ["new-connection"],
      body: "Hey {{firstName}}, thanks for connecting. Great to have you in my network."
    },
    {
      label: "New follower",
      appliesTo: ["new-follower"],
      body: "Hey {{firstName}}, thanks for following. Happy to connect here."
    },
    {
      label: "Catch-up",
      appliesTo: ["catch-up"],
      body: "Hey {{firstName}}, good to see your update. Hope you're doing well."
    }
  ]
};

const watchersElement = document.querySelector("#watchers");
const messageTemplatesElement = document.querySelector("#message-templates");
const watcherTemplate = document.querySelector("#watcher-template");
const messageTemplateTemplate = document.querySelector("#message-template-template");
const statusElement = document.querySelector("#status");
const featureControls = {
  cleanFeed: document.querySelector("#feature-clean-feed"),
  collapseNotifications: document.querySelector("#feature-collapse-notifications"),
  trackMentions: document.querySelector("#feature-track-mentions"),
  trackOutreach: document.querySelector("#feature-track-outreach"),
  messageShortcuts: document.querySelector("#feature-message-shortcuts")
};

document.querySelector("#add-watcher").addEventListener("click", () => {
  addWatcherCard({ label: "", kind: "other", profileUrls: [], terms: [] });
});

document.querySelector("#add-message-template").addEventListener("click", () => {
  addMessageTemplateCard({ label: "", appliesTo: ["new-connection"], body: "" });
});

document.querySelector("#save").addEventListener("click", async () => {
  const config = readConfigFromDom();
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  setStatus("Saved.");
});

init();

async function init() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = normalizeConfig(stored[CONFIG_KEY] || DEFAULT_CONFIG);
  watchersElement.textContent = "";
  messageTemplatesElement.textContent = "";
  Object.entries(featureControls).forEach(([key, control]) => {
    control.checked = config.features[key];
  });
  config.watchers.forEach(addWatcherCard);
  config.messageTemplates.forEach(addMessageTemplateCard);
}

function addWatcherCard(watcher) {
  const fragment = watcherTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".watcher-config-card");

  card.querySelector(".watcher-label").value = watcher.label || "";
  card.querySelector(".watcher-kind").value = watcher.kind || "other";
  card.querySelector(".watcher-profile-urls").value = (watcher.profileUrls || []).join("\n");
  card.querySelector(".watcher-terms").value = (watcher.terms || []).join("\n");
  card.querySelector(".remove-watcher").addEventListener("click", () => card.remove());

  watchersElement.append(card);
}

function addMessageTemplateCard(messageTemplate) {
  const fragment = messageTemplateTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".message-template-card");
  const appliesTo = new Set(messageTemplate.appliesTo || []);

  card.querySelector(".message-template-label").value = messageTemplate.label || "";
  card.querySelector(".message-template-body").value = messageTemplate.body || "";
  card.querySelectorAll('input[type="checkbox"][value]').forEach((checkbox) => {
    checkbox.checked = appliesTo.has(checkbox.value);
  });
  card.querySelector(".remove-message-template").addEventListener("click", () => card.remove());

  messageTemplatesElement.append(card);
}

function readConfigFromDom() {
  const features = Object.fromEntries(
    Object.entries(featureControls).map(([key, control]) => [key, control.checked])
  );
  const watchers = [...watchersElement.querySelectorAll(".watcher-config-card")].map((card) => {
    return {
      label: card.querySelector(".watcher-label").value.trim(),
      kind: card.querySelector(".watcher-kind").value,
      profileUrls: splitLines(card.querySelector(".watcher-profile-urls").value).map(normalizeProfileUrl),
      terms: splitLines(card.querySelector(".watcher-terms").value)
    };
  }).filter((watcher) => watcher.label || watcher.profileUrls.length || watcher.terms.length);

  const messageTemplates = [...messageTemplatesElement.querySelectorAll(".message-template-card")].map((card) => {
    return {
      label: card.querySelector(".message-template-label").value.trim(),
      appliesTo: [...card.querySelectorAll('input[type="checkbox"][value]:checked')].map((checkbox) => checkbox.value),
      body: card.querySelector(".message-template-body").value.trim()
    };
  }).filter((messageTemplate) => messageTemplate.label || messageTemplate.body);

  return normalizeConfig({ features, watchers, messageTemplates });
}

function normalizeConfig(config) {
  const features = { ...DEFAULT_CONFIG.features, ...(config?.features || {}) };
  const watchers = Array.isArray(config?.watchers) ? config.watchers : [];
  const messageTemplates = Array.isArray(config?.messageTemplates) ? config.messageTemplates : [];

  return {
    features: Object.fromEntries(
      Object.keys(DEFAULT_CONFIG.features).map((key) => [key, features[key] !== false])
    ),
    watchers: watchers.map((watcher) => ({
      label: String(watcher.label || "Untitled watcher").trim(),
      kind: ["person", "product", "company", "other"].includes(watcher.kind) ? watcher.kind : "other",
      profileUrls: [...new Set((watcher.profileUrls || []).map(normalizeProfileUrl).filter(Boolean))],
      terms: [...new Set((watcher.terms || []).map((term) => String(term).trim()).filter(Boolean))]
    })),
    messageTemplates: messageTemplates.map((messageTemplate) => ({
      label: String(messageTemplate.label || "Untitled template").trim(),
      appliesTo: [...new Set((messageTemplate.appliesTo || []).filter((type) => ["new-connection", "new-follower", "catch-up"].includes(type)))],
      body: String(messageTemplate.body || "").trim()
    })).filter((messageTemplate) => messageTemplate.appliesTo.length && messageTemplate.body)
  };
}

function splitLines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function normalizeProfileUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text, "https://www.linkedin.com");
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "/");
  } catch {
    return text;
  }
}

function setStatus(message) {
  statusElement.textContent = message;
  window.setTimeout(() => {
    statusElement.textContent = "";
  }, 1800);
}
