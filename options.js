const CONFIG_KEY = "jliDeclutterConfig";

const DEFAULT_CONFIG = {
  features: {
    cleanFeed: true,
    collapseNotifications: true
  }
};

const statusElement = document.querySelector("#status");
const featureControls = {
  cleanFeed: document.querySelector("#feature-clean-feed"),
  collapseNotifications: document.querySelector("#feature-collapse-notifications")
};

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({ [CONFIG_KEY]: readConfigFromDom() });
  setStatus("Saved.");
});

init();

async function init() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = normalizeConfig(stored[CONFIG_KEY] || DEFAULT_CONFIG);
  Object.entries(featureControls).forEach(([key, control]) => {
    control.checked = config.features[key];
  });
}

function readConfigFromDom() {
  const features = Object.fromEntries(
    Object.entries(featureControls).map(([key, control]) => [key, control.checked])
  );

  return normalizeConfig({ features });
}

function normalizeConfig(config) {
  const features = { ...DEFAULT_CONFIG.features, ...(config?.features || {}) };
  return {
    features: Object.fromEntries(
      Object.keys(DEFAULT_CONFIG.features).map((key) => [key, features[key] !== false])
    )
  };
}

function setStatus(message) {
  statusElement.textContent = message;
  window.setTimeout(() => {
    statusElement.textContent = "";
  }, 1800);
}
