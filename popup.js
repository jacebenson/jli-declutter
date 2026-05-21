const DEFAULTS = {
  enabled: true,
  collapsePromoted: true,
  collapseReactions: true,
  collapseSuggested: true,
  collapseJobRecs: true,
  collapseFollowRecs: true,
  collapseAnalytics: true
};

const $ = id => document.getElementById(id);

function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    if (chrome.runtime.lastError) return;
    for (const key of Object.keys(DEFAULTS)) {
      const el = $(key);
      if (el) el.checked = settings[key];
    }
  });
}

function notifyActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    const tab = tabs[0];
    if (!tab.url || !tab.url.includes('linkedin.com')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'config-changed' }).catch(() => {});
  });
}

function saveSetting(key) {
  const el = $(key);
  if (!el) return;
  chrome.storage.sync.set({ [key]: el.checked }, () => {
    notifyActiveTab();
  });
}

function init() {
  loadSettings();

  for (const key of Object.keys(DEFAULTS)) {
    const el = $(key);
    if (el) {
      el.addEventListener('change', () => saveSetting(key));
    }
  }

  const master = $('enabled');
  const sections = [$('#feed-section'), $('#notif-section')].filter(Boolean);
  function toggleSections() {
    const disabled = !master.checked;
    for (const el of sections) {
      el.style.opacity = disabled ? '0.4' : '';
      el.style.pointerEvents = disabled ? 'none' : '';
    }
  }
  master.addEventListener('change', toggleSections);
  toggleSections();

  document.getElementById('options-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

document.addEventListener('DOMContentLoaded', init);
