# JLI LinkedIn Declutter

CSS-only Chrome extension for hiding and collapsing LinkedIn feed and notification clutter.

JLI Declutter does not use LinkedIn APIs, block network requests, click buttons, post content, send messages, automate account actions, read page text with JavaScript, observe DOM mutations, or rewrite LinkedIn's HTML. The packaged extension only injects `content.css` on LinkedIn pages.

## CSS-only Runtime

Version 1.3 removes the content-script runtime entirely. No JavaScript runs on LinkedIn pages. This trades perfect matching for a much smaller footprint:

- No inserted wrapper nodes.
- No custom data attributes.
- No moving LinkedIn content into extension elements.
- No `MutationObserver`.
- No storage permission.

## Features

- Hides right-rail ad iframes.
- Hides broad right-rail clutter.
- Collapses promoted/sponsored-looking feed cards.
- Collapses suggested-looking feed cards.
- Hides job recommendation feed carousels.
- Collapses social/reaction feed cards.
- Collapses reaction notifications.
- Collapses analytics notifications, such as post impression summaries.

Collapsed items expand on hover.

## CSS Generator for Stylus

Want custom toggles? Use the included CSS Generator to create a user stylesheet for the [Stylus](https://addons.mozilla.org/en-US/firefox/addon/styl-us/) extension:

1. Open the extension options.
2. Click "Open CSS Generator".
3. Configure your preferences.
4. Copy the generated CSS.
5. Install it in Stylus for `linkedin.com`.

## Privacy

The packaged extension processes no page data with JavaScript and transmits no data. It only injects local CSS. The Stylus generator runs locally in the options page and outputs CSS for the user to copy.

## Chrome Web Store Disclosures

Single purpose:

JLI LinkedIn Declutter locally hides and collapses distracting LinkedIn feed and notification clutter so users can browse LinkedIn with less noise.

Storage permission justification:

None. The extension no longer requests `storage`.

Host permission justification:

The extension needs access to `https://www.linkedin.com/*` so Chrome can apply the packaged stylesheet to LinkedIn pages. Access is limited to LinkedIn.

Remote code:

No. The extension does not load or execute remote code. All CSS, HTML, and assets are packaged with the extension.

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
- `content.css`: CSS-only LinkedIn decluttering rules.
- `options.html`, `options.css`: Options/help page.
- `docs/css-generator.html`: Stylus CSS generator.
- `scripts/build-zip.js`: Packaging script.

## Development Checks

Run checks from this directory:

```sh
npm run check
```

## Notes

LinkedIn changes its DOM frequently. CSS-only matching intentionally favors less code and less page interference over perfect coverage. If a rule misses, prefer adding a simple structural selector over reintroducing runtime JavaScript.
