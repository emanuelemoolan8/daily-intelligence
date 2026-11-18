# Daily publishing contract

The existing **Daily Intelligence Briefing** task starts editorial work at 08:00 Europe/Rome. There is one schedule. GitHub Actions runs in response to a candidate branch update or a manual retry. Speech generation uses eSpeak NG locally in the runner with FFmpeg.

## Write and validate the edition

- Start from current main. Keep the permanent interface in `index.html`, the archived editions and recordings, the player, and the short and full reading modes.
- Write `editions/YYYY-MM-DD.js` as a JSON payload assigned to `window.DI_EDITION_DATA`. Use the Rome date, an explicit cutoff, 12 ranked and sourced stories, all six desks, and complete English, Malayalam and Italian.
- Give the three editions the same reporting, context, implications and forward questions. Use a single warm presenter who speaks directly to the reader or listener. Use natural localization across the lead, stories, desk cards, forecasts, audit and narration. Follow the narration and Malayalam style guides.
- Verify the claims against dated sources. Label analysis and subjective forecasts. Explain gaps in local weather or historical market data and leave unverified observations out. The validator checks the data structure and language coverage. Editorial source review still happens while writing.
- Record the actual reading lengths. Run the commands below on a branch named `edition/YYYY-MM-DD` before pushing it.

```sh
node scripts/measure-edition.mjs YYYY-MM-DD --write
node scripts/validate-candidate.mjs YYYY-MM-DD
node scripts/stage-edition.mjs YYYY-MM-DD
node --test test/edition-contract.test.mjs test/publishing.test.mjs
node scripts/build-audio-scripts.mjs YYYY-MM-DD
```

The stage command prepares the canonical pointer on the candidate branch. Keep main on the last released edition while candidate preparation runs. Checkpoint the dated edition on the candidate branch after editorial and localization validation so later runs can resume without writing it again.

## Prepare and release

1. Push the candidate branch. **Prepare candidate edition recordings** validates its date and translations, runs the contract checks, generates six MP3s and decodes every track. It runs the mobile browser checks with the completed candidate and commits all six recordings with `publication.json` to that branch. A plain fast-forward push protects against another writer changing the branch.
2. Check the successful workflow run, candidate tip and manifest. Release by fast-forwarding main to the complete candidate tip. For the Git data API, use the main SHA from the initial read as the expected head and keep force disabled. For git, fetch both refs, check that main is an ancestor of the candidate, then push the exact verified revision to main. A conflicting main update requires a fresh candidate based on current main and a rerun.
3. Wait for GitHub Pages and run `node test/live-pages-tts.mjs YYYY-MM-DD`. Check the deployed pointer, dated payload, ready manifest and all six public MP3 URLs. The Pages workflow run should report the same revision published to main. The device-speech test mocks speech synthesis to verify invocation. Physical device sound and screen-off behaviour require a real phone.
4. Report the exact edition date, published commit, verified audio status and measured lengths. The optional Cloudflare worker treats the manifest as a readiness signal. Notification delivery is independently verified.

## Recover a candidate

If preparation fails, use the same dated branch. Fix the failed input or rerun the workflow on that branch. The old live pointer and readiness manifest remain on main throughout preparation. If Actions is unavailable, run the same tests with local Chromium and generate and verify audio before committing the complete bundle and fast-forwarding main.

```sh
python3 scripts/generate-offline-audio.py YYYY-MM-DD
node scripts/prepare-publication.mjs YYYY-MM-DD
node test/browser-smoke.mjs
```

The local speech command needs eSpeak NG and FFmpeg. Browser checks require Playwright and Chromium. The audio has a synthetic voice in each language.
