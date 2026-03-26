import express from 'express';
import db from '../config/db.js';
import { auth, admin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const r = express.Router();

// helper
const toBool = v => v === true || v === 'true' || v === 1 || v === '1';


// ── REVIEWS ─────────────────────────────
r.post('/reviews', auth, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;

    const result = await db.query(
      `INSERT INTO reviews(user_id,product_id,rating,comment)
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
      `INSERT INTO opinions(name,email,phone,subject,message,type)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [name, email || null, phone || null, subject || null, message, type || 'suggestion']
    );

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── CLIENTS ─────────────────────────────
r.get('/clients', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM happy_clients WHERE is_active=true ORDER BY order_index'
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
      `SELECT config_key,config_value
       FROM site_config
       WHERE config_key IN ('nequi_phone','nequi_qr','nequi_name')`
    );

    const o = {};
    result.rows.forEach(x => o[x.config_key] = x.config_value);

    res.json(o);

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── PERFIL ──────────────────────────────
r.get('/me/profile', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id,full_name,username,email,phone,role,avatar,banner,bio,
              ambiente_numero,nombre_completo_real,celular,sena_role,created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );

    res.json(result.rows[0] || {});

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── AVATAR ──────────────────────────────
r.post('/me/avatar',
  auth,
  (req, res, next) => { req.driveFolder = 'avatars'; next(); },
  ...upload('file'),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) {
        return res.status(400).json({ message: 'No file' });
      }

      await db.query(
        'UPDATE users SET avatar=$1 WHERE id=$2',
        [req.file.savedUrl, req.user.id]
      );

      res.json({ url: req.file.savedUrl });

    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);


// ── UPLOAD GENÉRICO ─────────────────────
r.post('/api/upload',
  auth,
  admin,
  (req, res, next) => { req.driveFolder = req.query.folder || 'general'; next(); },
  ...upload('file'),
  (req, res) => {
    if (!req.file?.savedUrl) {
      return res.status(400).json({ message: 'No file' });
    }

    res.json({ url: req.file.savedUrl });
  }
);


// 🔥 EXPORT FINAL (CLAVE)
export default r;
