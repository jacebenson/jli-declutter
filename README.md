# JLI LinkedIn Declutter

Browser extension for hiding and collapsing LinkedIn feed and notification clutter. Available for Chrome and Firefox.

JLI Declutter does not use LinkedIn APIs, block network requests, click buttons, post content, send messages, automate account actions, or transmit data. The packaged extension runs a local content script on LinkedIn pages to classify visible feed and notification items, collapse distracting items, and keep comments/reposts visible.

## Runtime

The extension uses a single content script for desktop LinkedIn with configurable toggles:

- No LinkedIn API calls.
- No network requests.
- No account actions.
- No data transmission.
- Local page text inspection only, used to decide which visible cards to collapse.
- A `MutationObserver` watches for newly loaded feed and notification items.
- Settings stored locally via `storage.sync` (not transmitted anywhere).

## Features

- Toggle to enable/disable the extension.
- Collapse promoted/sponsored-looking feed cards.
- Collapse social/reaction feed cards.
- Collapse suggested-looking feed cards.
- Hide job recommendation feed carousels.
- Collapse recommended follow modules.
- Collapse reaction notifications.
- Collapse analytics notifications, such as post impression summaries.

All collapsed items expand on hover. Each category can be toggled independently from the popup.

## Privacy

The packaged extension processes visible LinkedIn page text locally in the browser to classify feed and notification items. It transmits no data and stores no data off-device. Settings are saved to `storage.sync` for convenience across devices — no data leaves your browser.

## Store Listing Notes

### Chrome Web Store

- **Single purpose**: Locally hides and collapses distracting LinkedIn feed and notification clutter so users can browse LinkedIn with less noise.
- **Storage permission**: Used to persist user toggle preferences locally. No data is transmitted.
- **Host permission**: `https://www.linkedin.com/*` — needed to run the content script on LinkedIn pages. Access is limited to LinkedIn.
- **Remote code**: None. All JavaScript, CSS, HTML, and assets are packaged with the extension.

### Firefox Add-ons (AMO)

The same codebase publishes to AMO. The Firefox version is identical — no remote code, no data transmission, no account automation. The `storage.sync` permission works the same way via Firefox Account sync.

## Install Locally

### Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this `jli-declutter` directory.
5. Refresh LinkedIn.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on…`.
3. Select `manifest.json` from this directory.
4. Refresh LinkedIn.

## Build Zip

Create a distributable zip from this directory:

```sh
npm run build
```

The output is written to `dist/jli-declutter-v<package.version>.zip`. The same zip works for both Chrome Web Store and Firefox Add-ons (AMO) submission.

## Project Layout

- `manifest.json`: Manifest V3 config with Chrome + Firefox compatibility.
- `assets/`: Extension icon source and PNG assets.
- `content/generator.js`: LinkedIn decluttering content script with toggle support.
- `popup.html`, `popup.css`, `popup.js`: Popup UI with master toggle and per-category toggles.
- `options.html`, `options.css`: Options/help page.
- `scripts/build-zip.js`: Packaging script.

## Development Checks

Run checks from this directory:

```sh
npm run check
```

## Notes

LinkedIn changes its DOM frequently. The desktop runtime favors text and accessibility patterns over generated class names. If a rule misses, prefer small changes to the detection patterns before adding broad structural selectors.
