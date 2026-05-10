# JLI LinkedIn Cleaner

Local-only Chrome extension for hiding LinkedIn feed clutter.

## Phase One

This version hides:

- The LinkedIn feed right rail when it contains LinkedIn News or ad/footer modules.
- LinkedIn News modules and news links.
- Right-rail ad iframes.
- Job recommendation feed cards.

This version collapses:

- Feed posts labeled `Promoted`.
- Feed posts/media labeled `Sponsored Content`.

It does not call LinkedIn APIs, block network requests, click buttons, post content, send messages, or automate account actions.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this `jli` directory.
5. Refresh LinkedIn.

## Notes

LinkedIn changes its DOM frequently. This extension avoids generated class names and uses visible text, ARIA labels, iframe titles, and news URLs where possible.

If useful content gets hidden, inspect the hidden element for `data-jli-reason` to see which cleanup rule matched it.
