import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function wrangler(args, input) {
  const result = spawnSync(cli, ['--no-install', 'wrangler', ...args], {
    input, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  if (result.error || result.status !== 0) throw new Error('Worker secret operation failed; verify Cloudflare build permissions');
  return result.stdout;
}
export function workerNameFromDeployOutput(output) {
  const found = [...output.matchAll(/(?:^|\n)Deployed\s+([a-z0-9][a-z0-9-]{1,61})\s+triggers\b/g)].map(m => m[1]);
  if (found.length !== 1) throw new Error('Could not uniquely identify deployed Worker; refusing to write secrets');
  return found[0];
}
export function ensureRuntimeSecrets(name, run = wrangler) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}$/.test(name)) throw new Error('Invalid Worker name');
  const raw = run(['secret', 'list', '--name', name]);
  const first = raw.indexOf('['), last = raw.lastIndexOf(']');
  if (first < 0 || last < first) throw new Error('Cannot parse Worker secrets; refusing to write');
  const list = JSON.parse(raw.slice(first, last + 1));
  if (!Array.isArray(list) || list.some(s => typeof s.name !== 'string')) throw new Error('Unexpected Worker secret response');
  const names = new Set(list.map(s => s.name));
  // Never overwrite a configured secret: changing activation signing keys can break issued codes.
  if (!names.has('SETUP_TOKEN')) console.warn('ACTION REQUIRED: set SETUP_TOKEN once in Worker runtime Secrets before administrator initialization.');
  for (const secretName of ['SESSION_SECRET', 'ACTIVATION_SECRET']) {
    if (names.has(secretName)) {
      console.log(secretName + ': preserved');
      continue;
    }
    const value = randomBytes(48).toString('base64url') + '\n';
    run(['secret', 'put', secretName, '--name', name], value);
    console.log(secretName + ': generated and installed');
  }
}
