const r      = require('express').Router();
const db     = require('../config/db');
const { auth, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
const ok  = (res, data={}) => res.json({ ok:true, ...data });
const err = (res, e, code=500) => res.status(code).json({ message: e?.message||e||'Error' });
const q   = (sql, params) => db.query(sql, params).then(r => r.rows);

// ══════════════════════════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════════════════════════
r.post('/reviews', auth, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;
    const [row] = await q(
      `INSERT INTO reviews(user_id,product_id,rating,comment) VALUES($1,$2,$3,$4) RETURNING id`,
      [req.user.id, product_id, rating, comment]
    );
    res.status(201).json({ id: row.id });
  } catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// OPINIONS / CONTACTO
// ══════════════════════════════════════════════════════════════════
r.post('/opinions', async (req, res) => {
  try {
    const { name, email, phone, subject, message, type } = req.body;
    if (!name || !message) return err(res,'Nombre y mensaje requeridos',400);
    await q(`INSERT INTO opinions(name,email,phone,subject,message,type) VALUES($1,$2,$3,$4,$5,$6)`,
      [name, email||null, phone||null, subject||null, message, type||'suggestion']);
    ok(res);
  } catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// CLIENTES FELICES (público)
// ══════════════════════════════════════════════════════════════════
r.get('/clients', async (req, res) => {
  try { res.json(await q('SELECT * FROM happy_clients WHERE is_active=true ORDER BY order_index')); }
  catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// NEQUI INFO (público)
// ══════════════════════════════════════════════════════════════════
r.get('/payment/nequi', async (req, res) => {
  try {
    const rows = await q(`SELECT config_key,config_value FROM site_config
      WHERE config_key IN ('nequi_phone','nequi_qr','nequi_name')`);
    const o = {}; rows.forEach(x => o[x.config_key] = x.config_value);
    res.json(o);
  } catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// PERFIL DE USUARIO
// ══════════════════════════════════════════════════════════════════
r.get('/me/profile', auth, async (req, res) => {
  try {
    const [u] = await q(
      `SELECT id,full_name,username,email,phone,role,avatar,banner,bio,
              ambiente_numero,nombre_completo_real,celular,sena_role,created_at
       FROM users WHERE id=$1`, [req.user.id]);
    res.json(u || {});
  } catch(e) { err(res,e); }
});

r.put('/me/profile', auth, async (req, res) => {
  try {
    const { full_name, username, phone, bio, ambiente_numero, nombre_completo_real, celular } = req.body;
    await q(`UPDATE users SET full_name=$1,username=$2,phone=$3,bio=$4,
             ambiente_numero=$5,nombre_completo_real=$6,celular=$7 WHERE id=$8`,
      [full_name,username,phone||null,bio||null,
       ambiente_numero||null,nombre_completo_real||null,celular||null,req.user.id]);
    ok(res);
  } catch(e) { err(res,e); }
});

// Avatar upload (archivo)
r.post('/me/avatar', auth,
  (req,res,next)=>{req.driveFolder='avatars';next()}, ...upload('file'),
  async (req,res) => {
    try {
      if (!req.file?.savedUrl) return err(res,'No se recibió imagen',400);
      await q('UPDATE users SET avatar=$1 WHERE id=$2',[req.file.savedUrl,req.user.id]);
      res.json({ url: req.file.savedUrl });
    } catch(e) { err(res,e); }
  }
);

// Avatar URL (DBZ avatars)
r.post('/me/avatar-url', auth, async (req,res) => {
  try {
    const { url } = req.body;
    if (!url) return err(res,'URL requerida',400);
    await q('UPDATE users SET avatar=$1 WHERE id=$2',[url,req.user.id]);
    res.json({ url });
  } catch(e) { err(res,e); }
});

// Banner upload
r.post('/me/banner', auth,
  (req,res,next)=>{req.driveFolder='banners';next()}, ...upload('file'),
  async (req,res) => {
    try {
      if (!req.file?.savedUrl) return err(res,'No se recibió imagen',400);
      await q('UPDATE users SET banner=$1 WHERE id=$2',[req.file.savedUrl,req.user.id]);
      res.json({ url: req.file.savedUrl });
    } catch(e) { err(res,e); }
  }
);

// Notificaciones
r.get('/me/notifications', auth, async (req,res) => {
  try {
    const rows = await q(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    ).catch(()=>[]);
    res.json(Array.isArray(rows)?rows:[]);
  } catch(e) { res.json([]); }
});

// ══════════════════════════════════════════════════════════════════
// UPLOAD GENÉRICO (para imágenes de carrusel, productos, etc.)
// ══════════════════════════════════════════════════════════════════
r.post('/api/upload', auth, admin,
  (req,res,next)=>{req.driveFolder=req.query.folder||'general';next()}, ...upload('file'),
  (req,res) => {
    if (!req.file?.savedUrl) return err(res,'No file',400);
    res.json({ url: req.file.savedUrl });
  }
);

// ══════════════════════════════════════════════════════════════════
// ADMIN — DASHBOARD
// ══════════════════════════════════════════════════════════════════
r.get('/admin/dashboard', auth, admin, async (req,res) => {
  try {
    const [ordersRow] = await q(`SELECT COUNT(*) AS total, COALESCE(SUM(total),0) AS revenue FROM orders WHERE status!='cancelled'`);
    const [usersRow]  = await q(`SELECT COUNT(*) AS total FROM users WHERE role='client'`);
    const [opsRow]    = await q(`SELECT COUNT(*) AS total FROM opinions WHERE status='new'`);
    const [pendRow]   = await q(`SELECT COUNT(*) AS total FROM orders WHERE status='payment_review'`);
    const recent      = await q(`SELECT o.*,u.full_name FROM orders o LEFT JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 10`);
    res.json({
      orders:           ordersRow,
      users:            usersRow,
      opinions:         opsRow,
      pending_payments: pendRow,
      recentOrders:     recent,
    });
  } catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — SITE CONFIG
// ══════════════════════════════════════════════════════════════════
r.get('/admin/site-config', auth, admin, async (req,res) => {
  try {
    const rows = await q('SELECT config_key,config_value FROM site_config');
    const cfg = {}; rows.forEach(x => cfg[x.config_key] = x.config_value);
    res.json(cfg);
  } catch(e) { err(res,e); }
});

r.put('/admin/site-config', auth, admin, async (req,res) => {
  try {
    for (const [k,v] of Object.entries(req.body)) {
      await q(`INSERT INTO site_config(config_key,config_value) VALUES($1,$2)
               ON CONFLICT(config_key) DO UPDATE SET config_value=$2`, [k, v??'']);
    }
    ok(res);
  } catch(e) { err(res,e); }
});

// Upload para config (logo, QR Nequi, etc.)
r.post('/admin/upload-config', auth, admin,
  (req,res,next)=>{req.driveFolder=req.query.folder||'general';next()}, ...upload('file'),
  (req,res) => {
    if (!req.file?.savedUrl) return err(res,'No file',400);
    res.json({ url: req.file.savedUrl });
  }
);

// ══════════════════════════════════════════════════════════════════
// ADMIN — USUARIOS
// ══════════════════════════════════════════════════════════════════
r.get('/admin/users', auth, admin, async (req,res) => {
  try {
    res.json(await q(
      `SELECT id,full_name,username,email,phone,role,avatar,is_active,bio,
              created_at,celular,ambiente_numero,nombre_completo_real,sena_role
       FROM users ORDER BY created_at DESC`
    ));
  } catch(e) { err(res,e); }
});

r.put('/admin/users/:id', auth, admin, async (req,res) => {
  try {
    const { role, is_active } = req.body;
    const fields=[], vals=[];
    if (role      !== undefined) { fields.push(`role=$${fields.length+1}`);      vals.push(role); }
    if (is_active !== undefined) { fields.push(`is_active=$${fields.length+1}`); vals.push(is_active); }
    if (!fields.length) return err(res,'Nada que actualizar',400);
    vals.push(req.params.id);
    await q(`UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
    ok(res);
  } catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — OPINIONES
// ══════════════════════════════════════════════════════════════════
r.get('/admin/opinions', auth, admin, async (req,res) => {
  try { res.json(await q('SELECT * FROM opinions ORDER BY created_at DESC')); }
  catch(e) { err(res,e); }
});

r.put('/admin/opinions/:id', auth, admin, async (req,res) => {
  try {
    const { status, admin_response } = req.body;
    await q(`UPDATE opinions SET status=$1, admin_response=$2 WHERE id=$3`,
      [status||'read', admin_response||null, req.params.id]);
    ok(res);
  } catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — CLIENTES FELICES (Guerreros)
// ══════════════════════════════════════════════════════════════════
r.get('/admin/happy-clients', async (req,res) => {
  try { res.json(await q('SELECT * FROM happy_clients ORDER BY order_index,created_at')); }
  catch(e) { err(res,e); }
});

r.post('/admin/happy-clients', auth, admin, async (req,res) => {
  try {
    const { client_name,product_bought,description,rating,photo_url,order_index,is_active } = req.body;
    const [row] = await q(
      `INSERT INTO happy_clients(client_name,product_bought,description,rating,photo_url,order_index,is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [client_name,product_bought,description,rating||5,photo_url||'',order_index||0,is_active!==false]
    );
    res.status(201).json({ id: row.id });
  } catch(e) { err(res,e); }
});

r.put('/admin/happy-clients/:id', auth, admin, async (req,res) => {
  try {
    const { client_name,product_bought,description,rating,photo_url,order_index,is_active } = req.body;
    await q(`UPDATE happy_clients SET client_name=$1,product_bought=$2,description=$3,
             rating=$4,photo_url=$5,order_index=$6,is_active=$7 WHERE id=$8`,
      [client_name,product_bought,description,rating||5,photo_url||'',order_index||0,is_active!==false,req.params.id]);
    ok(res);
  } catch(e) { err(res,e); }
});

r.delete('/admin/happy-clients/:id', auth, admin, async (req,res) => {
  try { await q('DELETE FROM happy_clients WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — CUPONES
// ══════════════════════════════════════════════════════════════════
r.get('/admin/coupons', auth, admin, async (req,res) => {
  try { res.json(await q('SELECT * FROM coupons ORDER BY created_at DESC')); }
  catch(e) { err(res,e); }
});

r.post('/admin/coupons', auth, admin, async (req,res) => {
  try {
    const { code,description,discount_type,discount_value,min_purchase } = req.body;
    const [row] = await q(
      `INSERT INTO coupons(code,description,discount_type,discount_value,min_purchase)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [code?.toUpperCase(),description||'',discount_type||'percent',discount_value||0,min_purchase||0]
    );
    res.status(201).json({ id: row.id });
  } catch(e) { err(res,e); }
});

r.put('/admin/coupons/:id', auth, admin, async (req,res) => {
  try { await q('UPDATE coupons SET is_active=$1 WHERE id=$2',[req.body.is_active,req.params.id]); ok(res); }
  catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — GANANCIAS
// ══════════════════════════════════════════════════════════════════
r.get('/admin/ganancias', auth, admin, async (req,res) => {
  try { res.json(await q('SELECT * FROM ganancias ORDER BY fecha DESC, hora DESC NULLS LAST')); }
  catch(e) { err(res,e); }
});

r.post('/admin/ganancias', auth, admin, async (req,res) => {
  try {
    const { fecha,hora,tipo_cuenta,items,total,notas } = req.body;
    const [row] = await q(
      `INSERT INTO ganancias(fecha,hora,tipo_cuenta,items,total,notas) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [fecha, hora||null, tipo_cuenta, typeof items==='string'?items:JSON.stringify(items||[]), total||0, notas||'']
    );
    res.status(201).json({ id: row.id });
  } catch(e) { err(res,e); }
});

r.delete('/admin/ganancias/:id', auth, admin, async (req,res) => {
  try { await q('DELETE FROM ganancias WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { err(res,e); }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — REELS
// ══════════════════════════════════════════════════════════════════
r.get('/admin/reels', async (req,res) => {
  try { res.json(await q('SELECT * FROM reels ORDER BY order_index,created_at DESC')); }
  catch(e) { res.json([]); }  // no crashear si tabla no existe aún
});

r.post('/admin/reels', auth, admin, async (req,res) => {
  try {
    const { url,escala,titulo,descripcion,is_active,order_index } = req.body;
    const [row] = await q(
      `INSERT INTO reels(url,escala,titulo,descripcion,is_active,order_index) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [url, escala||'horizontal', titulo||'', descripcion||'', is_active!==false, order_index||0]
    );
    res.status(201).json({ id: row.id });
  } catch(e) { err(res,e); }
});

r.put('/admin/reels/:id', auth, admin, async (req,res) => {
  try { await q('UPDATE reels SET is_active=$1 WHERE id=$2',[req.body.is_active,req.params.id]); ok(res); }
  catch(e) { err(res,e); }
});

r.delete('/admin/reels/:id', auth, admin, async (req,res) => {
  try { await q('DELETE FROM reels WHERE id=$1',[req.params.id]); ok(res); }
  catch(e) { err(res,e); }
});

module.exports = r;
