# Daily Intelligence

A multilingual daily-news progressive web app hosted on GitHub Pages, with an optional Cloudflare Worker for notification subscriptions.

## Canonical application

- **`index.html`** is the permanent application interface and GitHub Pages homepage. Preserve its floating top navigation, settings, reading modes and floating audio player.
- **`daily_intelligence_2026-10-24_bilingual_listen.html`** is a preserved historical edition / reference implementation.
- **`daily_intelligence_2026-10-25_bilingual_listen.html`** is the separately published 25 October edition. It is **not** the canonical application shell; its news must be migrated into the permanent UI before making it the default.
- **`manifest.webmanifest`, `sw.js`, `app-icon.svg`** support the installable PWA.
- **`backend/src/worker.js`** contains the Cloudflare notification backend; it is independent of GitHub Pages publishing.

## Publishing contract

**Do not redirect `index.html` to a dated HTML file or overwrite the application shell with a newly generated edition.** That caused the 25 October 2026 UI regression. New editions should supply content to the stable shell, not replace its layout.

Until a separate edition-data loader is implemented and tested, publishing a dated HTML file alone **does not** update the canonical homepage. The homepage currently retains 24 October editorial data. Do not label it as today's news without updating and verifying that data.

## Before publishing

1. Back up the existing `index.html` and retain historical editions in Git history.
2. Confirm that navigation, settings, English/Malayalam/Italian text, Brief/Full explanation, and floating audio controls still work on mobile.
3. Check audio sources independently: an audio-player UI does not guarantee that a recorded MP3 exists for each language.
4. Verify the GitHub Pages homepage and archive links in a browser; inspect the PWA/service-worker cache if an older version appears.
5. Check the Cloudflare backend separately if notification-related files changed.

## Next architecture cleanup

Extract edition content into versioned JSON files, add a manifest pointing to the latest verified edition, render that data inside the permanent shell, and add automated checks to reject homepage redirects to dated HTML. Only retire redundant dated layouts **after** data migration and regression tests pass.

## Deployment

GitHub Pages: https://emanuelemoolan8.github.io/daily-intelligence/

This README documents the existing state; it does not claim that the content migration or live deployment checks have been completed.
