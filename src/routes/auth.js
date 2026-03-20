const r = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

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
      `INSERT INTO users(full_name, username, email, password, phone, ambiente_numero, nombre_completo_real, celular, sena_role)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, full_name, email, role`,
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
      `SELECT id, full_name, username, email, phone, role, avatar, banner, bio, created_at,
              celular, ambiente_numero, nombre_completo_real, sena_role
       FROM users WHERE id=$1`, [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'No encontrado' });
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
r.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    // No revelar si existe o no — siempre responder OK
    if (!result.rows.length) return res.json({ ok: true });

    const code    = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.query(
      'UPDATE users SET reset_code=$1, reset_expires=$2 WHERE email=$3',
      [code, expires, email]
    );

    // Enviar email — si no hay SMTP configurado, loguear el código
    const nodemailer = require('nodemailer');
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: +process.env.SMTP_PORT || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: `"Empanadas Kame" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '🔑 Tu código de recuperación — Empanadas Kame',
        html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#FF6B00">Empanadas Kame 🐉</h2>
          <p>Tu código de recuperación de contraseña es:</p>
          <div style="font-size:2.5rem;font-weight:bold;letter-spacing:8px;color:#FF6B00;padding:20px;background:#f9f9f9;border-radius:10px;text-align:center">${code}</div>
          <p style="color:#888;font-size:.85rem">Válido por 30 minutos. Si no solicitaste esto, ignora este mensaje.</p>
        </div>`
      });
    } else {
      // Sin SMTP — mostrar código en consola para desarrollo
      console.log(`[KAME] Código de recuperación para ${email}: ${code}`);
    }

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
r.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!code || !newPassword) return res.status(400).json({ message: 'Datos incompletos' });

    const result = await db.query(
      'SELECT id, reset_code, reset_expires FROM users WHERE email=$1', [email]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Email no encontrado' });

    const user = result.rows[0];
    if (user.reset_code !== code) return res.status(400).json({ message: 'Código incorrecto' });
    if (!user.reset_expires || new Date() > new Date(user.reset_expires)) {
      return res.status(400).json({ message: 'El código ha expirado. Solicita uno nuevo.' });
    }
    if (newPassword.length < 6) return res.status(400).json({ message: 'La contraseña debe tener mínimo 6 caracteres' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password=$1, reset_code=NULL, reset_expires=NULL WHERE id=$2',
      [hash, user.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
