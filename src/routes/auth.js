import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

// si tienes estos middlewares déjalos, si no, comenta esas líneas
import { auth } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const r = express.Router();


// ── REGISTER ─────────────────────────────────────────
r.post('/register', async (req, res) => {
  try {
    const {
      full_name,
      username,
      email,
      password,
      phone,
      ambiente_numero,
      nombre_completo_real,
      sena_role
    } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos' });
    }

    const userNameFinal = username || email.split('@')[0];

    const exist = await db.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email, userNameFinal]
    );

    if (exist.rows.length) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users(
        full_name, username, email, password,
        phone, ambiente_numero, nombre_completo_real, celular, sena_role
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, full_name, email, role`,
      [
        full_name,
        userNameFinal,
        email,
        hash,
        phone || null,
        ambiente_numero || null,
        nombre_completo_real || full_name,
        phone || null,
        sena_role || null
      ]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, role: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { ...user, role: 'client' }
    });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── LOGIN ────────────────────────────────────────────
r.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT * FROM users WHERE email=$1 AND is_active=true',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...safe } = user;

    res.json({ token, user: safe });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── ME ───────────────────────────────────────────────
r.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, username, email, phone, role,
              avatar, banner, bio,
              celular, ambiente_numero, nombre_completo_real,
              sena_role, created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );

    res.json(result.rows[0] || {});

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── AVATAR upload ────────────────────────────────────
r.post('/me/avatar',
  auth,
  (req, res, next) => { req.driveFolder = 'avatars'; next(); },
  ...upload('avatar'),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) {
        return res.status(400).json({ message: 'No se recibió imagen' });
      }

      await db.query(
        'UPDATE users SET avatar=$1 WHERE id=$2',
        [req.file.savedUrl, req.user.id]
      );

      res.json({ avatar: req.file.savedUrl });

    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);


// ── AVATAR URL ───────────────────────────────────────
r.post('/me/avatar-url', auth, async (req, res) => {
  try {
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ message: 'URL requerida' });
    }

    await db.query(
      'UPDATE users SET avatar=$1 WHERE id=$2',
      [avatar_url, req.user.id]
    );

    res.json({ avatar: avatar_url });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ── BANNER upload ────────────────────────────────────
r.post('/me/banner',
  auth,
  (req, res, next) => { req.driveFolder = 'banners'; next(); },
  ...upload('banner'),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) {
        return res.status(400).json({ message: 'No se recibió imagen' });
      }

      await db.query(
        'UPDATE users SET banner=$1 WHERE id=$2',
        [req.file.savedUrl, req.user.id]
      );

      res.json({ banner: req.file.savedUrl });

    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);


// ── FORGOT PASSWORD ──────────────────────────────────
r.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const result = await db.query(
      'SELECT id FROM users WHERE email=$1',
      [email]
    );

    if (!result.rows.length) return res.json({ ok: true });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    await db.query(
      'UPDATE users SET reset_code=$1, reset_expires=$2 WHERE email=$3',
      [code, expires, email]
    );

    console.log('Código recuperación:', code);

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// 🔥 EXPORT CORRECTO (CLAVE)
export default r;
