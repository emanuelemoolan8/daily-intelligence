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

1. Read current main and preserve the application shell and historical editions.
2. Research and write fresh content. Populate all six desks and measure actual lengths.
3. Run `node scripts/measure-edition.mjs YYYY-MM-DD --write` to record measured editorial lengths, then `node --test test/edition-contract.test.mjs test/publishing.test.mjs` and `node scripts/build-audio-scripts.mjs` against the candidate edition/pointer.
4. Commit edition and pointer atomically to main (Git tree/commit + ref update, or a regular Git commit/push). A pointer must never reference an absent file.
5. The **Generate current edition recordings** workflow builds six recordings from the pointer. English/Malayalam narration includes all desks; Italian narration follows available translations and discloses missing depth. It verifies decoding duration and updates publication.json only after all six recordings exist. A stale workflow refuses to overwrite a newer branch head; rerun on current main rather than force-pushing.
6. Check workflow conclusions and the actual public homepage. Confirm the correct date, all six desks, language/mode changes and audio asset availability. Run browser checks in CI. Browser speech invocation tests mock the speech API and do not prove audible output on a phone.
7. Deliver the permanent website link and exact verified result. If publishing, audio or deployment failed, state the failed stage and leave the prior verified edition available. Never label a previous edition as today's edition.

The publication manifest is an audio-readiness signal for the optional notification backend. It is not proof that notifications were delivered, translations are complete or audio played on a physical device.

## Failure recovery and schedule continuity

Written-edition publication and optional recorded audio have separate outcomes. Keep the daily briefing schedule enabled when a speech provider, browser check or deployment fails; report the failed stage without modifying the automation's enabled state or schedule. The scheduled briefing must not call automation-management tools to pause itself.

After committing a verified edition, spend at most two minutes checking asynchronous audio/deployment status. If still running, report the exact pending stage and workflow link, then finish the briefing. Do not wait for the entire recording job, start duplicate generation jobs, or claim that pending audio succeeded. Failed required editorial checks still block publication of the candidate edition.

The recording generator paces speech requests, retries transient failures at most four times with backoff, and stops after a 40-minute generation budget. Completed text chunks are keyed by their language and content and saved in a best-effort Actions cache even when a later chunk fails. A rerun can resume this progress; changed narration cannot reuse a chunk from different text. Partial output never replaces a recording. The readiness manifest and public recordings are still committed only after all six recordings pass verification. Provider availability and cache retention are not guaranteed.

## Current limitations

The 25 October archive has shorter Malayalam reporting, Italian lead summaries, and historical market/weather content. The 26 October catch-up supplies detailed content for all six desks in all three languages. It explicitly omits unverified historical price series and a Sesto alert table rather than carrying old data forward. Its measured length is shorter than the former English long-read target. Recordings follow the actual supplied text in each language. Physical phone sound output, screen-off playback and deployed Cloudflare notifications still need separate verification. These are not release claims.
