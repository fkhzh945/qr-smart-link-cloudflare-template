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

### 2. Configure one Setup Token

First-time installation requires the owner to configure **only `SETUP_TOKEN`** as an encrypted Cloudflare Worker Secret, either in the authenticated installer if prompted or afterward under the new Worker's Settings → Variables and Secrets. Generate a unique random token (for example `openssl rand -hex 32` in a trusted terminal), and keep it private for the initial administrator claim. Never use placeholder values or share credentials.

The standard `npm run deploy` command now creates missing **`SESSION_SECRET`** and **`ACTIVATION_SECRET`** automatically after deployment. It detects the actual Worker from the successful Wrangler output and preserves both values on repeat deployments. If the target cannot be established or Cloudflare Secret permissions are missing, deployment reports an error rather than writing to an assumed Worker.

The build credential must be allowed to manage Worker secrets. Look for deployment stage `[4/4] Installing missing runtime secrets` and `generated and installed` or `preserved` messages (never secret values). This flow has passed local checks and mocked Worker-name recognition but **still requires a fresh Cloudflare end-to-end acceptance run**.

Do not rotate runtime secrets during routine updates: existing sessions and issued activation codes can become invalid. The owner still must supply the Setup Token to claim the administrator account; first-visitor claims are forbidden.

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

Cloudflare's default deploy command may still require manual replacement, and the owner must configure the Setup Token. Fully unattended install and owner-only passwordless claim have **not** been implemented. The original private development repository and production instance remain separate.

## Interface languages

The public activation pages, administrator interface, feedback messages, and Element Plus controls support **10 languages**: Simplified Chinese, English, Portuguese, French, German, Italian, Japanese, Korean, Dutch, and Spanish. Language preferences are saved in the browser and browser language is detected on first visit.

## Vercel free deployment feasibility

Vercel Hobby + Neon Free is a potential route for **personal, non-commercial testing only**. This Cloudflare Workers/D1 backend has **not** yet been ported to Vercel and is not a working one-click Vercel deployment. Vercel Hobby disallows commercial usage; business installations should continue using the Cloudflare option or a suitable paid plan. See the [Vercel feasibility and migration checklist](docs/VERCEL_FREE_DEPLOY_FEASIBILITY.md).
