import express from 'express';
import db from '../config/db.js'; // 👈 ESTA LÍNEA ES LA CLAVE

const router = express.Router();

router.get('/', async (req, res) => {
  const r = await db.query(`
    SELECT i.id, t.name, t.price, i.quantity
    FROM inventory i
    JOIN empanada_types t ON t.id = i.type_id
  `);
  res.json(r.rows);
});

router.post('/', async (req, res) => {
  const { type_id, quantity } = req.body;

  await db.query(`
    INSERT INTO inventory (type_id, quantity)
    VALUES ($1, $2)
    ON CONFLICT (type_id)
    DO UPDATE SET quantity = inventory.quantity + $2
  `, [type_id, quantity]);

  res.json({ ok: true });
});

export default router;
