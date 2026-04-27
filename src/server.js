import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import db from './config/db.js';

// rutas
import authRoutes      from './routes/auth.js';
import productRoutes   from './routes/products.js';
import comboRoutes     from './routes/combos.js';
import orderRoutes     from './routes/orders.js';
import carouselRoutes  from './routes/carousel.js';
import miscRoutes      from './routes/misc.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes     from './routes/sales.js';
import adminRoutes     from './routes/admin.js';   // ✅ NUEVO

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// rutas API
app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/combos',    comboRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/carousel',  carouselRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales',     salesRoutes);
app.use('/api/admin',     adminRoutes);  // ✅ NUEVO — todas las rutas /api/admin/*
app.use('/api',           miscRoutes);   // misc va de último (rutas genéricas)

// health
app.get('/api/health', (_, res) => res.json({ ok: true }));

// frontend fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🔥 Servidor en puerto ${PORT}`);
  await setupDB();
});


// ══════════════════════════════════════════════════════
//  SETUP BASE DE DATOS — crea TODAS las tablas necesarias
// ══════════════════════════════════════════════════════
async function setupDB() {
  const tables = [

    // ── USUARIOS ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS users (
      id                   SERIAL PRIMARY KEY,
      full_name            VARCHAR(120) NOT NULL,
      username             VARCHAR(60)  UNIQUE,
      email                VARCHAR(120) NOT NULL UNIQUE,
      password             VARCHAR(255) NOT NULL,
      phone                VARCHAR(30),
      role                 VARCHAR(20)  NOT NULL DEFAULT 'client',
      avatar               TEXT,
      banner               TEXT,
      bio                  TEXT,
      celular              VARCHAR(30),
      ambiente_numero      VARCHAR(20),
      nombre_completo_real VARCHAR(120),
      sena_role            VARCHAR(30),
      is_active            BOOLEAN      NOT NULL DEFAULT true,
      reset_code           VARCHAR(10),
      reset_expires        TIMESTAMP,
      created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── CATEGORÍAS ────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS categories (
      id   SERIAL PRIMARY KEY,
      name VARCHAR(60) NOT NULL
    )`,

    // ── PRODUCTOS ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS products (
      id               SERIAL PRIMARY KEY,
      category_id      INT REFERENCES categories(id),
      name             VARCHAR(120) NOT NULL,
      description      TEXT,
      price            INTEGER      NOT NULL DEFAULT 0,
      discount_percent INTEGER      NOT NULL DEFAULT 0,
      images           TEXT         NOT NULL DEFAULT '[]',
      stock            INTEGER      NOT NULL DEFAULT 999,
      is_featured      BOOLEAN      NOT NULL DEFAULT false,
      is_active        BOOLEAN      NOT NULL DEFAULT true,
      dragon_ball_ref  VARCHAR(80),
      created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── COMBOS ────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS combos (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(120) NOT NULL,
      description    TEXT,
      price          INTEGER      NOT NULL DEFAULT 0,
      original_price INTEGER,
      image_url      TEXT,
      dragon_ball_ref VARCHAR(80),
      is_featured    BOOLEAN      NOT NULL DEFAULT false,
      is_active      BOOLEAN      NOT NULL DEFAULT true,
      created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── ÓRDENES ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS orders (
      id               SERIAL PRIMARY KEY,
      user_id          INT REFERENCES users(id),
      order_number     VARCHAR(40) UNIQUE,
      total            INTEGER     NOT NULL DEFAULT 0,
      status           VARCHAR(30) NOT NULL DEFAULT 'pending',
      payment_method   VARCHAR(30) NOT NULL DEFAULT 'cash',
      payment_status   VARCHAR(30) NOT NULL DEFAULT 'pending',
      payment_proof    TEXT,
      delivery_address TEXT,
      notes            TEXT,
      customer_name    VARCHAR(120),
      customer_phone   VARCHAR(30),
      customer_ambiente VARCHAR(20),
      created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── ITEMS DE ORDEN ────────────────────────────────
    `CREATE TABLE IF NOT EXISTS order_items (
      id         SERIAL PRIMARY KEY,
      order_id   INT REFERENCES orders(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      combo_id   INT REFERENCES combos(id),
      quantity   INT     NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      extras     TEXT    NOT NULL DEFAULT '{}'
    )`,

    // ── MENSAJES DE ORDEN ─────────────────────────────
    `CREATE TABLE IF NOT EXISTS order_messages (
      id          SERIAL PRIMARY KEY,
      order_id    INT REFERENCES orders(id) ON DELETE CASCADE,
      sender_id   INT REFERENCES users(id),
      sender_role VARCHAR(20) NOT NULL DEFAULT 'admin',
      message     TEXT        NOT NULL,
      created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── RESEÑAS ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reviews (
      id          SERIAL PRIMARY KEY,
      user_id     INT REFERENCES users(id),
      product_id  INT REFERENCES products(id),
      rating      INT       NOT NULL DEFAULT 5,
      comment     TEXT,
      is_approved BOOLEAN   NOT NULL DEFAULT true,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── CARRUSEL ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS carousel_slides (
      id          SERIAL PRIMARY KEY,
      image_url   TEXT,
      title       VARCHAR(120),
      subtitle    TEXT,
      button_text VARCHAR(60),
      button_link VARCHAR(200),
      order_index INT     NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── GUERREROS SATISFECHOS ─────────────────────────
    `CREATE TABLE IF NOT EXISTS happy_clients (
      id             SERIAL PRIMARY KEY,
      client_name    VARCHAR(120) NOT NULL,
      product_bought VARCHAR(120),
      description    TEXT,
      rating         INT     NOT NULL DEFAULT 5,
      photo_url      TEXT,
      order_index    INT     NOT NULL DEFAULT 0,
      is_active      BOOLEAN NOT NULL DEFAULT true,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── OPINIONES / CONTACTO ──────────────────────────
    `CREATE TABLE IF NOT EXISTS opinions (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(120) NOT NULL,
      email          VARCHAR(120),
      phone          VARCHAR(30),
      subject        VARCHAR(200),
      message        TEXT        NOT NULL,
      type           VARCHAR(30) NOT NULL DEFAULT 'suggestion',
      status         VARCHAR(30) NOT NULL DEFAULT 'new',
      admin_response TEXT,
      created_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── CONFIGURACIÓN DEL SITIO ───────────────────────
    `CREATE TABLE IF NOT EXISTS site_config (
      id           SERIAL PRIMARY KEY,
      config_key   VARCHAR(80) NOT NULL UNIQUE,
      config_value TEXT
    )`,

    // ── CUPONES ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS coupons (
      id             SERIAL PRIMARY KEY,
      code           VARCHAR(40) NOT NULL UNIQUE,
      description    TEXT,
      discount_type  VARCHAR(20) NOT NULL DEFAULT 'percent',
      discount_value INTEGER     NOT NULL DEFAULT 0,
      min_purchase   INTEGER     NOT NULL DEFAULT 0,
      used_count     INTEGER     NOT NULL DEFAULT 0,
      is_active      BOOLEAN     NOT NULL DEFAULT true,
      expires_at     TIMESTAMP,
      created_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── REELS ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reels (
      id          SERIAL PRIMARY KEY,
      url         TEXT        NOT NULL,
      escala      VARCHAR(20) NOT NULL DEFAULT 'horizontal',
      titulo      VARCHAR(120),
      descripcion TEXT,
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── NOTICIAS ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS news (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(200),
      description TEXT,
      image_url   TEXT,
      button_text VARCHAR(100),
      button_link TEXT,
      link_url    TEXT,
      category    VARCHAR(80),
      size        VARCHAR(20) NOT NULL DEFAULT 'medium',
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      order_index INT         NOT NULL DEFAULT 0,
      created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── GANANCIAS ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ganancias (
      id          SERIAL PRIMARY KEY,
      fecha       DATE        NOT NULL,
      hora        VARCHAR(10),
      tipo_cuenta VARCHAR(40),
      items       TEXT        NOT NULL DEFAULT '[]',
      total       INTEGER     NOT NULL DEFAULT 0,
      notas       TEXT,
      created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── TIPOS DE EMPANADAS (legacy inventario) ────────
    `CREATE TABLE IF NOT EXISTS empanada_types (
      id    SERIAL PRIMARY KEY,
      name  VARCHAR(50) NOT NULL,
      price INTEGER     NOT NULL
    )`,

    // ── INVENTARIO ────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS inventory (
      id         SERIAL PRIMARY KEY,
      type_id    INT UNIQUE REFERENCES empanada_types(id),
      quantity   INT       NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── VENTAS (legacy) ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS sales (
      id         SERIAL PRIMARY KEY,
      type_id    INT REFERENCES empanada_types(id),
      quantity   INT     NOT NULL,
      total      INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const q of tables) {
    try {
      await db.query(q);
    } catch (e) {
      console.error('❌ Error creando tabla:', e.message);
    }
  }

  // Datos por defecto
  await seedDefaults();

  console.log('✅ Base de datos lista');
}

async function seedDefaults() {
  // Categorías
  try {
    const cats = await db.query('SELECT COUNT(*) FROM categories');
    if (+cats.rows[0].count === 0) {
      await db.query(`INSERT INTO categories (name) VALUES ('Empanadas'), ('Adiciones')`);
      console.log('✅ Categorías creadas');
    }
  } catch (e) { console.error('❌ Categorías:', e.message); }

  // Tipos de empanadas
  try {
    const t = await db.query('SELECT COUNT(*) FROM empanada_types');
    if (+t.rows[0].count === 0) {
      await db.query(`
        INSERT INTO empanada_types (name, price) VALUES
        ('carne', 2000), ('pollo', 2000), ('mixta', 3000)
      `);
    }
  } catch (e) { console.error('❌ Empanada types:', e.message); }

  // Inventario inicial
  try {
    await db.query(`
      INSERT INTO inventory (type_id, quantity)
      VALUES (1, 1000), (2, 1000), (3, 1000)
      ON CONFLICT (type_id) DO NOTHING
    `);
  } catch (e) { console.error('❌ Inventario:', e.message); }

  // Config por defecto
  try {
    const defaults = [
      ['site_name',        'Empanadas Kame'],
      ['primary_color',    '#FF6B00'],
      ['secondary_color',  '#FFD700'],
      ['accent_color',     '#CC0000'],
      ['nequi_phone',      ''],
      ['nequi_name',       ''],
      ['kick_username',    ''],
      ['kick_avatar',      ''],
    ];
    for (const [key, val] of defaults) {
      await db.query(
        `INSERT INTO site_config (config_key, config_value)
         VALUES ($1, $2) ON CONFLICT (config_key) DO NOTHING`,
        [key, val]
      );
    }
  } catch (e) { console.error('❌ Site config:', e.message); }
}
