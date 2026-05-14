# Agent Notes

## Important Files

- `manifest.json`: Chrome MV3 manifest. It injects `content/generator.js` on `https://www.linkedin.com/*` at `document_idle`.
- `content/generator.js`: Main desktop LinkedIn runtime. It detects feed vs notifications pages, classifies visible items, collapses unwanted clutter, handles infinite scroll via `MutationObserver`, and watches SPA URL changes.
- `content-android.css`: Legacy Android/mobile web CSS. Android is currently out of scope, but the file is still packaged.
- `options.html` and `options.css`: Extension options/help page. Keep this aligned with actual runtime behavior.
- `docs/index.html` and `docs/privacy.html`: Public/docs pages. Keep claims here consistent with the content script behavior and privacy posture.
- `scripts/build-zip.js`: Packages the extension into `dist/jli-declutter-v<package.version>.zip`.
- `package.json`: Build/check scripts and package version.
- `tmp/`: Saved LinkedIn HTML snapshots used for debugging selector/detection changes. Do not package these.

## What Changed

- The extension used to rely on static CSS (`content.css`) and a CSS generator. That no longer worked reliably because LinkedIn's desktop DOM changes frequently.
- We removed the desktop CSS-only runtime, old content scripts, and the CSS generator path.
- Desktop LinkedIn now uses one local content script: `content/generator.js`.
- The runtime collapses feed clutter such as suggested posts, promoted posts, reaction-only posts, job recommendations, and recommended follow blocks.
- The runtime keeps posts visible when someone commented, reposted, or otherwise added meaningful text.
- Notifications support was added. It collapses reaction and analytics notifications, while keeping comments and reposts visible.
- LinkedIn is an SPA, so `content/generator.js` recomputes page type on URL changes and restarts its observer.
- We intentionally avoid `data-jli-*` DOM markers now. Processed state is tracked in memory with `WeakSet`/`WeakMap`.
- The extension still adds local label nodes and inline styles to collapsed items so they can expand on hover/click.

## Current Direction

- Keep changes small and focused in `content/generator.js` when LinkedIn wording/markup changes.
- Prefer text/accessibility-pattern detection over brittle generated class names.
- Avoid broad structural CSS selectors that can hide the whole LinkedIn feed.
- Keep docs/options honest: this is no longer CSS-only and it does read visible page text locally.
- The extension should not call LinkedIn APIs directly, click buttons, automate account actions, store settings, or send data anywhere.
- After runtime changes, run `npm run check` and `npm run build`.
