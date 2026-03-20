const r      = require('express').Router();
const db     = require('../config/db');
const { auth, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── GET ALL (público) ─────────────────────────────────────────────────────────
r.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM combos WHERE is_active = true ORDER BY id'
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── GET ONE ───────────────────────────────────────────────────────────────────
r.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM combos WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
r.post('/', auth, admin, async (req, res) => {
  try {
    const { name, description, price, original_price, image_url, dragon_ball_ref, is_active } = req.body;
    if (!name || !price) return res.status(400).json({ message: 'Nombre y precio requeridos' });

    const result = await db.query(
      `INSERT INTO combos(name, description, price, original_price, image_url, dragon_ball_ref, is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, description || null, price, original_price || null,
       image_url || null, dragon_ball_ref || null, is_active !== false]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
r.put('/:id', auth, admin, async (req, res) => {
  try {
    const { name, description, price, original_price, image_url, dragon_ball_ref, is_active } = req.body;
    await db.query(
      `UPDATE combos SET
        name=$1, description=$2, price=$3, original_price=$4,
        image_url=$5, dragon_ball_ref=$6, is_active=$7
       WHERE id=$8`,
      [name, description || null, price, original_price || null,
       image_url || null, dragon_ball_ref || null, is_active !== false, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── UPLOAD IMAGEN ─────────────────────────────────────────────────────────────
r.post('/:id/image', auth, admin,
  (req, res, next) => { req.query.folder = 'combos'; next(); },
  ...upload('image'),
  async (req, res) => {
    try {
      if (!req.file?.savedUrl) return res.status(400).json({ message: 'Sin archivo' });
      await db.query('UPDATE combos SET image_url=$1 WHERE id=$2', [req.file.savedUrl, req.params.id]);
      res.json({ url: req.file.savedUrl });
    } catch (e) { res.status(500).json({ message: e.message }); }
  }
);

// ── DELETE (soft) ─────────────────────────────────────────────────────────────
r.delete('/:id', auth, admin, async (req, res) => {
  try {
    await db.query('UPDATE combos SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
