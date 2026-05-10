# JLI LinkedIn Cleaner

Local-only Chrome extension for reducing LinkedIn clutter and tracking manual follow-up TODOs.

JLI does not use LinkedIn APIs, block requests, send messages, click buttons, like posts, follow people, connect with people, or automate account actions. It only changes the local page view and stores TODO state in `chrome.storage.local`.

## Features

- Hides or collapses common LinkedIn clutter in the feed and notifications.
- Tracks watched profile URLs and terms as local TODOs.
- Tracks manual outreach TODOs from selected My Network pages.
- Shows TODOs in the extension popup with search, type filters, person filters, active items, and completed items.
- Adds manual feed message shortcuts that open LinkedIn messaging for the relevant person when possible.
- Stores message templates locally for manual copy-and-paste outreach.

## Cleanup Rules

The cleaner hides or collapses:

- LinkedIn News and right-rail clutter.
- Right-rail ad iframes.
- Feed posts labeled `Promoted`, `Sponsored`, or `Sponsored Content`.
- Feed posts labeled exactly `Suggested`.
- Job recommendation feed cards.
- Recommended follow modules.
- Reaction notifications.
- Analytics notifications, such as post impression summaries.

Collapsed items remain on the page inside a small expandable wrapper. Hidden items include `data-jli-reason` where possible so the matched rule can be inspected in DevTools.

## TODO Tracking

Mention TODOs are created from configured watchers when matching content appears in:

- Feed posts.
- Comments.
- Notifications.

Outreach TODOs are created from supported My Network pages:

- `/mynetwork/grow/`
- `/mynetwork/catch-up/all/`
- `/mynetwork/invite-connect/connections/`

The popup supports:

- Active and Completed tabs.
- Search by name or message text.
- Filter by TODO type.
- Filter by person.
- Open source item.
- Open profile.
- Copy message template text.
- Mark messaged.
- Need reply.
- Done.
- Dismiss.
- Clear all.

Completed TODOs include `done`, `dismissed`, and `messaged` statuses. The extension badge counts open TODOs only.

## Message Shortcuts

On the LinkedIn feed, JLI adds a small mail shortcut next to post controls.

For normal posts, the shortcut targets the post author. For social-context feed cards, such as `Chuck Keith likes this` above someone else's post, the shortcut targets the social-context actor first. If a recipient ID is available in the nearby DOM, JLI opens LinkedIn's compose URL. Otherwise it falls back to LinkedIn messaging search for that person's name.

The shortcut only opens LinkedIn messaging. It does not write or send a message.

## Options

Open the extension options page to configure:

- Feature toggles.
- Watchers.
- Message templates.

Watchers support:

- Label.
- Type: `person`, `product`, `company`, or `other`.
- Profile URLs.
- Watch terms.

Message templates support these variables:

- `{{name}}`
- `{{firstName}}`
- `{{profileUrl}}`
- `{{source}}`

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this `jli` directory.
5. Refresh LinkedIn.

## Build Zip

Create a distributable zip from this directory:

```sh
npm run build
```

The output is written to `dist/jli-v<package.version>.zip`, for example `dist/jli-v1.0.0.zip`.

The zip version comes from `package.json`. The build script packages only the extension runtime files and excludes repo/build files such as `.git`, `node_modules`, `dist`, `package.json`, and `scripts/`.

## Project Layout

- `manifest.json`: Manifest V3 config.
- `background.js`: Badge count service worker.
- `popup.html`, `popup.css`, `popup.js`: TODO popup.
- `options.html`, `options.css`, `options.js`: Settings UI.
- `content.css`: LinkedIn page styles for collapsed cards, controls, and shortcuts.
- `content/core.js`: Shared `window.JLI` namespace, config, storage, and DOM helpers.
- `content/main.js`: Content-script coordinator.
- `content/features/clean-feed.js`: Feed and right-rail cleanup.
- `content/features/notifications.js`: Notification clutter collapse.
- `content/features/mentions.js`: Watcher matching and mention TODO controls.
- `content/features/outreach.js`: My Network outreach TODO detection.
- `content/features/shortcuts.js`: Feed message shortcut injection.

The content scripts are manifest-loaded in dependency order and share a single `window.JLI` namespace. They are not ES modules.

## Development Checks

Run syntax checks from this directory:

```sh
npm run check
```

## Notes

LinkedIn changes its DOM frequently. JLI avoids generated class names where possible and prefers visible text, ARIA labels, stable links, iframe titles, and component attributes.

Watcher config and TODO state are stored locally under:

- `jliWatcherConfig`
- `jliMentionItems`
