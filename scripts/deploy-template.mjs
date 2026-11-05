import { workerNameFromDeployOutput, ensureRuntimeSecrets } from './runtime-secrets.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveInstanceIdentity } from './instance-identity.mjs';
import { execFileSync } from 'node:child_process';

const configPath = 'wrangler.jsonc';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const database = config.d1_databases?.find(item => item.binding === 'DB');
const preview = process.argv.includes('--check-config');
if (!database) throw new Error('Missing D1 DB binding');
const legacyName = 'qr-smart-link-lite-template-db';
const priorName = database.database_name;
const identity = await resolveInstanceIdentity(process.env, { preview });
const instanceKey = identity.key;
if (instanceKey && !/^[a-zA-Z0-9_.\/-]{3,160}$/.test(instanceKey)) throw new Error('Invalid instance identity');
const computedName = instanceKey ? 'qrsl-' + createHash('sha256').update(instanceKey).digest('hex').slice(0, 20) + '-template-db' : '';
const name = instanceKey ? computedName : priorName;
if (!instanceKey && process.env.WORKERS_CI && !preview) throw new Error('Cannot verify stable instance identity. Refusing shared D1: configure an authorized Workers Builds metadata API token or QR_TEMPLATE_INSTANCE_ID.');
if (instanceKey && priorName !== legacyName && priorName !== computedName) throw new Error('D1 instance binding does not match this deployment identity');
if (!instanceKey && priorName !== legacyName && !/^qrsl-[a-f0-9]{20}-template-db$/.test(priorName)) throw new Error('Unknown D1 database identity');
if (!name || !name.endsWith('-template-db')) throw new Error('Refusing to provision a non-template D1 database');
if (config.name !== 'qr-smart-link-lite-template') throw new Error('Refusing to deploy under a non-template Worker name');
if (config.d1_databases.length !== 1) throw new Error('Expected exactly one D1 binding');
if (preview) {
  console.log('Deployment config OK (instance identity:', instanceKey ? 'present' : 'legacy', '); no cloud resources were changed.');
  process.exit(0);
}

function wrangler(args) {
  return execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
function list() {
  const raw = wrangler(['d1', 'list', '--json']);
  const start = raw.indexOf('['), end = raw.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('Could not parse D1 list; stopping without deployment');
  const found = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(found)) throw new Error('Unexpected D1 list format');
  return found;
}
console.log('[1/4] Checking isolated D1 database');
if (!instanceKey) console.warn('LEGACY MODE: default database retained for compatibility. For NEW installations, require verified instance identity.');
let matches = list().filter(item => item.name === name);
if (matches.length > 1) throw new Error('Ambiguous D1 database name; refusing deployment');
if (matches.length === 0) {
  console.log('Creating isolated D1 database:', name);
  wrangler(['d1', 'create', name, '--update-config=false']);
  matches = list().filter(item => item.name === name);
}
const id = matches[0]?.uuid ?? matches[0]?.id;
if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id ?? ''))
  throw new Error('D1 ID not found after provisioning');
database.database_name = name;
database.database_id = id;
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('[2/3] D1 database ready; applying pending migrations');
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote'], { stdio: 'inherit' });
console.log('[3/4] Publishing Worker');
const output = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install', 'wrangler', 'deploy'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
process.stdout.write(output);
const deployedWorker = workerNameFromDeployOutput(output);
console.log('[4/4] Installing missing runtime secrets for the deployed Worker');
ensureRuntimeSecrets(deployedWorker);
