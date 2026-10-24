# Personalized news and morning notifications backend

The public newspaper remains on GitHub Pages. This optional Cloudflare Worker supplies city-specific live news links and opt-in Web Push. **It is not deployed or active until configured in your Cloudflare account.**

## Deployment
1. Create a Cloudflare account and install Wrangler (Node.js): `npm install -g wrangler && wrangler login`.
2. Create KV storage: `wrangler kv namespace create SUBSCRIPTIONS`; insert the returned namespace ID into `wrangler.toml` and uncomment the KV binding.
3. Generate a VAPID P-256 key pair with a reputable Web Push library. Set the uncompressed P-256 public key in base64url as `VAPID_PUBLIC_KEY`, private signing JWK JSON as `VAPID_PRIVATE_JWK`, and `VAPID_SUBJECT` as a `mailto:` contact. Use `wrangler secret put VAPID_PUBLIC_KEY`, `wrangler secret put VAPID_PRIVATE_JWK`, `wrangler secret put VAPID_SUBJECT`.
4. From `backend/`, run `wrangler deploy`. Copy the resulting `https://...workers.dev` URL into the website's API configuration.
5. Use an Android Chrome installed PWA, grant notifications, and subscribe. The hourly cron sends a push in the selected local hour (not exact minute). The browser may delay or suppress delivery.

## Limitations
- City news uses Google News RSS search results; it does **not** generate verified, deeply reported articles. Headlines are linked to their original sources.
- Push uses **empty Web Push** with a generic notification rendered by the service worker; no personal data in notification payload.
- KV has eventual consistency; a tiny chance of duplicate pushes exists if overlapping scheduled runs occur.
- Endpoint accepts anonymous subscriptions; production service should add rate limiting, consent logging, unsubscribe endpoint, data retention/deletion, authentication as needed, and privacy policy before broad release.
- RSS availability and third-party usage terms can change.
- Personalized deep articles and multilingual audio require an additional content-generation pipeline and editorial review.
- No paid OpenAI API is configured.
