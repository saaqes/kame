import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

// ✅ IMPORT DB (SOLO AQUÍ)
import db from './config/db.js';

// rutas
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import comboRoutes from './routes/combos.js';
import orderRoutes from './routes/orders.js';
import carouselRoutes from './routes/carousel.js';
import miscRoutes from './routes/misc.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes from './routes/sales.js';

const app = express();

// fix __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/carousel', carouselRoutes);
app.use('/api', miscRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);

// health
app.get('/api/health', (_, res) => res.json({ ok: true }));

// frontend fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// puerto
const PORT = process.env.PORT || 3000;

// iniciar servidor
app.listen(PORT, async () => {
  console.log(`🔥 Servidor en puerto ${PORT}`);
  await setupDB();
});


// ==============================
// 🔥 SETUP BASE DE DATOS
// ==============================
async function setupDB() {
  const sql = [

    // 👇 TIPOS DE EMPANADAS
    `CREATE TABLE IF NOT EXISTS empanada_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      price INTEGER NOT NULL
    )`,

    // 👇 INVENTARIO
    `CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      type_id INT UNIQUE REFERENCES empanada_types(id),
      quantity INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 👇 VENTAS
    `CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      type_id INT REFERENCES empanada_types(id),
      quantity INT NOT NULL,
      total INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`

  ];

  // crear tablas
  for (const q of sql) {
    try {
      await db.query(q);
    } catch (e) {
      console.error('❌ Error creando tabla:', e.message);
    }
  }

  // insertar tipos por defecto
  try {
    const t = await db.query('SELECT COUNT(*) FROM empanada_types');

    if (parseInt(t.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO empanada_types (name, price) VALUES
        ('carne', 2000),
        ('pollo', 2000),
        ('mixta', 3000)
      `);

      console.log('✅ Tipos de empanadas creados');
    }
  } catch (e) {
    console.error('❌ Error insertando tipos:', e.message);
  }

  // insertar inventario inicial
  try {
    await db.query(`
      INSERT INTO inventory (type_id, quantity)
      VALUES (1, 1000), (2, 1000), (3, 1000)
      ON CONFLICT (type_id) DO NOTHING
    `);
  } catch (e) {
    console.error('❌ Error inventario inicial:', e.message);
  }

  console.log('✅ Inventario listo');
}
