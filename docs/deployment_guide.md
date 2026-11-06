# Deployment guide

> **Status:** BillKit has **not** been deployed to a public host as part of this delivery. These are the instructions for doing it; only local production builds were run.

## Single server (recommended starting point)

1. Get a Linux VM (2 vCPU / 2–4 GB RAM is enough for one OCR worker) with Node 22 LTS, and put it behind a reverse proxy with TLS (Caddy or nginx).
2. Build:
   ```bash
   npm ci && npm run build      # backend/dist/server.js + website/dist (prerendered pages)
   ```
3. Set the production environment (see `.env.example`):
   ```
   APP_ENV=production
   HOST=127.0.0.1
   PORT=8787
   PUBLIC_ORIGIN=https://your-domain
   STATIC_DIR=/srv/billkit/website/dist
   DATA_DIR=/var/lib/billkit
   TRUST_PROXY=true
   SITE_URL=https://your-domain     # at build time, for canonical/OG/sitemap
   ```
4. Run it under systemd (example unit):
   ```ini
   [Service]
   WorkingDirectory=/srv/billkit
   EnvironmentFile=/etc/billkit.env
   ExecStart=/usr/bin/node backend/dist/server.js
   User=billkit
   Restart=on-failure
   NoNewPrivileges=true
   ProtectSystem=strict
   ReadWritePaths=/var/lib/billkit
   ```
5. Reverse proxy (Caddy):
   ```
   your-domain {
     encode zstd gzip
     request_body { max_size 80MB }
     reverse_proxy 127.0.0.1:8787
   }
   ```
6. Grant yourself admin: `npm run admin:grant -- you@your-domain`.
7. Back up `DATA_DIR` every night (`sqlite3 .backup` plus `uploads/`) and test a restore.

## Checklist before going live

- [ ] HTTPS only; `COOKIE_SECURE` effective (the default in production)
- [ ] Real privacy policy and terms reviewed by a lawyer (the templates in `docs/legal/` are drafts)
- [ ] A real contact address in `CONTACT_TO_EMAIL` and in the site copy (no address is invented in the code)
- [ ] SMTP configured, or accept that password reset only works through an admin
- [ ] If cloud AI is enabled: the provider's data terms reviewed and the privacy page wording checked
- [ ] Disk encryption, firewall (only 80/443 open), OS updates, log rotation
- [ ] Monitoring of `/api/health` and disk space

## Scaling out

See `architecture.md` → *Scaling notes* (PostgreSQL, external queue, object storage).

© 2026 Shaik Gouse Kareem. All rights reserved.
