import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const configPath = 'wrangler.jsonc';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const database = config.d1_databases?.find(item => item.binding === 'DB');
if (!database) throw new Error('Missing D1 DB binding');
const name = database.database_name;
if (!name || !name.endsWith('-template-db')) throw new Error('Refusing to provision a non-template D1 database');
if (config.name !== 'qr-smart-link-lite-template') throw new Error('Refusing to deploy under a non-template Worker name');

function wrangler(args) {
  return execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
function list() {
  const raw = wrangler(['d1', 'list', '--json']);
  const start = raw.indexOf('['), end = raw.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('Could not parse D1 list; stopping without deployment');
  const found = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(found)) throw new Error('Unexpected D1 list format');
  return found;
}
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
database.database_id = id;
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('D1 binding prepared for isolated template database');
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote'], { stdio: 'inherit' });
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'deploy'], { stdio: 'inherit' });
