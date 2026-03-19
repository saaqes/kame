const r      = require('express').Router();
const db     = require('../config/db');
const { auth, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── REVIEWS ──────────────────────────────────────────────────────────────────
r.post('/reviews', auth, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;
    const result = await db.query(
      `INSERT INTO reviews(user_id, product_id, rating, comment)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [req.user.id, product_id, rating, comment]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── OPINIONS ─────────────────────────────────────────────────────────────────
r.post('/opinions', async (req, res) => {
  try {
    const { name, email, phone, subject, message, type } = req.body;
    if (!name || !message) return res.status(400).json({ message: 'Nombre y mensaje requeridos' });
    await db.query(
      `INSERT INTO opinions(name,email,phone,subject,message,type)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [name, email||null, phone||null, subject||null, message, type||'suggestion']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── CLIENTS (público) ─────────────────────────────────────────────────────────
r.get('/clients', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM happy_clients WHERE is_active=true ORDER BY order_index'
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── PAYMENT INFO ──────────────────────────────────────────────────────────────
r.get('/payment/nequi', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT config_key, config_value FROM site_config
       WHERE config_key IN ('nequi_phone','nequi_qr','nequi_name')`
    );
    const o = {};
    result.rows.forEach(x => o[x.config_key] = x.config_value);
    res.json(o);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── PROFILE ───────────────────────────────────────────────────────────────────
r.get('/me/profile', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id,full_name,username,email,phone,role,avatar,banner,bio,
       ambiente_numero,nombre_completo_real,celular,created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/me/profile', auth, async (req, res) => {
  try {
    const { full_name, username, phone, bio, ambiente_numero, nombre_completo_real, celular } = req.body;
    await db.query(
      `UPDATE users SET full_name=$1,username=$2,phone=$3,bio=$4,
       ambiente_numero=$5,nombre_completo_real=$6,celular=$7 WHERE id=$8`,
      [full_name, username, phone||null, bio||null,
       ambiente_numero||null, nombre_completo_real||null, celular||null, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── UPLOAD AVATAR ─────────────────────────────────────────────────────────────
r.post('/me/avatar', auth, ...upload('avatar'), async (req, res) => {
  try {
    if (!req.file?.savedUrl) return res.status(400).json({ message: 'Sin archivo' });
    await db.query('UPDATE users SET avatar=$1 WHERE id=$2', [req.file.savedUrl, req.user.id]);
    res.json({ avatar: req.file.savedUrl });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── UPLOAD BANNER ─────────────────────────────────────────────────────────────
r.post('/me/banner', auth, ...upload('banner'), async (req, res) => {
  try {
    if (!req.file?.savedUrl) return res.status(400).json({ message: 'Sin archivo' });
    await db.query('UPDATE users SET banner=$1 WHERE id=$2', [req.file.savedUrl, req.user.id]);
    res.json({ banner: req.file.savedUrl });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── UPLOAD GENÉRICO ───────────────────────────────────────────────────────────
r.post('/upload', auth, ...upload('file'), (req, res) => {
  if (!req.file?.savedUrl) return res.status(400).json({ message: 'Sin archivo' });
  res.json({ url: req.file.savedUrl });
});

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
r.get('/admin/dashboard', auth, admin, async (req, res) => {
  try {
    const orders   = await db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(total),0) AS revenue FROM orders WHERE status!='cancelled'`);
    const users    = await db.query(`SELECT COUNT(*) AS total FROM users WHERE role='client'`);
    const opinions = await db.query(`SELECT COUNT(*) AS total FROM opinions WHERE status='new'`);
    const pending  = await db.query(`SELECT COUNT(*) AS total FROM orders WHERE status='payment_review'`);
    const recent   = await db.query(`SELECT o.*,u.full_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 10`);
    res.json({
      orders: orders.rows[0],
      users: users.rows[0],
      opinions: opinions.rows[0],
      pending_payments: pending.rows[0],
      recentOrders: recent.rows
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN SITE CONFIG ─────────────────────────────────────────────────────────
r.get('/admin/site-config', async (req, res) => {
  try {
    const result = await db.query('SELECT config_key, config_value FROM site_config');
    const o = {};
    result.rows.forEach(x => o[x.config_key] = x.config_value);
    res.json(o);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/site-config', auth, admin, async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body)) {
      await db.query(
        `INSERT INTO site_config(config_key,config_value) VALUES($1,$2)
         ON CONFLICT (config_key) DO UPDATE SET config_value=EXCLUDED.config_value`,
        [k, v]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN OPINIONES ───────────────────────────────────────────────────────────
r.get('/admin/opinions', auth, admin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM opinions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/opinions/:id', auth, admin, async (req, res) => {
  try {
    const { status, admin_response } = req.body;
    await db.query(
      'UPDATE opinions SET status=$1, admin_response=$2 WHERE id=$3',
      [status, admin_response, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN USUARIOS ────────────────────────────────────────────────────────────
r.get('/admin/users', auth, admin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id,full_name,username,email,phone,role,avatar,is_active,
       ambiente_numero,nombre_completo_real,celular,created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/users/:id', auth, admin, async (req, res) => {
  try {
    const { role, is_active } = req.body;
    await db.query(
      'UPDATE users SET role=$1, is_active=$2 WHERE id=$3',
      [role, is_active, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN CUPONES ─────────────────────────────────────────────────────────────
r.get('/admin/coupons', auth, admin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.post('/admin/coupons', auth, admin, async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_purchase } = req.body;
    const result = await db.query(
      `INSERT INTO coupons(code,description,discount_type,discount_value,min_purchase)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [code, description, discount_type, discount_value, min_purchase||0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/coupons/:id', auth, admin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE coupons SET is_active=$1 WHERE id=$2', [is_active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN HAPPY CLIENTS ───────────────────────────────────────────────────────
r.get('/admin/happy-clients', auth, admin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM happy_clients ORDER BY order_index');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.post('/admin/happy-clients', auth, admin, async (req, res) => {
  try {
    const { client_name, product_bought, description, rating, photo_url, order_index, is_active } = req.body;
    const result = await db.query(
      `INSERT INTO happy_clients(client_name,product_bought,description,rating,photo_url,order_index,is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [client_name, product_bought||null, description||null, rating||5, photo_url||null, order_index||0, is_active!==false]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/admin/happy-clients/:id', auth, admin, async (req, res) => {
  try {
    const { client_name, product_bought, description, rating, photo_url, order_index, is_active } = req.body;
    await db.query(
      `UPDATE happy_clients SET client_name=$1,product_bought=$2,description=$3,
       rating=$4,photo_url=$5,order_index=$6,is_active=$7 WHERE id=$8`,
      [client_name, product_bought||null, description||null, rating||5,
       photo_url||null, order_index||0, is_active!==false, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.delete('/admin/happy-clients/:id', auth, admin, async (req, res) => {
  try {
    await db.query('DELETE FROM happy_clients WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
