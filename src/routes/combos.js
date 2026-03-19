const r = require('express').Router();
const db = require('../config/db');
const { auth, admin } = require('../middleware/auth');

// GET ALL
r.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM combos WHERE is_active = true ORDER BY is_featured DESC, id'
    );

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// CREATE
r.post('/', auth, admin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      original_price,
      image_url,
      dragon_ball_ref,
      is_featured
    } = req.body;

    const result = await db.query(
      `INSERT INTO combos
      (name, description, price, original_price, image_url, dragon_ball_ref, is_featured)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        name,
        description,
        price,
        original_price || null,
        image_url || null,
        dragon_ball_ref || null,
        is_featured ?? false
      ]
    );

    res.status(201).json({ id: result.rows[0].id });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// UPDATE
r.put('/:id', auth, admin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      original_price,
      image_url,
      is_featured,
      is_active
    } = req.body;

    await db.query(
      `UPDATE combos SET
        name = $1,
        description = $2,
        price = $3,
        original_price = $4,
        image_url = $5,
        is_featured = $6,
        is_active = $7
       WHERE id = $8`,
      [
        name,
        description,
        price,
        original_price,
        image_url,
        is_featured ?? false,
        is_active ?? true,
        req.params.id
      ]
    );

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE (soft delete)
r.delete('/:id', auth, admin, async (req, res) => {
  try {
    await db.query(
      'UPDATE combos SET is_active = false WHERE id = $1',
      [req.params.id]
    );

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = r;