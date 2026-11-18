# Daily publishing contract

The existing ChatGPT task **Daily Intelligence Briefing** researches and writes the edition at 08:00 Europe/Rome. GitHub Actions generates recordings after the edition is committed. Do not create a second schedule or reintroduce paid API generation.

## Permanent interface

`index.html` is the permanent application. Never replace it with a generated newspaper and never redirect it to a dated HTML file. Publish content as `editions/YYYY-MM-DD.js`, assigning `window.DI_EDITION_DATA` to an object. Update `editions/latest.js` to load that exact file only after validation. Preserve previous edition files. Commit the new edition and pointer together.

Use `editions/2026-10-25.js` as the structural example, not as factual material for the next day. Every story, card, forecast, market observation, weather claim, source, date, lead and audit row must be reviewed afresh. Never carry an old market/weather observation forward as current data. Omit unavailable series and disclose gaps. The chart renderer selects the first supplied market and displays an explicit gap when no verified observations are available.

Required metadata: `date` (YYYY-MM-DD), `cutoff`, `lead.en`, `lead.ml`, `italianHeadlines` (one title/summary pair for each story), `metrics` (label/value/source triples), `audit` (label/status pairs), and measured `counts.en`/`counts.ml`. Keep `stories` (12 ranked stories), `sections` (intelligence, dashboard, forward, audit), `forecasts`, `markets`, `weather`, and `sources` consistent with the existing rendering schema. Do not store untrusted executable code in edition files; serialize the data with JSON.stringify.

For each story use en_title, ml_title, en_summary, ml_summary, deep_en, deep_ml, context_en, context_ml, watch_en, watch_ml, tag and an HTTPS source. For fully translated Italian add it_title, it_summary, deep_it, context_it, watch_it and equivalent Italian section/card fields. Italian lead summaries alone do not satisfy the full multilingual standard. State incomplete coverage explicitly. The renderer now supports complete Italian stories, desk cards and forecasts when localization is set to complete and all paired fields are supplied. Contract tests reject missing Italian content in such editions.

## Editorial standard

One warm, intelligent presenter speaks directly to the listener in every language. Never use two-person dialogue. Explain verified facts, context, why each story matters, real-world implications and what to watch. Localize naturally with equal depth across English, Malayalam and Italian. Report any unmet coverage requirement honestly. Never invent sources, facts, word counts, charts or successful tests.

## Validation and publication

1. Start from current main and write `editions/YYYY-MM-DD.js` for the Europe/Rome date. An unfinished candidate can live on `edition/YYYY-MM-DD` with the live pointer untouched. Resume that branch and date on retry. Never recycle an earlier date's reporting as today's edition.
2. In an isolated checkout, run `node scripts/prepare-edition.mjs YYYY-MM-DD`. It measures all three languages, checks the candidate directly, builds its six narration scripts and then prepares the pointer in that checkout. Run `node --test test/edition-contract.test.mjs test/publishing.test.mjs` and `node test/browser-smoke.mjs` before making a release commit. The latter uses Playwright and Chromium as installed in `.github/workflows/validate-editions.yml`.
3. When the editor lacks a Node/Chromium workspace, push only the dated draft on `edition/YYYY-MM-DD`. The validation workflow prepares it in an isolated runner and uploads the measured edition and matching pointer as `validated-edition` only after both checks pass. On recovery, find the run for the exact draft commit. A failed run leaves the branch available for repair. An already validated draft can be promoted without regenerating the reporting.
4. Promote only that validated pair onto main in one commit, using an authenticated, non-force-push or the GitHub Git tree API and a non-forced ref update. Build the commit on current main and check that its pointer is older than the candidate. If main moves, retry against the new head and recheck the pointer. If the date is already live, verify it and stop. Never merge the draft branch as a substitute for promoting its validated files.
5. After Pages deploys, run `DI_EXPECTED_DATE=YYYY-MM-DD node test/live-pages-tts.mjs` and confirm GitHub Pages deployed the release commit. This checks the exact date and browser speech invocation. The browser test mocks synthesis, so it does not prove audible playback on physical devices.
6. The existing recordings workflow runs after written publication. Track its result separately. It publishes the readiness manifest only after all six recordings are generated, and checks main before pushing. Verify the six actual URLs once the recording commit deploys. The browser retains device speech when recordings are unavailable. The manifest is an audio-readiness signal for the optional notification backend.

## Failure recovery and schedule continuity

Written-edition publication and optional recorded audio have separate outcomes. Keep the daily briefing schedule enabled when a speech provider, browser check or deployment fails; report the failed stage without modifying the automation's enabled state or schedule. The scheduled briefing must not call automation-management tools to pause itself.

After committing a verified edition, spend at most two minutes checking asynchronous audio/deployment status. If still running, report the exact pending stage and workflow link, then finish the briefing. Do not wait for the entire recording job, start duplicate generation jobs, or claim that pending audio succeeded. Failed required editorial checks still block publication of the candidate edition.

The recording generator paces speech requests, retries transient failures at most four times with backoff, and stops after a 40-minute generation budget. Completed text chunks are keyed by their language and content and saved in a best-effort Actions cache even when a later chunk fails. A rerun can resume this progress; changed narration cannot reuse a chunk from different text. Partial output never replaces a recording. The readiness manifest and public recordings are still committed only after all six recordings pass verification. Provider availability and cache retention are not guaranteed.

## Current limitations

The 25 October archive has shorter Malayalam reporting, Italian lead summaries, and historical market/weather content. The 26 October catch-up supplies detailed content for all six desks in all three languages. It explicitly omits unverified historical price series and a Sesto alert table rather than carrying old data forward. Its measured length is shorter than the former English long-read target. Recordings follow the actual supplied text in each language. Physical phone sound output, screen-off playback and deployed Cloudflare notifications still need separate verification. These are not release claims.
