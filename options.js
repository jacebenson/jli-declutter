const CONFIG_KEY = "jliDeclutterConfig";

const DEFAULT_CONFIG = {
  features: {
    cleanFeed: true,
    collapseNotifications: true
  },
  reactionFilters: {
    like: true,
    love: true,
    celebrate: true,
    support: true,
    insightful: true,
    funny: true,
    comment: false,
    repost: false
  },
  blockedEntities: []
};

const statusElement = document.querySelector("#status");
const featureControls = {
  cleanFeed: document.querySelector("#feature-clean-feed"),
  collapseNotifications: document.querySelector("#feature-collapse-notifications")
};

const reactionControls = {
  like: document.querySelector("#reaction-like"),
  love: document.querySelector("#reaction-love"),
  celebrate: document.querySelector("#reaction-celebrate"),
  support: document.querySelector("#reaction-support"),
  insightful: document.querySelector("#reaction-insightful"),
  funny: document.querySelector("#reaction-funny"),
  comment: document.querySelector("#reaction-comment"),
  repost: document.querySelector("#reaction-repost")
};

const blockedEntitiesControl = document.querySelector("#blocked-entities");

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({ [CONFIG_KEY]: readConfigFromDom() });
  setStatus("Saved.");
});

init();

async function init() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = normalizeConfig(stored[CONFIG_KEY] || DEFAULT_CONFIG);

  // Load feature toggles
  Object.entries(featureControls).forEach(([key, control]) => {
    control.checked = config.features[key];
  });

  // Load reaction filters
  Object.entries(reactionControls).forEach(([key, control]) => {
    control.checked = config.reactionFilters?.[key] ?? DEFAULT_CONFIG.reactionFilters[key];
  });

  // Load blocked entities
  if (blockedEntitiesControl) {
    blockedEntitiesControl.value = (config.blockedEntities || []).join('\n');
  }
}

function readConfigFromDom() {
  const features = Object.fromEntries(
    Object.entries(featureControls).map(([key, control]) => [key, control.checked])
  );

  const reactionFilters = Object.fromEntries(
    Object.entries(reactionControls).map(([key, control]) => [key, control.checked])
  );

  const blockedEntities = blockedEntitiesControl?.value
    ? blockedEntitiesControl.value
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean)
    : [];

  return normalizeConfig({ features, reactionFilters, blockedEntities });
}

function normalizeConfig(config) {
  const features = { ...DEFAULT_CONFIG.features, ...(config?.features || {}) };
  const reactionFilters = { ...DEFAULT_CONFIG.reactionFilters, ...(config?.reactionFilters || {}) };
  const blockedEntities = config?.blockedEntities || DEFAULT_CONFIG.blockedEntities;

  return {
    features: Object.fromEntries(
      Object.keys(DEFAULT_CONFIG.features).map((key) => [key, features[key] !== false])
    ),
    reactionFilters: Object.fromEntries(
      Object.keys(DEFAULT_CONFIG.reactionFilters).map((key) => [key, reactionFilters[key] !== false])
    ),
    blockedEntities
  };
}

function setStatus(message) {
  statusElement.textContent = message;
  window.setTimeout(() => {
    statusElement.textContent = "";
  }, 1800);
}
