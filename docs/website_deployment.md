# Website deployment

The website is deployed together with the backend: `npm run build` produces `website/dist`, and the backend serves it when `STATIC_DIR` points there. See `deployment_guide.md`. **No public deployment has been made.**

Alternative: serve `website/dist` from a static host or CDN and proxy `/api` to the backend on the same origin. The API's CSRF/Origin checks and SameSite cookies assume one origin. For a split origin, set `ADDITIONAL_ORIGINS` and make sure the cookie is still first-party.

Build-time variables: `SITE_URL` (canonical, OG, sitemap). Cache policy: the backend uses @fastify/static defaults (ETag/Last-Modified revalidation). Behind a CDN, hashed assets under `/assets/` can be cached for a year (`immutable`), but HTML and `sw.js` should not be cached long. After a release, the service worker cache name (`billkit-shell-v1`) should be bumped so installed PWAs pick up the new shell.

© 2026 Shaik Gouse Kareem. All rights reserved.
