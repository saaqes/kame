require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const app     = express();

app.use(cors());
app.use(express.json({ limit:'50mb' }));
app.use(express.urlencoded({ extended:true, limit:'50mb' }));
app.use('/uploads', express.static(path.join(__dirname,'uploads')));
app.use(express.static(path.join(__dirname,'public')));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/combos',   require('./routes/combos'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/carousel', require('./routes/carousel'));
app.use('/api',          require('./routes/misc'));

app.get('/api/health', (_,res) => res.json({ ok:true }));
app.get('*', (req,res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
    res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🔥 Servidor en puerto ${PORT}`);
  await migrate();
  await ensureAdmin();
});

async function migrate() {
  const db = require('./config/db');
  const sqls = [
    // ── Columnas extra en users
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ambiente_numero VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre_completo_real VARCHAR(200)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS celular VARCHAR(30)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS sena_role VARCHAR(20)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ubicacion_entrega TEXT`,
    // ── Columnas extra en orders
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_ambiente VARCHAR(100)`,
    // ── Tabla site_config
    `CREATE TABLE IF NOT EXISTS site_config (
      id SERIAL PRIMARY KEY,
      config_key VARCHAR(100) UNIQUE NOT NULL,
      config_value TEXT DEFAULT ''
    )`,
    // ── Valores por defecto site_config
    `INSERT INTO site_config(config_key,config_value) VALUES
      ('site_name','Empanadas Kame'),('nequi_name',''),
      ('nequi_phone',''),('nequi_qr',''),
      ('primary_color','#FF6B00'),('secondary_color','#FFD700'),('accent_color','#CC0000')
     ON CONFLICT(config_key) DO NOTHING`,
    // ── Tabla order_messages
    `CREATE TABLE IF NOT EXISTS order_messages (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL,
      sender_role VARCHAR(10) DEFAULT 'admin',
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── Tabla ganancias
    `CREATE TABLE IF NOT EXISTS ganancias (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      hora TIME,
      tipo_cuenta VARCHAR(50),
      items JSONB DEFAULT '[]',
      total DECIMAL(12,2) DEFAULT 0,
      notas TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── Tabla reels
    `CREATE TABLE IF NOT EXISTS reels (
      id SERIAL PRIMARY KEY,
      url VARCHAR(500) NOT NULL,
      escala VARCHAR(20) DEFAULT 'horizontal',
      titulo VARCHAR(200),
      descripcion TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── Tabla opinions (por si no existe)
    `CREATE TABLE IF NOT EXISTS opinions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200),
      phone VARCHAR(50),
      subject VARCHAR(300),
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'suggestion',
      status VARCHAR(20) DEFAULT 'new',
      admin_response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── Tabla happy_clients
    `CREATE TABLE IF NOT EXISTS happy_clients (
      id SERIAL PRIMARY KEY,
      client_name VARCHAR(200) NOT NULL,
      product_bought VARCHAR(200),
      description TEXT,
      rating INT DEFAULT 5,
      photo_url VARCHAR(500),
      order_index INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── Tabla coupons
    `CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      description VARCHAR(300),
      discount_type VARCHAR(20) DEFAULT 'percent',
      discount_value DECIMAL(10,2) DEFAULT 0,
      min_purchase DECIMAL(10,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      used_count INT DEFAULT 0,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of sqls) {
    try { await db.query(sql); }
    catch(e) { /* columna/tabla ya existe */ }
  }
  console.log('✅ Migraciones completadas');
}

async function ensureAdmin() {
  try {
    const db = require('./config/db');
    const result = await db.query(`SELECT id FROM users WHERE email=$1`,['admin@kame.com']);
    const hash = await bcrypt.hash('admin123', 10);
    if (!result.rows.length) {
      await db.query(
        `INSERT INTO users(full_name,username,email,password,role) VALUES($1,$2,$3,$4,$5)`,
        ['Maestro Roshi','admin','admin@kame.com',hash,'admin']
      );
      console.log('✅ Admin creado: admin@kame.com / admin123');
    } else {
      await db.query(`UPDATE users SET password=$1 WHERE email=$2`,[hash,'admin@kame.com']);
      console.log('✅ Admin OK: admin@kame.com / admin123');
    }
  } catch(e) { console.error('⚠️ ensureAdmin error:', e.message); }
}
