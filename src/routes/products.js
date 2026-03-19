const r = require('express').Router();
const db = require('../config/db');
const { auth, admin } = require('../middleware/auth');

const parseProduct = (x) => {
  try { x.images = typeof x.images === 'string' ? JSON.parse(x.images) : (x.images || []); }
  catch { x.images = []; }
  return x;
};

// GET ALL
r.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;
    let q = `SELECT p.*, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = true`;
    const params = [];
    let i = 1;
    if (category) { q += ` AND p.category_id = $${i++}`; params.push(category); }
    if (featured)  { q += ` AND p.is_featured = true`; }
    q += ` ORDER BY p.is_featured DESC, p.id`;
    const result = await db.query(q, params);
    res.json(result.rows.map(parseProduct));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET ONE
r.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'No encontrado' });
    const prod = parseProduct(result.rows[0]);

    // ✅ CORREGIDO: sin is_approved (no existe en el schema)
    const reviews = await db.query(
      `SELECT r.*, u.full_name, u.avatar
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    prod.reviews = reviews.rows;
    res.json(prod);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// CREATE
r.post('/', auth, admin, async (req, res) => {
  try {
    const { category_id, name, description, price, discount_percent, images, stock, is_featured, is_active, dragon_ball_ref } = req.body;
    const result = await db.query(
      `INSERT INTO products(category_id,name,description,price,discount_percent,images,stock,is_featured,is_active,dragon_ball_ref)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [category_id, name, description||null, price, discount_percent||0,
       JSON.stringify(images||[]), stock||999, is_featured??false, is_active??true, dragon_ball_ref||null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// UPDATE
r.put('/:id', auth, admin, async (req, res) => {
  try {
    const { name, description, price, discount_percent, images, stock, is_active, is_featured, dragon_ball_ref, category_id } = req.body;
    await db.query(
      `UPDATE products SET name=$1,description=$2,price=$3,discount_percent=$4,images=$5,
       stock=$6,is_active=$7,is_featured=$8,dragon_ball_ref=$9,category_id=$10 WHERE id=$11`,
      [name, description||null, price, discount_percent||0, JSON.stringify(images||[]),
       stock||999, is_active??true, is_featured??false, dragon_ball_ref||null, category_id, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE (soft)
r.delete('/:id', auth, admin, async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = r;
