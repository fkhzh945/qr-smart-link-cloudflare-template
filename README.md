# QR Smart Link Lite — Cloudflare Deployment Template

[简体中文](README_zh.md) | **English**

Self-hosted dynamic QR code management, including QR batch printing, mobile activation, redirects and an administrator dashboard.

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fkhzh945/qr-smart-link-cloudflare-template)

This public repository is a dedicated deployment template. The original application development repository remains private.

### Before deploying

1. Have a Cloudflare account and connect GitHub to Cloudflare's deployment workflow.
2. Prepare three **different** randomly generated secrets. Use `openssl rand -hex 32` (three times) or another cryptographically secure generator.
3. In Cloudflare's deployment configuration, set `SETUP_TOKEN` (16+ characters), `SESSION_SECRET` (32+ characters), and `ACTIVATION_SECRET` (32+ characters). Never publish their values.
4. Confirm that Cloudflare provisions a **new D1 database** for this app. The zero-filled database ID in `wrangler.jsonc` is a template placeholder, not a production database ID.
5. Confirm the commands: **Build** `npm run build`; **Deploy** `npm run deploy`. The deploy script runs pending D1 migrations before deploying the Worker.
6. Open the new `workers.dev` URL and visit `/#/admin`. Initialize the administrator with your `SETUP_TOKEN`, email and a 12–128 character password. Keep this token private. It cannot be replaced by the admin password.

The Cloudflare Analytics quota dashboard is **optional**: it works without an Analytics token, but live statistics remain unavailable until the owner configures a read-only Analytics API token.

## Technical validation

```bash
npm ci
npm run check
npm test
npm run build
```

**Security:** Do not add real D1 database IDs, production secrets, customers' data or credentials to this template. The administrator account is intentionally single-user; there is no roles feature.

## Status

Deployment template prepared for a **separate Cloudflare account end-to-end acceptance test**. Do not describe this as a production-tested one-click installer until deployment from a public template has been verified.
