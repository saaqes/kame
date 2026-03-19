const r = require('express').Router();
const db = require('../config/db');
const { auth, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// REVIEWS
r.post('/reviews', auth, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;

    const result = await db.query(
      `INSERT INTO reviews(user_id, product_id, rating, comment)
       VALUES($1, $2, $3, $4)
       RETURNING id`,
      [req.user.id, product_id, rating, comment]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// OPINIONS
r.post('/opinions', async (req, res) => {
  try {
    const { name, email, phone, subject, message, type } = req.body;

    if (!name || !message) {
      return res.status(400).json({ message: 'Nombre y mensaje requeridos' });
    }

    await db.query(
      `INSERT INTO opinions(name,email,phone,subject,message,type)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [name, email || null, phone || null, subject || null, message, type || 'suggestion']
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// CLIENTS
r.get('/clients', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM happy_clients WHERE is_active = true ORDER BY order_index'
    );

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PAYMENT
r.get('/payment/nequi', async (req, res) => {
  const result = await db.query(
    `SELECT config_key, config_value FROM site_config
     WHERE config_key IN ('nequi_phone','nequi_qr','nequi_name')`
  );

  const o = {};
  result.rows.forEach(x => o[x.config_key] = x.config_value);

  res.json(o);
});

// PROFILE
r.get('/me/profile', auth, async (req, res) => {
  const result = await db.query(
    `SELECT id,full_name,username,email,phone,role,avatar,banner,bio,
     ambiente_numero,nombre_completo_real,celular,created_at
     FROM users WHERE id=$1`,
    [req.user.id]
  );

  res.json(result.rows[0] || {});
});

r.put('/me/profile', auth, async (req, res) => {
  const {
    full_name, username, phone, bio,
    ambiente_numero, nombre_completo_real, celular
  } = req.body;

  await db.query(
    `UPDATE users SET
     full_name=$1, username=$2, phone=$3, bio=$4,
     ambiente_numero=$5, nombre_completo_real=$6, celular=$7
     WHERE id=$8`,
    [
      full_name, username, phone || null, bio || null,
      ambiente_numero || null, nombre_completo_real || null,
      celular || null, req.user.id
    ]
  );

  res.json({ ok: true });
});

// NOTIFICATIONS
r.get('/me/notifications', auth, async (req, res) => {
  const result = await db.query(
    `SELECT * FROM notifications
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 20`,
    [req.user.id]
  );

  res.json(result.rows);
});

// ADMIN DASHBOARD
r.get('/admin/dashboard', auth, admin, async (req, res) => {
  const orders = await db.query(
    `SELECT COUNT(*) AS total,
     COALESCE(SUM(total),0) AS revenue
     FROM orders WHERE status!='cancelled'`
  );

  const users = await db.query(
    `SELECT COUNT(*) AS total FROM users WHERE role='client'`
  );

  const opinions = await db.query(
    `SELECT COUNT(*) AS total FROM opinions WHERE status='new'`
  );

  const pending = await db.query(
    `SELECT COUNT(*) AS total FROM orders WHERE status='payment_review'`
  );

  const recent = await db.query(
    `SELECT o.*,u.full_name
     FROM orders o
     JOIN users u ON o.user_id=u.id
     ORDER BY o.created_at DESC
     LIMIT 10`
  );

  res.json({
    orders: orders.rows[0],
    users: users.rows[0],
    opinions: opinions.rows[0],
    pending_payments: pending.rows[0],
    recentOrders: recent.rows
  });
});

// SITE CONFIG (IMPORTANTE - FIX POSTGRES)
r.put('/admin/site-config', auth, admin, async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    await db.query(
      `INSERT INTO site_config(config_key, config_value)
       VALUES($1,$2)
       ON CONFLICT (config_key)
       DO UPDATE SET config_value = EXCLUDED.config_value`,
      [k, v]
    );
  }

  res.json({ ok: true });
});

module.exports = r;