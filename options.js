const CONFIG_KEY = "jliWatcherConfig";

const DEFAULT_CONFIG = {
  watchers: [
    {
      label: "Jace Benson",
      kind: "person",
      profileUrls: ["https://www.linkedin.com/in/jacebenson/"],
      terms: ["Jace Benson"]
    }
  ]
};

const watchersElement = document.querySelector("#watchers");
const template = document.querySelector("#watcher-template");
const statusElement = document.querySelector("#status");

document.querySelector("#add-watcher").addEventListener("click", () => {
  addWatcherCard({ label: "", kind: "other", profileUrls: [], terms: [] });
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
  config.watchers.forEach(addWatcherCard);
}

function addWatcherCard(watcher) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".watcher-card");

  card.querySelector(".watcher-label").value = watcher.label || "";
  card.querySelector(".watcher-kind").value = watcher.kind || "other";
  card.querySelector(".watcher-profile-urls").value = (watcher.profileUrls || []).join("\n");
  card.querySelector(".watcher-terms").value = (watcher.terms || []).join("\n");
  card.querySelector(".remove-watcher").addEventListener("click", () => card.remove());

  watchersElement.append(card);
}

function readConfigFromDom() {
  const watchers = [...document.querySelectorAll(".watcher-card")].map((card) => {
    return {
      label: card.querySelector(".watcher-label").value.trim(),
      kind: card.querySelector(".watcher-kind").value,
      profileUrls: splitLines(card.querySelector(".watcher-profile-urls").value).map(normalizeProfileUrl),
      terms: splitLines(card.querySelector(".watcher-terms").value)
    };
  }).filter((watcher) => watcher.label || watcher.profileUrls.length || watcher.terms.length);

  return normalizeConfig({ watchers });
}

function normalizeConfig(config) {
  const watchers = Array.isArray(config?.watchers) ? config.watchers : [];

  return {
    watchers: watchers.map((watcher) => ({
      label: String(watcher.label || "Untitled watcher").trim(),
      kind: ["person", "product", "company", "other"].includes(watcher.kind) ? watcher.kind : "other",
      profileUrls: [...new Set((watcher.profileUrls || []).map(normalizeProfileUrl).filter(Boolean))],
      terms: [...new Set((watcher.terms || []).map((term) => String(term).trim()).filter(Boolean))]
    }))
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
