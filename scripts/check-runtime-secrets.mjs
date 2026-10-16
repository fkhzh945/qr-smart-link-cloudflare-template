import { execFileSync } from 'node:child_process';
const required = ['SETUP_TOKEN', 'SESSION_SECRET', 'ACTIVATION_SECRET'];
const run = (args) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
try {
  const output = run(['secret', 'list']);
  const first = output.indexOf('[');
  const last = output.lastIndexOf(']');
  if (first === -1 || last < first) throw new Error('Secret names unavailable');
  const items = JSON.parse(output.slice(first, last + 1));
  if (!Array.isArray(items)) throw new Error('Unexpected secret list');
  const names = new Set(items.map(x => x.name));
  const missing = required.filter(x => !names.has(x));
  if (missing.length) {
    console.warn('POST-DEPLOY ACTION REQUIRED: Configure these runtime Secret names in Cloudflare Settings:', missing.join(', '));
    console.warn('Use different cryptographically random values. Do not paste Secret values into build logs or support chats.');
  } else {
    console.log('Runtime Secret name check passed. Secret values were not read or displayed.');
  }
} catch {
  console.warn('Could not verify runtime Secret names. Check Worker Settings > Variables and Secrets manually.');
}
