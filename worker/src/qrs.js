const respond=(c,v,s=200)=>c.json(v,s,{'Cache-Control':'no-store'});
const ids=v=>Array.isArray(v)&&v.length>0&&v.length<=1000&&v.every(x=>Number.isSafeInteger(Number(x))&&Number(x)>0)?[...new Set(v.map(Number))]:null;
const validUrl=value=>{
 try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&url.hostname.includes('.')&& !['example.com','example.org','example.net'].includes(url.hostname);} catch{return false;}
};
export function registerQrs(app) {
  app.get('/api/qrs',async c=>{
    const batchId=c.req.query('batchId'),where=batchId&&/^\d+$/.test(batchId)?'WHERE q.batch_id=?':'';
    const stmt=c.env.DB.prepare('SELECT q.id,q.batch_id,q.short_code,q.location_id,q.target_type,q.target_url,q.status,q.activated_at,q.created_at,q.updated_at,b.batch_code,l.name AS location_name FROM qr_codes q JOIN qr_batches b ON b.id=q.batch_id LEFT JOIN locations l ON l.id=q.location_id '+where+' ORDER BY q.id DESC LIMIT 1000');
    const {results}=await (where?stmt.bind(Number(batchId)):stmt).all();
    return respond(c,{items:results});
  });
  app.put('/api/qrs/:id',async c=>{
    const id=Number(c.req.param('id'));
    if(!Number.isSafeInteger(id)||id<=0)return respond(c,{error:'Invalid id'},400);
    const b=await c.req.json().catch(()=>({}));
    const target=String(b.targetUrl||'').trim(),type=String(b.targetType||'').trim();
    if(!validUrl(target)||type.length>80)return respond(c,{error:'Invalid target URL/type'},400);
    const r=await c.env.DB.prepare('UPDATE qr_codes SET target_url=?,target_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(target,type,id).run();
    return respond(c,{ok:r.meta.changes>0},r.meta.changes?200:404);
  });
  app.post('/api/qrs/bulk-assign',async c=>{
    const b=await c.req.json().catch(()=>({})),list=ids(b.ids),locationId=Number(b.locationId);
    if(!list||!Number.isSafeInteger(locationId)||locationId<=0)return respond(c,{error:'Invalid input'},400);
    if(!await c.env.DB.prepare('SELECT id FROM locations WHERE id=?').bind(locationId).first())return respond(c,{error:'Location not found'},404);
    await c.env.DB.batch(list.map(id=>c.env.DB.prepare('UPDATE qr_codes SET location_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(locationId,id)));
    return respond(c,{ok:true,count:list.length});
  });
  app.post('/api/qrs/bulk-target',async c=>{
    const b=await c.req.json().catch(()=>({})),list=ids(b.ids),target=String(b.targetUrl||'').trim(),type=String(b.targetType||'').trim();
    if(!list||!validUrl(target)||type.length>80)return respond(c,{error:'Invalid input'},400);
    await c.env.DB.batch(list.map(id=>c.env.DB.prepare('UPDATE qr_codes SET target_url=?,target_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(target,type,id)));
    return respond(c,{ok:true,count:list.length});
  });
  app.post('/api/qrs/bulk-activate',async c=>{
    const b=await c.req.json().catch(()=>({})),list=ids(b.ids);
    if(!list)return respond(c,{error:'Invalid input'},400);
    const checks=await Promise.all(list.map(id=>c.env.DB.prepare('SELECT id,location_id,target_url FROM qr_codes WHERE id=?').bind(id).first()));
    if(checks.some(x=>!x||!x.location_id||!validUrl(x.target_url)))return respond(c,{error:'All codes must have location and valid target URL'},409);
    await c.env.DB.batch(list.map(id=>c.env.DB.prepare("UPDATE qr_codes SET status='ACTIVE',activated_at=COALESCE(activated_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id)));
    return respond(c,{ok:true,count:list.length});
  });
  app.post('/api/qrs/:id/status',async c=>{
    const id=Number(c.req.param('id')),b=await c.req.json().catch(()=>({}));
    if(!Number.isSafeInteger(id)||id<=0||!['ACTIVE','DISABLED','PENDING'].includes(b.status))return respond(c,{error:'Invalid input'},400);
    const row=await c.env.DB.prepare('SELECT location_id,target_url FROM qr_codes WHERE id=?').bind(id).first();
    if(!row)return respond(c,{error:'Not found'},404);
    if(b.status==='ACTIVE'&&(!row.location_id||!validUrl(row.target_url)))return respond(c,{error:'Location and valid target required'},409);
    await c.env.DB.prepare('UPDATE qr_codes SET status=?,activated_at=CASE WHEN ?=\'ACTIVE\' THEN COALESCE(activated_at,CURRENT_TIMESTAMP) ELSE activated_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.status,b.status,id).run();
    return respond(c,{ok:true});
  });
}

[executed on device: LAPTOP-96QI0EC3 (2df899ff-6916-4249-9617-10636bdf2880)]
