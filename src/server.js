require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const app     = express();

// Auto-crear/actualizar admin al arrancar
async function ensureAdmin() {
  try {
    const db = require('./config/db');

    // Auto-migrate: agregar columnas nuevas si no existen (sintaxis PostgreSQL)
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS ambiente_numero VARCHAR(50)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre_completo_real VARCHAR(200)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS celular VARCHAR(20)",
      `CREATE TABLE IF NOT EXISTS order_messages (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL,
        sender_role VARCHAR(10) DEFAULT 'admin' CHECK (sender_role IN ('admin','client')),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )`
    ];
    for (const sql of migrations) {
      try { await db.query(sql); } catch(e) { /* columna ya existe */ }
    }

    // ✅ CORREGIDO: sintaxis PostgreSQL ($1) en vez de MySQL (?)
    const result = await db.query('SELECT id FROM users WHERE email=$1', ['admin@kame.com']);
    const rows = result.rows;
    const hash = await bcrypt.hash('admin123', 10);

    if (!rows.length) {
      await db.query(
        'INSERT INTO users(full_name,username,email,password,role) VALUES($1,$2,$3,$4,$5)',
        ['Maestro Roshi', 'admin', 'admin@kame.com', hash, 'admin']
      );
      console.log('✅ Admin creado: admin@kame.com / admin123');
    } else {
      await db.query('UPDATE users SET password=$1 WHERE email=$2', [hash, 'admin@kame.com']);
      console.log('✅ Admin listo: admin@kame.com / admin123');
    }
  } catch(e) {
    console.error('⚠️  Error en ensureAdmin:', e.message);
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static: uploads y frontend
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/combos',   require('./routes/combos'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/carousel', require('./routes/carousel'));
app.use('/api',          require('./routes/misc'));

app.get('/api/health', (_, res) => res.json({ ok: true, msg: '🔥 Empanadas Kame API activa' }));

// SPA fallback — todas las rutas van al index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🔥 Servidor corriendo en puerto ${PORT}`);
  await ensureAdmin();
});
