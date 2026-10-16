import { qrSvg, qrZip } from './qr-render.js';

const reply=(c,v,status=200)=>c.json(v,status,{'Cache-Control':'no-store'});
const alphabet='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(7)), v=>alphabet[v%alphabet.length]).join('');
const validId=v=>/^\d+$/.test(String(v))&&Number(v)>0;
export function registerBatches(app) {
  app.get('/api/dashboard',async c=>{
    const [b,q,p,a]=await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) AS n FROM qr_batches').first(),
      c.env.DB.prepare('SELECT COUNT(*) AS n FROM qr_codes').first(),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM qr_codes WHERE status='PENDING'").first(),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM qr_codes WHERE status='ACTIVE'").first()
    ]);
    return reply(c,{batches:b.n,codes:q.n,pending:p.n,active:a.n});
  });
  app.get('/api/batches',async c=>{
    const {results}=await c.env.DB.prepare('SELECT * FROM qr_batches ORDER BY id DESC LIMIT 200').all();
    return reply(c,{items:results});
  });
  app.post('/api/batches',async c=>{
    const body=await c.req.json().catch(()=>({}));
    const name=String(body.batchName||'').trim();
    const qty=Number(body.quantity),mode=body.qrMode;
    if (!name||name.length>120||!Number.isInteger(qty)||qty<1||qty>1000||!['SHARED','UNIQUE'].includes(mode)) return reply(c,{error:'Invalid batch'},400);
    const batchCode='QR-'+Date.now().toString(36).toUpperCase()+'-'+code().slice(0,4);
    const qrCount=mode==='SHARED'?1:qty;
    const codes=new Set();
    while(codes.size<qrCount) codes.add(code());
    const statements=[
      c.env.DB.prepare("INSERT INTO qr_batches (batch_code,batch_name,quantity,qr_mode) VALUES (?,?,?,?)").bind(batchCode,name,qty,mode),
      ...[...codes].map(short=>c.env.DB.prepare("INSERT INTO qr_codes (batch_id,short_code) SELECT id,? FROM qr_batches WHERE batch_code=?").bind(short,batchCode))
    ];
    try { await c.env.DB.batch(statements); }
    catch(e) { if(String(e).includes('UNIQUE')) return reply(c,{error:'Code conflict, please retry'},409); throw e; }
    return reply(c,{ok:true,batchCode,quantity:qty,qrMode:mode,qrCount},201);
  });
  app.get('/api/batches/:id',async c=>{
    if(!validId(c.req.param('id')))return reply(c,{error:'Invalid id'},400);
    const b=await c.env.DB.prepare('SELECT * FROM qr_batches WHERE id=?').bind(Number(c.req.param('id'))).first();
    return b?reply(c,{item:b}):reply(c,{error:'Not found'},404);
  });
  app.post('/api/batches/:id/status',async c=>{
    if(!validId(c.req.param('id')))return reply(c,{error:'Invalid id'},400);
    const body=await c.req.json().catch(()=>({}));
    const states=['CREATED','EXPORTED','PRINTED','SHIPPED'];
    if(!states.includes(body.status))return reply(c,{error:'Invalid status'},400);
    if(!['PRINTED','SHIPPED'].includes(body.status))return reply(c,{error:'Invalid transition'},400);
    const expected=body.status==='PRINTED'?['CREATED','EXPORTED']:['PRINTED'];
    const marks=expected.map(()=>'?').join(',');
    const result=await c.env.DB.prepare('UPDATE qr_batches SET production_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND production_status IN ('+marks+')')
      .bind(body.status,Number(c.req.param('id')),...expected).run();
    if(result.meta.changes===1)return reply(c,{ok:true});
    const exists=await c.env.DB.prepare('SELECT production_status FROM qr_batches WHERE id=?').bind(Number(c.req.param('id'))).first();
    return reply(c,{error:exists?'Invalid production status transition':'Not found'},exists?409:404);
  });
  app.get('/api/batches/:id/qrcodes.zip',async c=>{
    if(!validId(c.req.param('id')))return reply(c,{error:'Invalid id'},400);
    const b=await c.env.DB.prepare('SELECT * FROM qr_batches WHERE id=?').bind(Number(c.req.param('id'))).first();
    if(!b)return reply(c,{error:'Not found'},404);
    const {results}=await c.env.DB.prepare('SELECT short_code FROM qr_codes WHERE batch_id=? ORDER BY id').bind(b.id).all();
    const bytes=await qrZip(b,results,new URL(c.req.url).origin);
    await c.env.DB.prepare("UPDATE qr_batches SET production_status='EXPORTED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND production_status='CREATED'").bind(b.id).run();
    return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+b.batch_code+'.zip"','Cache-Control':'no-store'}});
  });
  app.get('/api/qrs/:id/qrcode.svg',async c=>{
    if(!validId(c.req.param('id')))return reply(c,{error:'Invalid id'},400);
    const row=await c.env.DB.prepare('SELECT short_code FROM qr_codes WHERE id=?').bind(Number(c.req.param('id'))).first();
    return row?new Response(qrSvg(new URL(c.req.url).origin+'/q/'+row.short_code,row.short_code),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store'}}):reply(c,{error:'Not found'},404);
  });
}
