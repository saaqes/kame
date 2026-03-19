const r = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// REGISTER
r.post('/register', async (req, res) => {
  try {
    const { full_name, username, email, password, phone, ambiente_numero, nombre_completo_real } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos' });
    }
    if (!phone) {
      return res.status(400).json({ message: 'El teléfono es obligatorio' });
    }
    if (!ambiente_numero) {
      return res.status(400).json({ message: 'El número de ambiente/apartamento es obligatorio' });
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
      `INSERT INTO users(full_name, username, email, password, phone, ambiente_numero, nombre_completo_real, celular)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, full_name, email, role`,
      [full_name, userNameFinal, email, hash, phone||null,
       ambiente_numero||null, nombre_completo_real||full_name, phone||null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: 'client' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user, role: 'client' } });

  } catch(e) { res.status(500).json({ message: e.message }); }
});

// LOGIN
r.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query(
      'SELECT * FROM users WHERE email=$1 AND is_active=true', [email]
    );
    if (!result.rows.length) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });

  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ME
r.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, username, email, phone, role, avatar, banner, bio, created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'No encontrado' });
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
