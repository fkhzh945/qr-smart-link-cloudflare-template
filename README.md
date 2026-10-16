# QR Smart Link Lite — Cloudflare Deployment Template

**English** · [简体中文](README_zh.md) · Deployment template V0.2 RC (application API version remains 0.1.0)

A lightweight, single-administrator dynamic QR service with production batches, SVG/ZIP exports, activation codes, mobile self-activation, URL redirects and dashboard metrics. There is no roles or subaccounts feature.

## Install on Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fkhzh945/qr-smart-link-cloudflare-template)

**Validated route:** Cloudflare → Workers & Pages → Create application → **Import a GitHub repository** → choose `fkhzh945/qr-smart-link-cloudflare-template` on `main`. If the button reports that it cannot fetch repository contents, import using the connected GitHub repository **picker**, not the Git URL clone entry.

### 1. Build and deploy

| Setting | Value |
| --- | --- |
| Worker name | Your choice, e.g. `qr-smart-link-cloudflare` |
| Branch | `main` |
| Root directory | Repository root `/` |
| Build command | `npm run build` |
| **Deploy command** | **`npm run deploy` (required)** |

Cloudflare sometimes defaults to `npx wrangler deploy`. **Replace it**: the default bypasses the template's D1 provisioning and migrations. The correct flow executes `node scripts/deploy-template.mjs` and reports D1 lookup/creation, migrations and Worker publish stages. The build credential needs permission to list/create/read/write D1.

Deployment creates or reuses D1 `qr-smart-link-lite-template-db` within the selected Cloudflare account, sets its actual ID for that build, applies migrations and deploys the Worker. It never uses the original production database ID. **Multiple installations in the same Cloudflare account may reuse the same D1**: use distinct accounts for tenant isolation unless you explicitly customize database naming.

### 2. Set runtime secrets

Under the **new Worker's** Settings → Variables and Secrets, configure the following three encrypted **Secret** values. If the authenticated Cloudflare install wizard already prompted for and installed them, do not add them again.

| Name | Purpose |
| --- | --- |
| `SETUP_TOKEN` | Unique cryptographic random value, ideally 32+ characters; required for the first administrator claim |
| `SESSION_SECRET` | Different random value, at least 32 characters; signs administrator sessions |
| `ACTIVATION_SECRET` | Another different random value, at least 32 characters; protects activation codes |

For example, generate three **independent** values with `openssl rand -hex 32` in a trusted terminal. Never use sample values from `.dev.vars.example`, commit secrets, post them in support chats or expose them in screenshots. Do **not rotate** session or activation secrets on a routine redeployment; that can invalidate sessions or existing activation codes.

**These secrets are not generated automatically by the normal deploy flow yet.** Optional advanced `npm run setup:secrets` requires explicit Worker targeting and confirmation and only fills missing session/activation secrets; it does not issue the administrator Setup Token.

### 3. Claim the first administrator

Visit `https://YOUR-WORKER-URL/#/admin`; enter your private `SETUP_TOKEN`, administrator email, and password of **12–128 characters**. Only one administrator is supported. Subsequent sign-in uses email/password; password change requires the old password.

Being signed into Cloudflare does **not** automatically authenticate the owner to the public Worker page. First-visitor-admin claims are deliberately disabled.

### 4. Acceptance checks

1. `/health` returns `ok: true`; after admin setup, `/api/setup/status` reports `initialized: true`.
2. Create a small 3-code test batch and verify ZIP contents (QR images and mapping CSV).
3. Issue a code, activate from a phone, set the destination URL, and rescan to verify the redirect.
4. Confirm dashboard counters, preserve secrets and D1 contents across repeat deployments, and back up important data before changes.

Cloudflare Analytics usage metrics are optional; missing read-only Analytics credentials do not affect core QR functions.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Cannot fetch repository contents | Use the Cloudflare **GitHub repository picker** and authorize the repository |
| `npm ci` / missing lockfile | Use latest `main`, repository-root build directory, intact `package-lock.json` |
| `EndOfFileExpected` | Refresh from the latest valid `wrangler.jsonc` |
| D1 zero UUID / `10181` / `7400` | Set Deploy command to **`npm run deploy`**, not `npx wrangler deploy` |
| Worker name mismatch | Verify your selected Cloudflare project and target |
| Setup Token not configured | Add `SETUP_TOKEN` as a runtime Secret on the correct Worker |
| Analytics usage unavailable | Optional Analytics token is missing; core functions still work |

## Developer validation

```bash
npm ci
npm run deploy:check
npm run check
npm test
npm run build
```

`deploy:check` validates configuration locally without changing Cloudflare resources. `setup:check` lists only Secret **names** on the configured Wrangler target and never prints their values. Confirm the target Worker before any remote command.

See [Deployment acceptance and troubleshooting](docs/DEPLOYMENT_ACCEPTANCE_V0.2_RC.md).

## Release status

As of 2026-10-16, the user confirmed **a successful deployment, administrator initialization and QR activation/redirect business acceptance** on the independent instance [qr-smart-link-cloudflare.myqrcode.workers.dev](https://qr-smart-link-cloudflare.myqrcode.workers.dev/). This does not imply zero-configuration verification across all Cloudflare accounts or installer routes.

Cloudflare's default deploy command may still require manual replacement, and secure runtime secrets still require configuration. Fully unattended install and owner-only passwordless claim have **not** been implemented. The original private development repository and production instance remain separate.
