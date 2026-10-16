import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const target = process.env.QR_TEMPLATE_WORKER_NAME;
if (!target || !/^[a-z0-9][a-z0-9-]{1,61}$/.test(target)) {
  console.error('Set QR_TEMPLATE_WORKER_NAME to the exact Cloudflare Worker name. No secrets changed.');
  process.exit(2);
}
if (!config.d1_databases?.some(db => db.binding === 'DB' && db.database_name?.endsWith('-template-db'))) {
  throw new Error('Refusing non-template database configuration');
}
if (process.env.QR_TEMPLATE_CONFIRM_PROVISION !== target) {
  console.error('Set QR_TEMPLATE_CONFIRM_PROVISION equal to the target Worker name. No secrets changed.');
  process.exit(2);
}
const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function run(args, input) {
  const result = spawnSync(cli, ['--no-install', 'wrangler', ...args], {
    input, encoding: 'utf8', maxBuffer: 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  if (result.status !== 0) throw new Error('Wrangler command failed; check Cloudflare authorization and Worker name');
  return result.stdout;
}
const raw = run(['secret', 'list', '--name', target]);
const start = raw.indexOf('['), end = raw.lastIndexOf(']');
if (start === -1 || end < start) throw new Error('Cannot parse secret name list; refusing to modify secrets');
const items = JSON.parse(raw.slice(start, end + 1));
if (!Array.isArray(items)) throw new Error('Unexpected secret list result');
const existing = new Set(items.map(item => item.name));
for (const name of ['SESSION_SECRET', 'ACTIVATION_SECRET']) {
  if (existing.has(name)) {
    console.log(name + ': already configured, preserved');
    continue;
  }
  const secret = randomBytes(48).toString('base64url');
  run(['secret', 'put', name, '--name', target], secret + '\n');
  console.log(name + ': securely created for target Worker');
}
console.log('SETUP_TOKEN remains administrator-supplied until a verified owner-only claim channel is available.');
