# JLI LinkedIn Declutter

Chrome extension for hiding and collapsing LinkedIn feed and notification clutter.

JLI Declutter does not use LinkedIn APIs, block network requests, click buttons, post content, send messages, automate account actions, or transmit data. The packaged extension runs a local content script on LinkedIn pages to classify visible feed and notification items, collapse distracting items, and keep comments/reposts visible.

## Runtime

Version 1.4 uses a single content script for desktop LinkedIn. This trades static CSS matching for better resilience against LinkedIn's frequently changing markup:

- No LinkedIn API calls.
- No network requests.
- No account actions.
- No data transmission.
- Local page text inspection only, used to decide which visible cards to collapse.
- A `MutationObserver` watches for newly loaded feed and notification items.
- No storage permission.

## Features

- Collapses promoted/sponsored-looking feed cards.
- Collapses suggested-looking feed cards.
- Hides job recommendation feed carousels.
- Collapses social/reaction feed cards.
- Collapses reaction notifications.
- Collapses analytics notifications, such as post impression summaries.

Collapsed items expand on hover.

## Privacy

The packaged extension processes visible LinkedIn page text locally in the browser to classify feed and notification items. It transmits no data and stores no data.

## Chrome Web Store Disclosures

Single purpose:

JLI LinkedIn Declutter locally hides and collapses distracting LinkedIn feed and notification clutter so users can browse LinkedIn with less noise.

Storage permission justification:

None. The extension no longer requests `storage`.

Host permission justification:

The extension needs access to `https://www.linkedin.com/*` so Chrome can run the packaged content script on LinkedIn pages. Access is limited to LinkedIn.

Remote code:

No. The extension does not load or execute remote code. All JavaScript, CSS, HTML, and assets are packaged with the extension.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this `jli-declutter` directory.
5. Refresh LinkedIn.

## Build Zip

Create a distributable zip from this directory:

```sh
npm run build
```

The output is written to `dist/jli-declutter-v<package.version>.zip`.

## Project Layout

- `manifest.json`: Manifest V3 config.
- `assets/`: Extension icon source and PNG assets.
- `content/generator.js`: LinkedIn decluttering content script.
- `options.html`, `options.css`: Options/help page.
- `scripts/build-zip.js`: Packaging script.

## Development Checks

Run checks from this directory:

```sh
npm run check
```

## Notes

LinkedIn changes its DOM frequently. The desktop runtime favors text and accessibility patterns over generated class names. If a rule misses, prefer small changes to the detection patterns before adding broad structural selectors.
