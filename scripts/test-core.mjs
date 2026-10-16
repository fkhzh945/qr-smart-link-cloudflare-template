import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from '../worker/src/index.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0002_activation.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0003_auth_lock.sql', import.meta.url), 'utf8'));
const adapter = {
  async batch(statements) {
    const results=[];
    for (const stmt of statements) results.push(await stmt.run());
    return results;
  },
  prepare(sql) {
    let params = [];
    return {
      bind(...args) { params = args; return this; },
      async first() { return db.prepare(sql).get(...params) ?? null; },
      async all() { return { results: db.prepare(sql).all(...params) }; },
      async run() {
        const info = db.prepare(sql).run(...params);
        return { meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
      }
    };
  }
};
const env = { DB: adapter, SETUP_TOKEN:'setup-token-for-testing-2026', SESSION_SECRET:'test-session-secret-at-least-32-characters-long', ACTIVATION_SECRET:'test-activation-secret-32-characters-long-2026' };
const url = 'https://qr-lite.example.test';
async function req(path, opts = {}) { return app.request(url + path, opts, env); }
async function json(path, body, cookie = '') {
  return req(path, { method:'POST', headers:{ 'content-type':'application/json', Origin:url, ...(cookie ? { Cookie:cookie } : {}) }, body: JSON.stringify(body) });
}
const status = await req('/api/setup/status');
assert.equal((await status.json()).initialized, false);
assert.equal((await json('/api/setup/initialize',{ setupToken:'invalid', email:'admin@test.com', password:'strongpassword123' })).status,403);
const init = await json('/api/setup/initialize',{ setupToken:env.SETUP_TOKEN, email:'admin@test.com', password:'strongpassword123' });
assert.equal(init.status,201);
const cookie = init.headers.get('set-cookie').split(';')[0];
assert.ok(cookie.startsWith('qr_lite_session='));
assert.equal((await req('/api/setup/status').then(r=>r.json())).initialized,true);
assert.equal((await json('/api/setup/initialize',{ setupToken:env.SETUP_TOKEN, email:'second@test.com',password:'strongpassword123' })).status,409);
assert.equal((await req('/api/auth/me')).status,401);
assert.equal((await req('/api/auth/me',{ headers:{ Cookie:cookie } })).status,200);
assert.equal((await req('/api/locations')).status,401);
const create = await req('/api/locations',{ method:'POST', headers:{Cookie:cookie,Origin:url,'content-type':'application/json'},body:JSON.stringify({name:'Los Angeles Store',remark:'test'}) });
assert.equal(create.status,201);
const list = await req('/api/locations',{headers:{Cookie:cookie}});
assert.equal((await list.json()).items[0].name,'Los Angeles Store');
const wrongOrigin = await req('/api/locations',{method:'POST',headers:{Cookie:cookie,Origin:'https://bad.example','content-type':'application/json'},body:JSON.stringify({name:'Rejected'})});
assert.equal(wrongOrigin.status,403);
const login = await json('/api/auth/login',{email:'admin@test.com',password:'strongpassword123'});
assert.equal(login.status,200);
const logout = await req('/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:url}});
assert.equal(logout.status,200);
const pending=await req('/q/INVALID');
assert.equal(pending.status,404);
async function authed(path, method='GET', body) {
  return req(path,{method,headers:{Cookie:cookie,Origin:url,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
assert.equal((await req('/api/cloudflare/usage')).status,401);
const freeUsage=await authed('/api/cloudflare/usage');
assert.equal(freeUsage.status,200);
const freeData=await freeUsage.json();
assert.equal(freeData.configured,false);
assert.equal(freeData.account.workersRequests,null);
assert.equal(freeData.account.d1RowsRead,null);
assert.equal(freeData.project.d1StorageBytes,null);
// Mock Cloudflare Analytics to verify account totals and project isolation without using a live token.
env.CLOUDFLARE_ACCOUNT_ID='a'.repeat(32);
env.CLOUDFLARE_ANALYTICS_TOKEN='read-only-token-for-test';
env.CLOUDFLARE_WORKERS_PLAN='free';
env.CLOUDFLARE_WORKER_NAME='qr-smart-link-lite';
env.DB_DATABASE_ID='a5278b8c-d442-49b9-aa95-c0d04ef8d480';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(endpoint,opts)=>{
 assert.equal(endpoint,'https://api.cloudflare.com/client/v4/graphql');
 assert.equal(opts.headers.Authorization,'Bearer read-only-token-for-test');
 const body=JSON.parse(opts.body);
 const records=body.query.includes('workersInvocationsAdaptive')
  ? {workersInvocationsAdaptive:[{dimensions:{scriptName:'qr-smart-link-lite'},sum:{requests:11}},{dimensions:{scriptName:'unrelated-app'},sum:{requests:5}}]}
  : {d1AnalyticsAdaptiveGroups:[{dimensions:{databaseId:env.DB_DATABASE_ID},sum:{rowsRead:21,rowsWritten:2}},{dimensions:{databaseId:'other-db'},sum:{rowsRead:10,rowsWritten:1}}]};
 return new Response(JSON.stringify({data:{viewer:{accounts:[records]}}}),{headers:{'Content-Type':'application/json'}});
};
try{
 const monitored=await authed('/api/cloudflare/usage');
 assert.equal(monitored.status,200);
 const metrics=await monitored.json();
 assert.equal(metrics.account.workersRequests,16);
 assert.equal(metrics.project.workersRequests,11);
 assert.equal(metrics.account.d1RowsRead,31);
 assert.equal(metrics.project.d1RowsRead,21);
 assert.equal(metrics.account.d1RowsWritten,3);
 assert.equal(metrics.project.d1RowsWritten,2);
 assert.equal(metrics.account.d1StorageBytes,null);
 assert.equal(metrics.limits.workersRequests,100000);
 assert.deepEqual(metrics.errors,[]);
}finally{
 globalThis.fetch=originalFetch;
 for(const key of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ANALYTICS_TOKEN','CLOUDFLARE_WORKERS_PLAN','CLOUDFLARE_WORKER_NAME','DB_DATABASE_ID'])delete env[key];
}
const shared = await authed('/api/batches','POST',{batchName:'Shared print',quantity:50,qrMode:'SHARED'});
assert.equal(shared.status,201);
const unique = await authed('/api/batches','POST',{batchName:'Unique print',quantity:3,qrMode:'UNIQUE'});
assert.equal(unique.status,201);
const batchList=(await (await authed('/api/batches')).json()).items;
assert.equal(batchList.length,2);
const sharedBatch=batchList.find(x=>x.qr_mode==='SHARED'),uniqueBatch=batchList.find(x=>x.qr_mode==='UNIQUE');
assert.equal((await authed('/api/batches/'+sharedBatch.id+'/status','POST',{status:'SHIPPED'})).status,409);
assert.equal((await authed('/api/batches/'+sharedBatch.id+'/status','POST',{status:'PRINTED'})).status,200);
assert.equal((await authed('/api/batches/'+sharedBatch.id+'/status','POST',{status:'PRINTED'})).status,409);
assert.equal((await authed('/api/batches/'+sharedBatch.id+'/status','POST',{status:'SHIPPED'})).status,200);
assert.equal((await authed('/api/batches/'+sharedBatch.id+'/status','POST',{status:'PRINTED'})).status,409);
assert.equal((await authed('/api/batches/'+sharedBatch.id+'/status','POST',{status:'SHIPPED'})).status,409);
const sharedCodes=(await (await authed('/api/qrs?batchId='+sharedBatch.id)).json()).items;
const uniqueCodes=(await (await authed('/api/qrs?batchId='+uniqueBatch.id)).json()).items;
assert.equal(sharedCodes.length,1);
assert.equal(uniqueCodes.length,3);
const first=uniqueCodes[0];
const lookup=await json('/public/lookup',{shortCode:first.short_code});
assert.equal(lookup.status,200);
assert.deepEqual(await lookup.json(),{found:true});
const absent=await json('/public/lookup',{shortCode:'ZZZZZZZ'});
assert.deepEqual(await absent.json(),{found:false});
assert.deepEqual(await (await json('/public/lookup',{shortCode:'bad'})).json(),{found:false});
assert.equal((await authed('/api/qrs/bulk-activate','POST',{ids:[first.id]})).status,409);
const svg=await authed('/api/qrs/'+first.id+'/qrcode.svg');
assert.equal(svg.status,200);
assert.ok((await svg.text()).includes(first.short_code+'</text>'));
const zip=await authed('/api/batches/'+uniqueBatch.id+'/qrcodes.zip');
assert.equal(zip.status,200);
const JSZip=(await import('jszip')).default;
const z=await JSZip.loadAsync(await zip.arrayBuffer());
assert.equal(Object.keys(z.files).length,4);
const csv=await z.file('mapping.csv').async('string');
assert.ok(csv.includes('/q/'+first.short_code));
assert.equal((await authed('/api/qrs/bulk-assign','POST',{ids:[first.id],locationId:1})).status,200);
assert.equal((await authed('/api/qrs/bulk-target','POST',{ids:[first.id],targetUrl:'https://www.starayx.com',targetType:'Website'})).status,200);
assert.equal((await authed('/api/qrs/bulk-activate','POST',{ids:[first.id]})).status,200);
const redirected=await req('/q/'+first.short_code);
assert.equal(redirected.status,302);
assert.equal(redirected.headers.get('location'),'https://www.starayx.com/');
assert.equal(redirected.headers.get('cache-control'),'no-store');
assert.equal((await authed('/api/qrs/'+first.id+'/status','POST',{status:'DISABLED'})).status,200);
assert.equal((await req('/q/'+first.short_code)).status,200);
const bulk=await authed('/api/qrs/bulk-activation-codes','POST',{ids:[first.id,uniqueCodes[1].id]});
assert.equal(bulk.status,200);
const issuedCsv=await bulk.text();
assert.ok(issuedCsv.includes(first.short_code+','));
assert.ok(issuedCsv.includes(uniqueCodes[1].short_code+','));
assert.equal(issuedCsv.trim().split('\n').length,3);
assert.equal((await req('/api/qrs/bulk-activation-codes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[first.id]})})).status,401);
assert.equal((await authed('/api/qrs/bulk-activation-codes','POST',{ids:[first.id,first.id]})).status,400);
const issue=await authed('/api/qrs/'+first.id+'/activation-code','POST',{});
assert.equal(issue.status,200);
const issuedCode=(await issue.json()).activationCode;
assert.equal(issuedCode.length,16);
assert.equal((await req('/api/qrs/'+first.id+'/activation-code',{method:'POST'})).status,401);
const publicActivate=(code,target)=>json('/public/activate',{shortCode:first.short_code,activationCode:code,targetUrl:target});
const badUrl=await publicActivate('BADCODE12345678','notaurl');
assert.equal(badUrl.status,400);assert.equal((await badUrl.json()).code,'INVALID_URL');
const badFormat=await publicActivate('BAD','https://starayx.com');
assert.equal(badFormat.status,400);assert.equal((await badFormat.json()).code,'INVALID_ACTIVATION_CODE');
assert.equal((await publicActivate('ABCD2345EFGH6789','https://starayx.com')).status,403);
assert.equal((await publicActivate(issuedCode,'https://starayx.com')).status,200);
assert.equal((await req('/q/'+first.short_code)).headers.get('location'),'https://starayx.com/');
const reset=await authed('/api/qrs/'+first.id+'/activation-code','POST',{});
const replacement=(await reset.json()).activationCode;
assert.equal((await publicActivate(issuedCode,'https://starayx.com/old')).status,403);
assert.equal((await publicActivate(replacement,'https://starayx.com/new')).status,200);
assert.equal((await req('/q/'+first.short_code)).headers.get('location'),'https://starayx.com/new');
const exposed=(await (await authed('/api/qrs')).json()).items[0];
assert.ok(!Object.hasOwn(exposed,'activation_hash'));
assert.ok(!Object.hasOwn(exposed,'activation_failures'));
const afterBad=await db.prepare('SELECT activation_failures FROM qr_codes WHERE id=?').get(first.id);
for(let i=0;i<5;i++)assert.equal((await publicActivate('ABCD2345EFGH6789','https://starayx.com')).status,403);
assert.equal((await publicActivate('ABCD2345EFGH6789','https://starayx.com')).status,429);
for(let i=0;i<5;i++)assert.equal((await json('/api/auth/login',{email:'admin@test.com',password:'bad-password'})).status,401);
assert.equal((await json('/api/auth/login',{email:'admin@test.com',password:'strongpassword123'})).status,429);
console.log('Security regression: protected fields, activation throttling and login lock passed.');
console.log('Auth, QR batches, ZIP, admin-issued activation codes, self-service activation and redirect tests passed.');

[executed on device: LAPTOP-96QI0EC3 (2df899ff-6916-4249-9617-10636bdf2880)]
