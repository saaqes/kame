import express from 'express';
import db from '../config/db.js';
import { auth, admin } from '../middleware/auth.js';

const r = express.Router();

// Todas las rutas requieren auth + admin
r.use(auth, admin);


// ══════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════
r.get('/dashboard', async (req, res) => {
  try {
    const [orders, users, opinions, pendingPay, recentOrders] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(total),0) AS revenue FROM orders WHERE status != 'archived'`),
      db.query(`SELECT COUNT(*) AS total FROM users WHERE role = 'client'`),
      db.query(`SELECT COUNT(*) AS total FROM opinions WHERE status = 'new'`),
      db.query(`SELECT COUNT(*) AS total FROM orders WHERE payment_status = 'processing'`),
      db.query(`
        SELECT o.id, o.order_number, o.total, o.status, o.created_at,
               COALESCE(u.full_name, o.customer_name, 'Cliente') AS full_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.status != 'archived'
        ORDER BY o.created_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      orders:           { total: +orders.rows[0].total, revenue: +orders.rows[0].revenue },
      users:            { total: +users.rows[0].total },
      opinions:         { total: +opinions.rows[0].total },
      pending_payments: { total: +pendingPay.rows[0].total },
      recentOrders:     recentOrders.rows
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  OPINIONS
// ══════════════════════════════════════
r.get('/opinions', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM opinions ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.put('/opinions/:id', async (req, res) => {
  try {
    const { status, admin_response } = req.body;
    await db.query(
      `UPDATE opinions SET status=$1, admin_response=$2 WHERE id=$3`,
      [status || 'responded', admin_response || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  SITE CONFIG
// ══════════════════════════════════════
r.get('/site-config', async (req, res) => {
  try {
    const result = await db.query(`SELECT config_key, config_value FROM site_config`);
    const cfg = {};
    result.rows.forEach(row => { cfg[row.config_key] = row.config_value; });
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.put('/site-config', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      await db.query(
        `INSERT INTO site_config (config_key, config_value)
         VALUES ($1, $2)
         ON CONFLICT (config_key) DO UPDATE SET config_value = $2`,
        [key, String(value)]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  HAPPY CLIENTS (Guerreros Satisfechos)
// ══════════════════════════════════════
r.get('/happy-clients', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM happy_clients ORDER BY order_index, id`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.post('/happy-clients', async (req, res) => {
  try {
    const { client_name, product_bought, description, rating, photo_url, order_index, is_active } = req.body;
    const result = await db.query(
      `INSERT INTO happy_clients (client_name, product_bought, description, rating, photo_url, order_index, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [client_name, product_bought || null, description || null, rating || 5, photo_url || null, order_index || 0, is_active ?? true]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.put('/happy-clients/:id', async (req, res) => {
  try {
    const { client_name, product_bought, description, rating, photo_url, order_index, is_active } = req.body;
    await db.query(
      `UPDATE happy_clients SET
         client_name=$1, product_bought=$2, description=$3, rating=$4,
         photo_url=$5, order_index=$6, is_active=$7
       WHERE id=$8`,
      [client_name, product_bought || null, description || null, rating || 5, photo_url || null, order_index || 0, is_active ?? true, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.delete('/happy-clients/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM happy_clients WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  USERS
// ══════════════════════════════════════
r.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, username, email, phone, role, avatar, banner, bio,
              celular, ambiente_numero, nombre_completo_real, sena_role,
              is_active, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.put('/users/:id', async (req, res) => {
  try {
    const { role, is_active } = req.body;
    const fields = [];
    const values = [];
    let i = 1;
    if (role !== undefined)      { fields.push(`role=$${i++}`);      values.push(role); }
    if (is_active !== undefined) { fields.push(`is_active=$${i++}`); values.push(is_active); }
    if (!fields.length) return res.json({ ok: true });
    values.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(',')} WHERE id=$${i}`, values);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  COUPONS
// ══════════════════════════════════════
r.get('/coupons', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM coupons ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.post('/coupons', async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_purchase, expires_at } = req.body;
    const result = await db.query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [code.toUpperCase(), description || null, discount_type || 'percent', discount_value, min_purchase || 0, expires_at || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.put('/coupons/:id', async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.query(`UPDATE coupons SET is_active=$1 WHERE id=$2`, [is_active ?? true, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  REELS
// ══════════════════════════════════════
r.get('/reels', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM reels ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.post('/reels', async (req, res) => {
  try {
    const { url, escala, titulo, descripcion, is_active } = req.body;
    if (!url) return res.status(400).json({ message: 'URL requerida' });
    const result = await db.query(
      `INSERT INTO reels (url, escala, titulo, descripcion, is_active)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [url, escala || 'horizontal', titulo || null, descripcion || null, is_active ?? true]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.put('/reels/:id', async (req, res) => {
  try {
    const { url, escala, titulo, descripcion, is_active } = req.body;
    await db.query(
      `UPDATE reels SET url=COALESCE($1,url), escala=COALESCE($2,escala),
         titulo=COALESCE($3,titulo), descripcion=COALESCE($4,descripcion),
         is_active=COALESCE($5,is_active)
       WHERE id=$6`,
      [url || null, escala || null, titulo || null, descripcion || null, is_active ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.delete('/reels/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM reels WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  GANANCIAS
// ══════════════════════════════════════
r.get('/ganancias', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM ganancias ORDER BY fecha DESC, created_at DESC`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.post('/ganancias', async (req, res) => {
  try {
    const { fecha, hora, tipo_cuenta, items, total, notas } = req.body;
    if (!fecha) return res.status(400).json({ message: 'Fecha requerida' });
    const result = await db.query(
      `INSERT INTO ganancias (fecha, hora, tipo_cuenta, items, total, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [fecha, hora || null, tipo_cuenta || null,
       typeof items === 'string' ? items : JSON.stringify(items || []),
       total || 0, notas || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

r.delete('/ganancias/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM ganancias WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ══════════════════════════════════════
//  NEWS (NOTICIAS)
// ══════════════════════════════════════
r.get('/news', async (req, res) => {
  try {
    const onlyActive = req.query.active === '1';
    const result = await db.query(
      `SELECT * FROM news ${onlyActive ? 'WHERE is_active=true' : ''} ORDER BY order_index, id DESC`
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.post('/news', admin, async (req, res) => {
  try {
    const { title, description, image_url, button_text, button_link, link_url, category, size, is_active, order_index } = req.body;
    const result = await db.query(
      `INSERT INTO news (title, description, image_url, button_text, button_link, link_url, category, size, is_active, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [title||null, description||null, image_url||null, button_text||null, button_link||null,
       link_url||null, category||null, size||'medium', is_active??true, order_index||0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.put('/news/:id', admin, async (req, res) => {
  try {
    const { title, description, image_url, button_text, button_link, link_url, category, size, is_active, order_index } = req.body;
    await db.query(
      `UPDATE news SET title=$1, description=$2, image_url=$3, button_text=$4, button_link=$5,
       link_url=$6, category=$7, size=$8, is_active=$9, order_index=$10 WHERE id=$11`,
      [title||null, description||null, image_url||null, button_text||null, button_link||null,
       link_url||null, category||null, size||'medium', is_active??true, order_index||0, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

r.delete('/news/:id', admin, async (req, res) => {
  try {
    await db.query(`DELETE FROM news WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════
//  KICK PROXY — evitar CORS
// ══════════════════════════════════════
r.get('/kick-status', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.json({ live: false, avatar: null });
    const resp = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(username)}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) return res.json({ live: false, avatar: null });
    const data = await resp.json();
    res.json({
      live: !!data.livestream,
      avatar: data.user?.profile_pic || null,
      title: data.livestream?.session_title || null,
      viewers: data.livestream?.viewer_count || 0
    });
  } catch (e) {
    res.json({ live: false, avatar: null });
  }
});


export default r;

