# Daily Intelligence — simplified deployment

## Responsibilities

- **GitHub Pages**: serves the existing newspaper HTML, app shell, audio, manifest and service worker.
- **GitHub Actions**: publishes the daily newspaper; publishing must not call the paid OpenAI API unless explicitly enabled.
- **Cloudflare Worker + KV**: stores push subscriptions and sends scheduled reminders. It must not generate or translate news.

## Current implementation blockers (verified from repository)

1. `backend/src/worker.js` sends a zero-byte push request with VAPID authentication, but standard browser Web Push requires encrypted payloads for reliable delivery. Implement RFC 8291 payload encryption and test a real subscription before enabling reminders.
2. The Worker exposes `/api/local` and fetches Google News RSS. Move local-news fetching to a separate, explicitly selected public-data approach before deleting this endpoint, to avoid breaking the existing homepage.
3. The frontend requires manually entering the Worker URL. Configure the deployed HTTPS URL centrally after verifying the actual hostname.
4. The frontend unsubscribe button only unsubscribes locally. Add authenticated-by-endpoint subscription deletion and remove the corresponding KV record.
5. `backend/wrangler.toml` declares hourly cron, but the KV namespace binding is commented out. Align checked-in Wrangler configuration with the existing production binding before deploying from source.
6. The scheduler matches only the preferred hour. Display this limitation to users or implement finer-grained scheduling.
7. `/api/config` reports configured variables but does not prove push delivery works. Verify a real push notification on a supported device.

## Secure setup

- Generate one P-256 VAPID key pair locally; do not commit private keys.
- Store `VAPID_PUBLIC_KEY` as a Worker variable.
- Store matching `VAPID_PRIVATE_JWK` as a **secret**; it must be a valid private P-256 JWK.
- Set `VAPID_SUBJECT` to a valid `mailto:` contact.
- Confirm `SUBSCRIPTIONS` KV binding in production and source configuration.
- Confirm hourly cron in the deployed Worker dashboard.
- Keep automatic paid API usage and auto-reload disabled.

## Acceptance tests

- Existing published newspaper HTML is unchanged and loads on GitHub Pages.
- Worker `/api/config` reports enabled only after configuration.
- New push subscription is saved in KV.
- Test push is received with the app closed on a supported device.
- Scheduled push sends no more than once per local calendar day.
- Unsubscribe removes the KV record.
- An invalid/expired subscription is cleaned up.
- No paid service is enabled without explicit approval.

**Do not deploy the current Worker as a verified push solution until encryption and device testing are complete.**
