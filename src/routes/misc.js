import express from 'express';
import db from '../config/db.js';
import { auth, admin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const r = express.Router();


// ── REVIEWS ─────────────────────────────
r.post('/reviews', auth, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;
    const result = await db.query(
      `INSERT INTO reviews(user_id, product_id, rating, comment)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [req.user.id, product_id, rating, comment]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── OPINIONS ────────────────────────────
r.post('/opinions', async (req, res) => {
  try {
    const { name, email, phone, subject, message, type } = req.body;
    if (!name || !message) {
      return res.status(400).json({ message: 'Nombre y mensaje requeridos' });
    }
    await db.query(
      `INSERT INTO opinions(name, email, phone, subject, message, type)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [name, email || null, phone || null, subject || null, message, type || 'suggestion']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── CLIENTS PÚBLICOS (home page) ─────────
r.get('/clients', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM happy_clients WHERE is_active=true ORDER BY order_index, id'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── NEQUI ───────────────────────────────
r.get('/payment/nequi', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT config_key, config_value FROM site_config
       WHERE config_key IN ('nequi_phone','nequi_qr','nequi_name')`
    );
    const o = {};
    result.rows.forEach(x => { o[x.config_key] = x.config_value; });
    res.json(o);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── PERFIL ──────────────────────────────
r.get('/me/profile', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, username, email, phone, role, avatar, banner, bio,
              ambiente_numero, nombre_completo_real, celular, sena_role, created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── UPDATE PERFIL ───────────────────────
r.put('/me/profile', auth, async (req, res) => {
  try {
    const { full_name, username, phone, bio, celular, ambiente_numero, nombre_completo_real } = req.body;
    await db.query(
      `UPDATE users SET
         full_name=$1, username=$2, phone=$3, bio=$4,
         celular=$5, ambiente_numero=$6, nombre_completo_real=$7
       WHERE id=$8`,
      [full_name, username, phone || null, bio || null,
       celular || null, ambiente_numero || null, nombre_completo_real || null,
       req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── AVATAR upload ────────────────────────
r.post('/me/avatar',
  auth,
  (req, res, next) => { req.driveFolder = 'avatars'; next(); },
  ...upload(),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) return res.status(400).json({ message: 'No file' });
      await db.query('UPDATE users SET avatar=$1 WHERE id=$2', [req.file.savedUrl, req.user.id]);
      res.json({ url: req.file.savedUrl, avatar: req.file.savedUrl });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);

// ── AVATAR URL ───────────────────────────
r.post('/me/avatar-url', auth, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) return res.status(400).json({ message: 'URL requerida' });
    await db.query('UPDATE users SET avatar=$1 WHERE id=$2', [avatar_url, req.user.id]);
    res.json({ avatar: avatar_url });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── BANNER upload ────────────────────────
r.post('/me/banner',
  auth,
  (req, res, next) => { req.query.folder = 'banners'; next(); },
  ...upload(),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) return res.status(400).json({ message: 'No file' });
      await db.query('UPDATE users SET banner=$1 WHERE id=$2', [req.file.savedUrl, req.user.id]);
      res.json({ banner: req.file.savedUrl });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);


// ── UPLOAD GENÉRICO ─────────────────────
// ✅ FIX: era '/api/upload' (ruta duplicada) → ahora '/upload'
//    montado en /api → accesible como /api/upload
r.post('/upload',
  auth,
  admin,
  (req, res, next) => { req.driveFolder = req.query.folder || 'general'; next(); },
  ...upload(),
  (req, res) => {
    if (!req.file?.savedUrl) return res.status(400).json({ message: 'No file' });
    res.json({ url: req.file.savedUrl });
  }
);


export default r;
