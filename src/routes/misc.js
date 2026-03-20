const r = require('express').Router();
const db = require('../config/db');
const { auth, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── SITE CONFIG ───────────────────────────────────────────────────────────────
r.get('/admin/site-config', auth, admin, async (req,res) => {
  try {
    const result = await db.query('SELECT config_key, config_value FROM site_config');
    const cfg = {};
    result.rows.forEach(row => { cfg[row.config_key] = row.config_value; });
    res.json(cfg);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/site-config', auth, admin, async (req,res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db.query(
        `INSERT INTO site_config(config_key, config_value) VALUES($1,$2)
         ON CONFLICT(config_key) DO UPDATE SET config_value=$2`,
        [key, value ?? '']
      );
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

r.get('/payment/nequi', async (req,res) => {
  try {
    const result = await db.query("SELECT config_key, config_value FROM site_config WHERE config_key IN ('nequi_name','nequi_phone','nequi_qr')");
    const cfg = {};
    result.rows.forEach(row => { cfg[row.config_key] = row.config_value; });
    res.json({ nequi_name: cfg.nequi_name||'', nequi_phone: cfg.nequi_phone||'', nequi_qr: cfg.nequi_qr||'' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── UPLOAD ────────────────────────────────────────────────────────────────────
r.post('/api/upload', auth, admin, (req,res,next) => {
  req.driveFolder = req.query.folder || 'general'; next();
}, ...upload('file'), (req,res) => {
  if (!req.file?.savedUrl) return res.status(400).json({ message: 'No file' });
  res.json({ url: req.file.savedUrl });
});

// ── ADMIN USERS ───────────────────────────────────────────────────────────────
r.get('/admin/users', auth, admin, async (req,res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, username, email, phone, role, avatar, is_active,
              bio, created_at, celular, ambiente_numero, nombre_completo_real, sena_role
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/users/:id', auth, admin, async (req,res) => {
  try {
    const { role, is_active } = req.body;
    const fields = [], vals = [];
    if (role !== undefined)      { fields.push(`role=$${fields.length+1}`);      vals.push(role); }
    if (is_active !== undefined) { fields.push(`is_active=$${fields.length+1}`); vals.push(is_active); }
    if (!fields.length) return res.status(400).json({ message: 'Nada que actualizar' });
    vals.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN OPINIONS ────────────────────────────────────────────────────────────
r.get('/admin/opinions', auth, admin, async (req,res) => {
  try { res.json((await db.query('SELECT * FROM opinions ORDER BY created_at DESC')).rows); }
  catch(e) { res.status(500).json({ message: e.message }); }
});
r.put('/admin/opinions/:id', auth, admin, async (req,res) => {
  try { await db.query('UPDATE opinions SET status=$1 WHERE id=$2',['read',req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

// ── HAPPY CLIENTS ─────────────────────────────────────────────────────────────
r.get('/admin/happy-clients', async (req,res) => {
  try { res.json((await db.query('SELECT * FROM happy_clients ORDER BY order_index,created_at')).rows); }
  catch(e) { res.status(500).json({ message: e.message }); }
});
r.post('/admin/happy-clients', auth, admin, async (req,res) => {
  try {
    const { client_name, product_bought, description, rating, photo_url, order_index, is_active } = req.body;
    const result = await db.query(
      `INSERT INTO happy_clients(client_name,product_bought,description,rating,photo_url,order_index,is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [client_name, product_bought, description, rating||5, photo_url||'', order_index||0, is_active!==false]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
r.put('/admin/happy-clients/:id', auth, admin, async (req,res) => {
  try {
    const { client_name, product_bought, description, rating, photo_url, order_index, is_active } = req.body;
    await db.query(
      `UPDATE happy_clients SET client_name=$1,product_bought=$2,description=$3,rating=$4,photo_url=$5,order_index=$6,is_active=$7 WHERE id=$8`,
      [client_name, product_bought, description, rating||5, photo_url||'', order_index||0, is_active!==false, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
r.delete('/admin/happy-clients/:id', auth, admin, async (req,res) => {
  try { await db.query('DELETE FROM happy_clients WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

// ── COUPONS ───────────────────────────────────────────────────────────────────
r.get('/admin/coupons', auth, admin, async (req,res) => {
  try { res.json((await db.query('SELECT * FROM coupons ORDER BY created_at DESC')).rows); }
  catch(e) { res.status(500).json({ message: e.message }); }
});
r.post('/admin/coupons', auth, admin, async (req,res) => {
  try {
    const { code, description, discount_type, discount_value, min_purchase } = req.body;
    const result = await db.query(
      `INSERT INTO coupons(code,description,discount_type,discount_value,min_purchase)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [code?.toUpperCase(), description||'', discount_type||'percent', discount_value||0, min_purchase||0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
r.put('/admin/coupons/:id', auth, admin, async (req,res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE coupons SET is_active=$1 WHERE id=$2',[is_active, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── GANANCIAS ─────────────────────────────────────────────────────────────────
r.get('/admin/ganancias', auth, admin, async (req,res) => {
  try { res.json((await db.query('SELECT * FROM ganancias ORDER BY fecha DESC, hora DESC NULLS LAST')).rows); }
  catch(e) { res.status(500).json({ message: e.message }); }
});
r.post('/admin/ganancias', auth, admin, async (req,res) => {
  try {
    const { fecha, hora, tipo_cuenta, items, total, notas } = req.body;
    const result = await db.query(
      `INSERT INTO ganancias(fecha, hora, tipo_cuenta, items, total, notas)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [fecha, hora||null, tipo_cuenta, typeof items==='string'?items:JSON.stringify(items||[]), total||0, notas||'']
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
r.delete('/admin/ganancias/:id', auth, admin, async (req,res) => {
  try { await db.query('DELETE FROM ganancias WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

// ── REELS ─────────────────────────────────────────────────────────────────────
r.get('/admin/reels', async (req,res) => {
  try { res.json((await db.query('SELECT * FROM reels ORDER BY order_index, created_at DESC')).rows); }
  catch(e) { res.status(500).json({ message: e.message }); }
});
r.post('/admin/reels', auth, admin, async (req,res) => {
  try {
    const { url, escala, titulo, descripcion, is_active, order_index } = req.body;
    const result = await db.query(
      `INSERT INTO reels(url, escala, titulo, descripcion, is_active, order_index)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [url, escala||'horizontal', titulo||'', descripcion||'', is_active!==false, order_index||0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
r.put('/admin/reels/:id', auth, admin, async (req,res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE reels SET is_active=$1 WHERE id=$2',[is_active, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
r.delete('/admin/reels/:id', auth, admin, async (req,res) => {
  try { await db.query('DELETE FROM reels WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
