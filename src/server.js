import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

app.get('/api/health', (_, res) => res.json({ ok: true }));

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
