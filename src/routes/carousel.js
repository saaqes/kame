const r = require('express').Router();
const db = require('../config/db');
const { auth, admin } = require('../middleware/auth');

// GET ALL
r.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM carousel_slides WHERE is_active = true ORDER BY order_index'
    );

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// CREATE
r.post('/', auth, admin, async (req, res) => {
  try {
    const { image_url, title, subtitle, button_text, button_link, order_index } = req.body;

    const result = await db.query(
      `INSERT INTO carousel_slides
      (image_url, title, subtitle, button_text, button_link, order_index)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [image_url, title, subtitle, button_text, button_link, order_index || 0]
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
      image_url,
      title,
      subtitle,
      button_text,
      button_link,
      order_index,
      is_active
    } = req.body;

    await db.query(
      `UPDATE carousel_slides SET
        image_url = $1,
        title = $2,
        subtitle = $3,
        button_text = $4,
        button_link = $5,
        order_index = $6,
        is_active = $7
       WHERE id = $8`,
      [
        image_url,
        title,
        subtitle,
        button_text,
        button_link,
        order_index,
        is_active ?? true,
        req.params.id
      ]
    );

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE
r.delete('/:id', auth, admin, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM carousel_slides WHERE id = $1',
      [req.params.id]
    );

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = r;