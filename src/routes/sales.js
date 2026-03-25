import db from '../config/db.js';
import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  const { type_id, quantity } = req.body;

  const t = await db.query(
    'SELECT price FROM empanada_types WHERE id=$1',
    [type_id]
  );

  const price = t.rows[0].price;

  await db.query(`
    INSERT INTO sales (type_id, quantity, total)
    VALUES ($1, $2, $3)
  `, [type_id, quantity, price * quantity]);

  await db.query(`
    UPDATE inventory
    SET quantity = quantity - $1
    WHERE type_id = $2
  `, [quantity, type_id]);

  res.json({ ok: true });
});

export default router;
