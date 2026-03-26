const r      = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
import db from '../config/db.js';
const { auth } = require('../middleware/auth');
const upload   = require('../middleware/upload');

// ── REGISTER ──────────────────────────────────────────────────────────────────
r.post('/register', async (req, res) => {
  try {
    const { full_name, username, email, password, phone, ambiente_numero, nombre_completo_real, sena_role } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos' });
    if (!phone)           return res.status(400).json({ message: 'El teléfono es obligatorio' });
    if (!ambiente_numero) return res.status(400).json({ message: 'El número de ambiente es obligatorio' });
    const userNameFinal = username || email.split('@')[0];
    const exist = await db.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, userNameFinal]);
    if (exist.rows.length) return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users(full_name,username,email,password,phone,ambiente_numero,nombre_completo_real,celular,sena_role)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,full_name,email,role`,
      [full_name, userNameFinal, email, hash, phone||null, ambiente_numero||null,
       nombre_completo_real||full_name, phone||null, sena_role||null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: 'client' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user, role: 'client' } });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
r.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
    if (!result.rows.length) return res.status(401).json({ message: 'Credenciales incorrectas' });
    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ME ────────────────────────────────────────────────────────────────────────
r.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id,full_name,username,email,phone,role,avatar,banner,bio,
              celular,ambiente_numero,nombre_completo_real,sena_role,created_at
       FROM users WHERE id=$1`, [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── AVATAR upload (archivo) ───────────────────────────────────────────────────
r.post('/me/avatar', auth,
  (req,res,next) => { req.driveFolder = 'avatars'; next(); },
  ...upload('avatar'),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) return res.status(400).json({ message: 'No se recibió imagen' });
      await db.query('UPDATE users SET avatar=$1 WHERE id=$2', [req.file.savedUrl, req.user.id]);
      res.json({ url: req.file.savedUrl, avatar: req.file.savedUrl });
    } catch(e) { res.status(500).json({ message: e.message }); }
  }
);

// ── AVATAR url (seleccionar preset DBZ) ──────────────────────────────────────
r.post('/me/avatar-url', auth, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) return res.status(400).json({ message: 'URL requerida' });
    await db.query('UPDATE users SET avatar=$1 WHERE id=$2', [avatar_url, req.user.id]);
    res.json({ url: avatar_url });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── BANNER upload ─────────────────────────────────────────────────────────────
r.post('/me/banner', auth,
  (req,res,next) => { req.driveFolder = 'banners'; next(); },
  ...upload('banner'),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) return res.status(400).json({ message: 'No se recibió imagen' });
      await db.query('UPDATE users SET banner=$1 WHERE id=$2', [req.file.savedUrl, req.user.id]);
      res.json({ url: req.file.savedUrl, banner: req.file.savedUrl });
    } catch(e) { res.status(500).json({ message: e.message }); }
  }
);

// ── FORGOT PASSWORD (sin nodemailer — código por consola/log) ─────────────────
r.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    // Siempre responder OK para no revelar si el email existe
    if (!result.rows.length) return res.json({ ok: true });

    const code    = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.query(
      'UPDATE users SET reset_code=$1,reset_expires=$2 WHERE email=$3',
      [code, expires, email]
    );

    // Si hay SMTP configurado, intentar enviar email
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: +(process.env.SMTP_PORT || 587),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: `"Empanadas Kame 🐉" <${process.env.SMTP_USER}>`,
          to: email,
          subject: '🔑 Código de recuperación — Empanadas Kame',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0A0F;color:#fff;padding:30px;border-radius:12px">
            <h2 style="color:#FF6B00;font-size:1.8rem;margin-bottom:16px">🐉 Empanadas Kame</h2>
            <p style="color:#aaa;margin-bottom:20px">Tu código de recuperación de contraseña:</p>
            <div style="font-size:2.5rem;font-weight:bold;letter-spacing:10px;color:#FF6B00;background:#1a1a2e;padding:20px;border-radius:10px;text-align:center;border:1px solid rgba(255,107,0,.3)">${code}</div>
            <p style="color:#666;font-size:.85rem;margin-top:16px">Válido por 30 minutos. Si no solicitaste esto, ignora este mensaje.</p>
          </div>`
        });
        console.log(`[KAME] Email enviado a ${email}`);
      } catch(mailErr) {
        // Falló el email pero el código ya está guardado — lo mostramos en logs
        console.log(`[KAME] No se pudo enviar email. Código para ${email}: ${code}`);
      }
    } else {
      // Sin SMTP — mostrar en logs de Render para que el admin pueda darlo manualmente
      console.log(`[KAME] ⚠️ Sin SMTP configurado. Código de recuperación para ${email}: ${code}`);
    }

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
r.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!code || !newPassword) return res.status(400).json({ message: 'Datos incompletos' });
    const result = await db.query('SELECT id,reset_code,reset_expires FROM users WHERE email=$1', [email]);
    if (!result.rows.length) return res.status(404).json({ message: 'Email no encontrado' });
    const user = result.rows[0];
    if (user.reset_code !== code) return res.status(400).json({ message: 'Código incorrecto' });
    if (!user.reset_expires || new Date() > new Date(user.reset_expires))
      return res.status(400).json({ message: 'El código ha expirado. Solicita uno nuevo.' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Mínimo 6 caracteres' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password=$1,reset_code=NULL,reset_expires=NULL WHERE id=$2', [hash, user.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
