const r = require('express').Router();
const db = require('../config/db');
const { auth, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { v4: uuid } = require('uuid');


// ─────────────────────────────────────────────────────────
// POST / — Crear orden
// ─────────────────────────────────────────────────────────
r.post('/', auth, async (req, res) => {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');

    const { items, payment_method, delivery_address, notes, coupon_code } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'Carrito vacío' });

    const { rows: userData } = await conn.query(
      `SELECT full_name, phone, celular, ambiente_numero, role
       FROM users WHERE id=$1`,
      [req.user.id]
    );

    const u = userData[0] || {};

    let subtotal = 0;

    for (const item of items) {
      if (item.product_id) {
        const { rows: p } = await conn.query(
          'SELECT price,discount_percent FROM products WHERE id=$1 AND is_active=true',
          [item.product_id]
        );
        if (!p.length) throw new Error('Producto no disponible');

        item.unit_price = p[0].price * (1 - (p[0].discount_percent || 0) / 100);
      }

      else if (item.combo_id) {
        const { rows: c } = await conn.query(
          'SELECT price FROM combos WHERE id=$1 AND is_active=true',
          [item.combo_id]
        );
        if (!c.length) throw new Error('Combo no disponible');

        item.unit_price = c[0].price;
      }

      subtotal += item.unit_price * item.quantity;
    }

    let discount = 0;

    if (coupon_code) {
      const { rows: cp } = await conn.query(
        `SELECT * FROM coupons
         WHERE code=$1 AND is_active=true
         AND (expires_at IS NULL OR expires_at>NOW())
         AND (max_uses IS NULL OR used_count<max_uses)`,
        [coupon_code]
      );

      if (cp.length && subtotal >= cp[0].min_purchase) {
        discount = cp[0].discount_type === 'percent'
          ? subtotal * cp[0].discount_value / 100
          : cp[0].discount_value;

        await conn.query(
          'UPDATE coupons SET used_count=used_count+1 WHERE id=$1',
          [cp[0].id]
        );
      }
    }

    const total = Math.max(0, subtotal - discount);
    const order_number = 'KME-' + Date.now() + '-' + uuid().slice(0, 6).toUpperCase();

    const { rows: [ord] } = await conn.query(
      `INSERT INTO orders(
        user_id, order_number, total, payment_method,
        delivery_address, notes,
        customer_name, customer_phone, customer_ambiente
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      [
        req.user.id,
        order_number,
        total,
        payment_method || 'cash',
        delivery_address || '',
        notes || '',
        u.full_name || '',
        u.celular || u.phone || '',
        u.ambiente_numero || ''
      ]
    );

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items(
          order_id,product_id,combo_id,quantity,unit_price,extras
        ) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          ord.id,
          item.product_id || null,
          item.combo_id || null,
          item.quantity,
          item.unit_price,
          JSON.stringify(item.extras || {})
        ]
      );
    }

    await conn.query('COMMIT');

    res.status(201).json({
      order_id: ord.id,
      order_number,
      total,
      status: 'pending'
    });

  } catch (e) {
    await conn.query('ROLLBACK');
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────────────────
// GET /my — Órdenes del usuario
// ─────────────────────────────────────────────────────────
r.get('/my', auth, async (req, res) => {
  try {
    const { rows: orders } = await db.query(
      'SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );

    for (const o of orders) {
      const { rows: items } = await db.query(
        `SELECT oi.*,p.name AS product_name,c.name AS combo_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id=p.id
         LEFT JOIN combos c ON oi.combo_id=c.id
         WHERE oi.order_id=$1`,
        [o.id]
      );

      o.items = items;
    }

    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────────────────────────
// GET / — Admin: todas las órdenes (CORREGIDO)
// ─────────────────────────────────────────────────────────
r.get('/', auth, admin, async (req, res) => {
  try {
    const archived = req.query.archived === '1';

    const { rows: orders } = await db.query(
      archived
        ? `SELECT 
            o.*,
            u.full_name,
            u.email,
            u.role,
            u.ambiente_numero,
            u.sena_role
           FROM orders o
           LEFT JOIN users u ON o.user_id=u.id
           WHERE o.status='archived'
           ORDER BY o.created_at DESC
           LIMIT 200`
        : `SELECT 
            o.*,
            u.full_name,
            u.email,
            u.role,
            u.ambiente_numero,
            u.sena_role
           FROM orders o
           LEFT JOIN users u ON o.user_id=u.id
           WHERE o.status != 'archived'
           ORDER BY o.created_at DESC
           LIMIT 100`
    );

    // ───── Añadir productos del pedido ─────
    for (const o of orders) {
      const { rows: items } = await db.query(
        `SELECT 
            oi.*,
            p.name AS product_name,
            c.name AS combo_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id=p.id
         LEFT JOIN combos c ON oi.combo_id=c.id
         WHERE oi.order_id=$1`,
        [o.id]
      );

      o.items = items;
    }

    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────────────────────────
// PUT /:id/status — Cambiar estado
// ─────────────────────────────────────────────────────────
r.put('/:id/status', auth, admin, async (req, res) => {
  try {
    const { status, payment_status } = req.body;

    await db.query(
      'UPDATE orders SET status=$1,payment_status=$2 WHERE id=$3',
      [status, payment_status, req.params.id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────────────────────────
// POST /:id/proof — Subir comprobante
// ─────────────────────────────────────────────────────────
r.post('/:id/proof', auth,
  (req, res, next) => { req.query.folder = 'proofs'; next(); },
  ...upload('proof'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No se recibió archivo' });

      const { rows: o } = await db.query(
        'SELECT * FROM orders WHERE id=$1',
        [req.params.id]
      );

      if (!o.length) return res.status(404).json({ message: 'Orden no encontrada' });

      const fp = req.file.savedUrl;

      await db.query(
        `UPDATE orders 
         SET payment_proof=$1,payment_status=$2,status=$3 
         WHERE id=$4`,
        [fp, 'processing', 'payment_review', req.params.id]
      );

      res.json({ ok: true, payment_proof: fp });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);

module.exports = r;
