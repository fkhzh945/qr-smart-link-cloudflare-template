const encoder = new TextEncoder();
const chars='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const bytesFromHex=s=>new Uint8Array(s.match(/.{2}/g).map(v=>parseInt(v,16)));
export function newActivationCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>chars[b%chars.length]).join('');
}
async function macKey(env) {
  if (typeof env.ACTIVATION_SECRET !== 'string' || env.ACTIVATION_SECRET.length<32) throw new Error('ACTIVATION_SECRET not configured');
  return crypto.subtle.importKey('raw',encoder.encode(env.ACTIVATION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function activationHash(env,code) {
  return hex(await crypto.subtle.sign('HMAC',await macKey(env),encoder.encode(code)));
}
export async function verifyActivation(env,code,hash) {
  if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)||!/^[a-f0-9]{64}$/.test(hash||'')) return false;
  return crypto.subtle.verify('HMAC',await macKey(env),bytesFromHex(hash),encoder.encode(code));
}
export function validTarget(value) {
  try {const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.')&&value.length<=2048&&!['example.com','example.org','example.net'].includes(u.hostname);}
  catch {return false;}
}
const result=(c,body,status=200)=>c.json(body,status,{'Cache-Control':'no-store'});
export function registerActivation(app) {
  app.post('/public/lookup',async c=>{
    const origin=c.req.header('Origin');
    if(origin && origin!==new URL(c.req.url).origin)return result(c,{error:'Forbidden'},403);
    const contentLength=Number(c.req.header('Content-Length')||0);
    if(contentLength>1024)return result(c,{error:'Invalid request'},413);
    const body=await c.req.json().catch(()=>({}));
    const short=String(body.shortCode||'').trim().toUpperCase();
    if(!/^[A-Z0-9]{7}$/.test(short))return result(c,{found:false});
    const row=await c.env.DB.prepare('SELECT id FROM qr_codes WHERE short_code=?').bind(short).first();
    return result(c,{found:Boolean(row)});
  });
  app.post('/public/activate',async c=>{
    const origin=c.req.header('Origin');
    if(origin&&origin!==new URL(c.req.url).origin)return result(c,{error:'Forbidden'},403);
    const body=await c.req.json().catch(()=>({}));
    const short=String(body.shortCode||'').trim().toUpperCase();
    const token=String(body.activationCode||'').trim().toUpperCase();
    const url=String(body.targetUrl||'').trim();
    if(!/^[A-Z0-9]{7}$/.test(short))return result(c,{error:'Invalid short code',code:'INVALID_SHORT_CODE'},400);
    if(!validTarget(url))return result(c,{error:'Invalid URL',code:'INVALID_URL'},400);
    if(!/^[A-HJ-NP-Z2-9]{16}$/.test(token))return result(c,{error:'Invalid activation code',code:'INVALID_ACTIVATION_CODE'},400);
    const row=await c.env.DB.prepare('SELECT id,activation_hash,activation_failures,activation_locked_until FROM qr_codes WHERE short_code=?').bind(short).first();
    if(!row||!row.activation_hash)return result(c,{error:'Invalid activation credentials',code:'INVALID_CREDENTIALS'},403);
    const now=Math.floor(Date.now()/1000);
    if(row.activation_locked_until>now)return result(c,{error:'Temporarily locked',code:'TOO_MANY_ATTEMPTS'},429);
    if(!await verifyActivation(c.env,token,row.activation_hash)){
      // Atomic increment prevents parallel bad attempts from overwriting each other.
      await c.env.DB.prepare(
        'UPDATE qr_codes SET activation_failures=CASE WHEN activation_locked_until>0 AND activation_locked_until<=? THEN 1 ELSE activation_failures+1 END,activation_locked_until=CASE WHEN (CASE WHEN activation_locked_until>0 AND activation_locked_until<=? THEN 1 ELSE activation_failures+1 END)>=5 THEN ? ELSE 0 END WHERE id=?'
      ).bind(now,now,now+900,row.id).run();
      return result(c,{error:'Invalid activation credentials',code:'INVALID_CREDENTIALS'},403);
    }
    await c.env.DB.prepare("UPDATE qr_codes SET target_url=?,target_type='Website',status='ACTIVE',activated_at=COALESCE(activated_at,CURRENT_TIMESTAMP),activation_failures=0,activation_locked_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(url,row.id).run();
    return result(c,{ok:true});
  });
  app.post('/api/qrs/bulk-activation-codes',async c=>{
    const body=await c.req.json().catch(()=>({}));
    const ids=body.ids;
    if(!Array.isArray(ids)||ids.length<1||ids.length>100||!ids.every(v=>Number.isSafeInteger(v)&&v>0)||new Set(ids).size!==ids.length)
      return result(c,{error:'Select 1 to 100 unique QR IDs'},400);
    const rows=await Promise.all(ids.map(id=>c.env.DB.prepare('SELECT id,short_code FROM qr_codes WHERE id=?').bind(id).first()));
    if(rows.some(row=>!row))return result(c,{error:'QR code not found'},404);
    const output=await Promise.all(rows.map(async row=>{
      const activationCode=newActivationCode();
      return {...row,activationCode,hash:await activationHash(c.env,activationCode)};
    }));
    await c.env.DB.batch(output.map(row=>c.env.DB.prepare(
      'UPDATE qr_codes SET activation_hash=?,activation_failures=0,activation_locked_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(row.hash,row.id)));
    const csv='short_code,activation_code\r\n'+output.map(row=>row.short_code+','+row.activationCode).join('\r\n')+'\r\n';
    return new Response('\uFEFF'+csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="qr-activation-codes.csv"','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
  });
  app.post('/api/qrs/:id/activation-code',async c=>{
    const id=Number(c.req.param('id'));
    if(!Number.isSafeInteger(id)||id<1)return result(c,{error:'Invalid ID'},400);
    const row=await c.env.DB.prepare('SELECT id FROM qr_codes WHERE id=?').bind(id).first();
    if(!row)return result(c,{error:'Not found'},404);
    const code=newActivationCode();
    const hash=await activationHash(c.env,code);
    await c.env.DB.prepare('UPDATE qr_codes SET activation_hash=?,activation_failures=0,activation_locked_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(hash,id).run();
    return result(c,{activationCode:code,notice:'Shown once. Deliver securely to end user.'});
  });
}
