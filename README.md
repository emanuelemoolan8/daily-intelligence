# Daily Intelligence

A multilingual daily-news PWA hosted on GitHub Pages, with an optional Cloudflare Worker for notifications.

- `index.html` is the permanent interface. Preserve its floating navigation, settings, reading modes and audio player.
- `editions/latest.js` loads the current dated edition. News and edition metadata belong in `editions/YYYY-MM-DD.js`.
- The existing ChatGPT **Daily Intelligence Briefing** task supplies researched editions at 08:00 Europe/Rome. GitHub Actions generates and verifies six recordings after edition updates. No paid OpenAI API publisher is required.
- `publication.json` announces the date and available recordings to the optional notification backend only after audio verification.
- Historical editions remain available in the repository. The old 25 October HTML URL forwards to the permanent UI.

Read [PUBLISHING.md](PUBLISHING.md) before publishing. Never overwrite or redirect the permanent interface. Preserve the universal single-presenter storytelling requirement and disclose translation or data gaps.

## Checks

```
node --test test/edition-contract.test.mjs test/publishing.test.mjs
node scripts/build-audio-scripts.mjs
node test/browser-smoke.mjs
node test/live-pages-tts.mjs
```

Browser checks require Playwright/Chromium; the last check targets the public site and mocks speech synthesis to verify invocation, not audible playback. The optional Cloudflare backend is independent and is not deployed by these publishing changes.

Website: https://emanuelemoolan8.github.io/daily-intelligence/
