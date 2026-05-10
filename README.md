# JLI LinkedIn Declutter

Local-only Chrome extension for hiding and collapsing LinkedIn feed and notification clutter.

JLI Declutter does not use LinkedIn APIs, block network requests, click buttons, post content, send messages, or automate account actions. It only changes the local LinkedIn page view in your browser.

## Features

- Hides LinkedIn News and right-rail clutter.
- Hides right-rail ad iframes.
- Collapses feed posts labeled `Promoted`, `Sponsored`, or `Sponsored Content`.
- Collapses feed posts labeled exactly `Suggested`.
- Hides job recommendation feed cards.
- Collapses recommended follow modules.
- Collapses reaction notifications.
- Collapses analytics notifications, such as post impression summaries.

Collapsed items remain on the page inside a small expandable wrapper. Hidden items include `data-jli-reason` where possible so the matched rule can be inspected in DevTools.

## Options

Open the extension options page to enable or disable:

- Clean feed clutter.
- Collapse notification clutter.

Settings are stored locally with `chrome.storage.local` under `jliDeclutterConfig`.

## Privacy 

See `index.html` for the homepage and privacy policy. `privacy.html` redirects to the privacy section on that same page. In short: LinkedIn page content is processed locally only to hide or collapse matching clutter. Settings are stored locally and no data is transmitted to the developer or any external server.

## Chrome Web Store Disclosures

Single purpose:

JLI LinkedIn Declutter locally hides and collapses distracting LinkedIn feed and notification clutter so users can browse LinkedIn with less noise.

Storage permission justification:

The `storage` permission is used to save local extension settings, such as whether feed clutter cleanup and notification clutter cleanup are enabled. Settings are stored with `chrome.storage.local` under `jliDeclutterConfig` and are not transmitted to the developer or any external server.

Host permission justification:

The extension needs access to `https://www.linkedin.com/*` so it can run on LinkedIn pages, inspect page content locally, and hide or collapse clutter such as promoted posts, sponsored content, suggested posts, recommendation modules, reaction notifications, and analytics notifications. Access is limited to LinkedIn.

Remote code:

No. The extension does not load or execute remote code. All JavaScript, CSS, and assets are packaged with the extension.

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

The output is written to `dist/jli-declutter-v<package.version>.zip`, for example `dist/jli-declutter-v1.0.0.zip`.

## Project Layout

- `manifest.json`: Manifest V3 config.
- `index.html`: Homepage and privacy policy page for publishing.
- `assets/`: Extension icon source and PNG assets.
- `options.html`, `options.css`, `options.js`: Settings UI.
- `privacy.html`: Redirect to the privacy section of `index.html`.
- `content.css`: LinkedIn page styles for hidden and collapsed clutter.
- `content/core.js`: Shared helpers and local config loading.
- `content/main.js`: Content-script coordinator.
- `content/features/clean-feed.js`: Feed and right-rail cleanup.
- `content/features/notifications.js`: Notification clutter collapse.

## Development Checks

Run syntax checks from this directory:

```sh
npm run check
```

## Notes

LinkedIn changes its DOM frequently. JLI Declutter avoids generated class names where possible and prefers visible text, ARIA labels, stable links, iframe titles, and component attributes.
