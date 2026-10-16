import assert from 'node:assert/strict';
import { ensureRuntimeSecrets, workerNameFromDeployOutput } from './runtime-secrets.mjs';

assert.equal(workerNameFromDeployOutput('Uploaded qr-demo (1s)\nDeployed qr-demo triggers (2s)'), 'qr-demo');
assert.throws(() => workerNameFromDeployOutput('Uploaded qr-demo (1s)'), /uniquely/);
assert.throws(() => workerNameFromDeployOutput('Deployed a triggers\nDeployed b triggers'), /uniquely/);

const actions = [];
function firstRun(args, input) {
  actions.push({ args, input });
  if (args[1] === 'list') return JSON.stringify([{ name: 'SETUP_TOKEN' }]);
  return '';
}
ensureRuntimeSecrets('qr-demo', firstRun);
const puts = actions.filter(x => x.args[1] === 'put');
assert.deepEqual(puts.map(x => x.args[2]), ['SESSION_SECRET','ACTIVATION_SECRET']);
assert.ok(puts.every(x => x.args[4] === 'qr-demo'));
assert.ok(puts.every(x => x.input.length > 40));
assert.notEqual(puts[0].input, puts[1].input);

const repeat = [];
ensureRuntimeSecrets('qr-demo', (args, input) => {
  repeat.push({args,input});
  if (args[1] === 'list') return JSON.stringify([{name:'SETUP_TOKEN'},{name:'SESSION_SECRET'},{name:'ACTIVATION_SECRET'}]);
  throw Error('Must never overwrite');
});
assert.equal(repeat.length, 1);
assert.throws(() => ensureRuntimeSecrets('qr-demo', () => 'invalid'), /parse/);
assert.throws(() => ensureRuntimeSecrets('bad name', () => ''), /Invalid Worker/);
console.log('Runtime Secret auto-provision regression tests passed (mock only; no Cloudflare changes).');
