# Daily Intelligence backend

GitHub Pages serves the newspaper and installable app. The existing Cloudflare Worker `daily-intelligence-api` supplies local RSS headlines and opt-in daily Web Push reminders. No paid API, paid plan, or content-generation service is required by this code.

## Current setup and deployment

The deployed URL is `https://daily-intelligence-api.moolanemanuelethomas.workers.dev`. The app uses this by default, including for older saved preferences with an empty service URL.

Source changes in this repository do **not** by themselves update the Worker. Deploy the source and verify its environment separately. Preserve the existing `SUBSCRIPTIONS` KV binding: before `wrangler deploy`, uncomment the `[[kv_namespaces]]` block in `wrangler.toml` and insert the ID of the **existing** bound namespace. Do not create a replacement namespace. Its ID is an account-specific deployment setting and has not been guessed here.

The source configuration declares the hourly cron `0 * * * *`. This is not proof that a live trigger exists. Check Settings → Trigger Events in Cloudflare after deployment; allow Cloudflare's trigger propagation period, then verify a scheduled invocation in logs.

## Secure VAPID setup

On a computer already signed into Cloudflare with Wrangler installed, run from this directory:

```sh
node scripts/configure-vapid.mjs
```

The script checks for an existing public key and refuses automatic rotation. It generates a P-256 pair in memory, verifies a signature with the matching public key, and pipes all three settings directly to `wrangler secret bulk --name daily-intelligence-api`. It does not write private key files, put private values in command arguments, or print private material. It verifies the live public key and `pushEnabled` response afterward. Do not rerun after a partial failure without checking the current Worker configuration.

Settings: `VAPID_PUBLIC_KEY` is the uncompressed 65-byte point encoded as base64url; `VAPID_PRIVATE_JWK` is its private signing JWK; `VAPID_SUBJECT` is the app's HTTPS contact URL. Only the public key is returned by `/api/config`. Never put private values in GitHub, Pages, screenshots, or chat.

## Behavior and tests

```sh
node --test test/worker.test.mjs
```

Tests use ephemeral cryptographic keys, in-memory KV, and mocked upstream responses. They verify VAPID JWT signatures, subscription validation and storage, unsubscribe key matching, schedule timing, expired-subscription cleanup, provider failures, and RSS fallback. They do **not** verify Cloudflare's runtime limits, actual KV, Cron activation, third-party news availability, or browser push delivery.

- Hourly scheduling sends at the first tick at or after the chosen local time, usually within 60 minutes. Fractional-offset zones and midnight rollover are handled. Browser delivery can be later. KV's eventual consistency means exactly-once delivery is not guaranteed.
- `/api/subscribe` saves preferences, retaining the last delivery date when edited. `/api/unsubscribe` removes the record using the browser subscription's endpoint and keys. Push destinations are limited to supported Chrome/Firefox/Safari providers, with redirects disabled.
- `/api/local?city=...` tries Google News RSS, then Bing News RSS if unavailable or invalid. RSS calls have timeouts and edge-cache hints. Availability and relevance are not guaranteed. English source headlines are not translated or rewritten.
- The notification is an empty Web Push with a generic reminder displayed by `sw.js`. It does not imply a new newspaper was generated; publishing new editions is a separate process.
- This is a small personal/family service. It scans subscriptions hourly and has not been load-tested. Workers and KV free quotas apply; keep the account on Free. No upgrade is enabled by these changes. A wider release needs abuse controls, retention rules, and operational testing.

## Live acceptance checklist

1. GET `/api/config`: expect the intended public key and `pushEnabled: true`.
2. GET `/api/local?city=Sesto%20San%20Giovanni%2C%20Italy`: expect HTTP 200, a provider, and usable source-linked headlines. Check Rome as another city. Empty results are not evidence of relevant local news.
3. From the GitHub Pages origin, grant browser notification permission and enable reminders. Verify POST `/api/subscribe` succeeds and a `sub:` record exists in the bound KV namespace.
4. Use a reminder time whose next hourly tick can be observed. Verify the scheduled invocation and successful push response, then receipt on the subscribed device. Only device receipt verifies delivery.
5. Stop notifications. Verify POST `/api/unsubscribe` succeeds, the KV record is removed, and the browser subscription is gone.

At the last live check during setup, `/api/config` returned `pushEnabled: false` and the local-news endpoint returned an unavailable-feed error. Cloudflare account sign-in was blocked, so secrets, live trigger configuration, deployment of the fixes, and end-to-end notification delivery remain unverified.
