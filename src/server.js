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

app.get('/api/health', (_,res) => res.json({ ok:true, time: new Date() }));
app.get('*', (req,res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
    res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🔥 Servidor en puerto ${PORT}`);
  try {
    await createTables();
    await seedData();
    await ensureAdmin();
    console.log('✅ Base de datos lista');
  } catch(e) {
    console.error('⚠️ Error startup:', e.message);
  }
});

async function createTables() {
  const db = require('./config/db');
  const tables = [
    // ── USERS ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS users (
      id                   SERIAL PRIMARY KEY,
      full_name            VARCHAR(200) NOT NULL,
      username             VARCHAR(100) UNIQUE,
      email                VARCHAR(200) UNIQUE NOT NULL,
      password             VARCHAR(255) NOT NULL,
      phone                VARCHAR(30),
      role                 VARCHAR(20) DEFAULT 'client',
      avatar               VARCHAR(500),
      banner               VARCHAR(500),
      bio                  TEXT,
      is_active            BOOLEAN DEFAULT TRUE,
      celular              VARCHAR(30),
      ambiente_numero      VARCHAR(100),
      nombre_completo_real VARCHAR(200),
      sena_role            VARCHAR(20),
      reset_code           VARCHAR(10),
      reset_expires        TIMESTAMP,
      ubicacion_entrega    TEXT,
      created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── SITE CONFIG ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS site_config (
      id           SERIAL PRIMARY KEY,
      config_key   VARCHAR(100) UNIQUE NOT NULL,
      config_value TEXT DEFAULT ''
    )`,
    // ── CATEGORIES ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS categories (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(100) NOT NULL,
      icon      VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE
    )`,
    // ── PRODUCTS ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS products (
      id               SERIAL PRIMARY KEY,
      category_id      INT REFERENCES categories(id),
      name             VARCHAR(150) NOT NULL,
      description      TEXT,
      price            DECIMAL(10,2) NOT NULL,
      discount_percent INT DEFAULT 0,
      images           TEXT DEFAULT '[]',
      stock            INT DEFAULT 999,
      is_active        BOOLEAN DEFAULT TRUE,
      is_featured      BOOLEAN DEFAULT FALSE,
      dragon_ball_ref  VARCHAR(150),
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── COMBOS ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS combos (
      id               SERIAL PRIMARY KEY,
      name             VARCHAR(150) NOT NULL,
      description      TEXT,
      price            DECIMAL(10,2) NOT NULL,
      original_price   DECIMAL(10,2),
      images           TEXT DEFAULT '[]',
      is_active        BOOLEAN DEFAULT TRUE,
      is_featured      BOOLEAN DEFAULT FALSE,
      items            TEXT DEFAULT '[]',
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── CAROUSEL ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS carousel_slides (
      id           SERIAL PRIMARY KEY,
      image_url    VARCHAR(500),
      title        VARCHAR(200),
      subtitle     TEXT,
      button_text  VARCHAR(100),
      button_link  VARCHAR(200),
      order_index  INT DEFAULT 0,
      is_active    BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── ORDERS ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS orders (
      id                 SERIAL PRIMARY KEY,
      user_id            INT REFERENCES users(id),
      order_number       VARCHAR(100) UNIQUE,
      status             VARCHAR(30) DEFAULT 'pending',
      payment_method     VARCHAR(30) DEFAULT 'cash',
      payment_status     VARCHAR(30) DEFAULT 'pending',
      payment_proof      VARCHAR(500),
      total              DECIMAL(12,2) DEFAULT 0,
      delivery_address   TEXT,
      notes              TEXT,
      customer_name      VARCHAR(200),
      customer_phone     VARCHAR(30),
      customer_ambiente  VARCHAR(100),
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── ORDER ITEMS ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS order_items (
      id          SERIAL PRIMARY KEY,
      order_id    INT REFERENCES orders(id) ON DELETE CASCADE,
      product_id  INT,
      combo_id    INT,
      quantity    INT DEFAULT 1,
      unit_price  DECIMAL(10,2) DEFAULT 0,
      extras      TEXT DEFAULT '{}'
    )`,
    // ── ORDER MESSAGES ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS order_messages (
      id          SERIAL PRIMARY KEY,
      order_id    INT REFERENCES orders(id) ON DELETE CASCADE,
      sender_role VARCHAR(10) DEFAULT 'admin',
      message     TEXT NOT NULL,
      is_read     BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── REVIEWS ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reviews (
      id         SERIAL PRIMARY KEY,
      user_id    INT REFERENCES users(id),
      product_id INT REFERENCES products(id),
      rating     INT DEFAULT 5,
      comment    TEXT,
      is_active  BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── HAPPY CLIENTS ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS happy_clients (
      id            SERIAL PRIMARY KEY,
      client_name   VARCHAR(200) NOT NULL,
      product_bought VARCHAR(200),
      description   TEXT,
      rating        INT DEFAULT 5,
      photo_url     VARCHAR(500),
      order_index   INT DEFAULT 0,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── OPINIONS ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS opinions (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(200) NOT NULL,
      email          VARCHAR(200),
      phone          VARCHAR(50),
      subject        VARCHAR(300),
      message        TEXT NOT NULL,
      type           VARCHAR(50) DEFAULT 'suggestion',
      status         VARCHAR(20) DEFAULT 'new',
      admin_response TEXT,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── COUPONS ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS coupons (
      id             SERIAL PRIMARY KEY,
      code           VARCHAR(50) UNIQUE NOT NULL,
      description    VARCHAR(300),
      discount_type  VARCHAR(20) DEFAULT 'percent',
      discount_value DECIMAL(10,2) DEFAULT 0,
      min_purchase   DECIMAL(10,2) DEFAULT 0,
      is_active      BOOLEAN DEFAULT TRUE,
      used_count     INT DEFAULT 0,
      expires_at     TIMESTAMP,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── GANANCIAS ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ganancias (
      id          SERIAL PRIMARY KEY,
      fecha       DATE NOT NULL,
      hora        TIME,
      tipo_cuenta VARCHAR(50),
      items       JSONB DEFAULT '[]',
      total       DECIMAL(12,2) DEFAULT 0,
      notas       TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── REELS ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reels (
      id          SERIAL PRIMARY KEY,
      url         VARCHAR(500) NOT NULL,
      escala      VARCHAR(20) DEFAULT 'horizontal',
      titulo      VARCHAR(200),
      descripcion TEXT,
      is_active   BOOLEAN DEFAULT TRUE,
      order_index INT DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of tables) {
    try { await db.query(sql); } catch(e) { console.warn('Table warn:', e.message.slice(0,60)); }
  }
  // Columnas extra por si las tablas ya existían sin ellas
  const alters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS celular VARCHAR(30)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ambiente_numero VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre_completo_real VARCHAR(200)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS sena_role VARCHAR(20)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_ambiente VARCHAR(100)`,
    `ALTER TABLE opinions ADD COLUMN IF NOT EXISTS admin_response TEXT`,
  ];
  for (const sql of alters) {
    try { await db.query(sql); } catch(e) {}
  }
  console.log('✅ Tablas listas');
}

async function seedData() {
  const db = require('./config/db');

  // Site config
  const configs = [
    ['site_name','Empanadas Kame'],['nequi_name','Empanadas Kame'],
    ['nequi_phone','3001234567'],['nequi_qr',''],
    ['primary_color','#FF6B00'],['secondary_color','#FFD700'],['accent_color','#CC0000'],
  ];
  for (const [k,v] of configs) {
    await db.query(`INSERT INTO site_config(config_key,config_value) VALUES($1,$2) ON CONFLICT(config_key) DO NOTHING`,[k,v]);
  }

  // Categories
  const cats = await db.query('SELECT COUNT(*) FROM categories');
  if (parseInt(cats.rows[0].count) === 0) {
    await db.query(`INSERT INTO categories(name,icon) VALUES('Empanadas','🥟'),('Adiciones','🥤')`);
    console.log('✅ Categorías creadas');
  }

  // Products
  const prods = await db.query('SELECT COUNT(*) FROM products');
  if (parseInt(prods.rows[0].count) === 0) {
    const catRes = await db.query("SELECT id FROM categories WHERE name='Empanadas' LIMIT 1");
    const catId = catRes.rows[0]?.id || 1;
    const addRes = await db.query("SELECT id FROM categories WHERE name='Adiciones' LIMIT 1");
    const addId = addRes.rows[0]?.id || 2;
    const productData = [
      [catId,'Empanada de Carne','Carne molida sazonada con especias secretas del Templo Kame',2500,0,'["https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400"]',true,true,'Goku'],
      [catId,'Empanada de Pollo','Pollo desmenuzado con verduras frescas',2500,0,'["https://images.unsplash.com/photo-1593759608142-e976b9c55541?w=400"]',true,true,'Vegeta'],
      [catId,'Empanada de Queso','Queso derretido estilo Namek',2500,0,'["https://images.unsplash.com/photo-1630377837810-d1b7e7f9f526?w=400"]',true,false,'Piccolo'],
      [catId,'Empanada Mixta','Carne y pollo combinados',2800,0,'["https://images.unsplash.com/photo-1627662235912-4c8d58be0f57?w=400"]',true,false,'Gohan'],
      [catId,'Empanada de Champiñón','Para los guerreros vegetarianos',2500,10,'["https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400"]',true,false,'Krilin'],
      [addId,'Gaseosa','Coca-Cola, Pepsi o agua',1500,0,'["https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400"]',true,false,'Gaseosas'],
      [addId,'Salsa de Ajo','Preparada en el Templo Kame',500,0,'[]',true,false,'Salsas'],
      [addId,'Salsa Picante','Para guerreros sin miedo',500,0,'[]',true,false,'Salsas'],
    ];
    for (const [cid,name,desc,price,disc,imgs,active,feat,ref] of productData) {
      await db.query(
        `INSERT INTO products(category_id,name,description,price,discount_percent,images,is_active,is_featured,dragon_ball_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cid,name,desc,price,disc,imgs,active,feat,ref]
      );
    }
    console.log('✅ Productos creados');
  }

  // Combos
  const combos = await db.query('SELECT COUNT(*) FROM combos');
  if (parseInt(combos.rows[0].count) === 0) {
    await db.query(`INSERT INTO combos(name,description,price,original_price,images,is_active,is_featured) VALUES
      ('Combo Guerrero Z','3 empanadas de tu elección + gaseosa',8000,9500,'["https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400"]',true,true),
      ('Combo Súper Saiyan','5 empanadas + 2 gaseosas + 2 salsas',13000,16500,'["https://images.unsplash.com/photo-1593759608142-e976b9c55541?w=400"]',true,true),
      ('Combo Namekiano','2 empanadas de queso + salsa de ajo',5500,6500,'["https://images.unsplash.com/photo-1630377837810-d1b7e7f9f526?w=400"]',true,false)`
    );
    console.log('✅ Combos creados');
  }

  // Carousel
  const slides = await db.query('SELECT COUNT(*) FROM carousel_slides');
  if (parseInt(slides.rows[0].count) === 0) {
    await db.query(`INSERT INTO carousel_slides(image_url,title,subtitle,button_text,button_link,order_index,is_active) VALUES
      ('https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1400','¡El Sabor del Guerrero!','Empanadas artesanales con el poder del Kame Sennin','Ver Menú','products',0,true),
      ('https://images.unsplash.com/photo-1593759608142-e976b9c55541?w=1400','Combos Épicos','Únelas todas y pide tu deseo: ¡más empanadas!','Ver Combos','combos',1,true),
      ('https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=1400','Guerreros del Sabor','Más de 100 clientes satisfechos en el Templo Kame','Nuestros Clientes','clients',2,true)`
    );
    console.log('✅ Carrusel creado');
  }

  // Happy clients
  const hc = await db.query('SELECT COUNT(*) FROM happy_clients');
  if (parseInt(hc.rows[0].count) === 0) {
    await db.query(`INSERT INTO happy_clients(client_name,product_bought,description,rating,photo_url,order_index,is_active) VALUES
      ('Goku','Empanada de Carne','¡Están más ricas que las esferas del dragón! Las como antes de cada entrenamiento.', 5,'https://i.imgur.com/KAaVDZ3.png',0,true),
      ('Vegeta','Combo Súper Saiyan','El príncipe de los Saiyajins no acepta menos que lo mejor. Estas empanadas están a la altura.',5,'https://i.imgur.com/jZVjeDf.png',1,true),
      ('Bulma','Empanada de Queso','Perfectas para recargar energía entre inventos. Las recomiendo al 100%.',5,'https://i.imgur.com/oWnMHqQ.png',2,true),
      ('Krilin','Empanada de Pollo','Sobreviví la Cell Games gracias a estas empanadas. Son legendarias.',5,'https://i.imgur.com/X7j2kQD.png',3,true)`
    );
    console.log('✅ Guerreros satisfechos creados');
  }
}

async function ensureAdmin() {
  const db = require('./config/db');
  const result = await db.query(`SELECT id FROM users WHERE email=$1`,['admin@kame.com']);
  const hash = await bcrypt.hash('admin123', 10);
  if (!result.rows.length) {
    await db.query(
      `INSERT INTO users(full_name,username,email,password,role,is_active) VALUES($1,$2,$3,$4,$5,$6)`,
      ['Maestro Roshi','admin','admin@kame.com',hash,'admin',true]
    );
    console.log('✅ Admin creado → admin@kame.com / admin123');
  } else {
    await db.query(`UPDATE users SET password=$1 WHERE email=$2`,[hash,'admin@kame.com']);
    console.log('✅ Admin OK → admin@kame.com / admin123');
  }
}
