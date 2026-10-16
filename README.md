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
4. The deploy script creates or finds an **isolated template D1 database** named `qr-smart-link-lite-template-db` in your Cloudflare account and replaces the placeholder ID before migrations. D1 create/list/write permissions are needed for the Cloudflare build credential.
5. Set **Build** to `npm run build` and **Deploy** to `npm run deploy`. Deployment prepares the template D1 binding, applies migrations, then publishes the Worker.
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
