import express from 'express';
import db from '../config/db.js';
import { auth, admin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { v4 as uuid } from 'uuid';

const r = express.Router();


// ─────────────────────────────────────
// POST / — Crear orden
// ─────────────────────────────────────
r.post('/', auth, async (req, res) => {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');

    const { items, payment_method, delivery_address, notes, coupon_code } = req.body;

    if (!items?.length) {
      return res.status(400).json({ message: 'Carrito vacío' });
    }

    const { rows: userData } = await conn.query(
      `SELECT full_name, phone, celular, ambiente_numero FROM users WHERE id=$1`,
      [req.user.id]
    );
    const u = userData[0] || {};

    let subtotal = 0;
    for (const item of items) {
      if (item.product_id) {
        const { rows: p } = await conn.query(
          'SELECT price, discount_percent FROM products WHERE id=$1 AND is_active=true',
          [item.product_id]
        );
        if (!p.length) throw new Error('Producto no disponible');
        item.unit_price = p[0].price * (1 - (p[0].discount_percent || 0) / 100);
      } else if (item.combo_id) {
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
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [coupon_code.toUpperCase()]
      );
      if (cp.length && subtotal >= cp[0].min_purchase) {
        discount = cp[0].discount_type === 'percent'
          ? subtotal * cp[0].discount_value / 100
          : cp[0].discount_value;
        // incrementar contador de uso
        await conn.query(
          'UPDATE coupons SET used_count = used_count + 1 WHERE id=$1',
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
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        req.user.id, order_number, total,
        payment_method || 'cash',
        delivery_address || '', notes || '',
        u.full_name || '',
        u.celular || u.phone || '',
        u.ambiente_numero || ''
      ]
    );

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items(order_id, product_id, combo_id, quantity, unit_price, extras)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [ord.id, item.product_id || null, item.combo_id || null,
         item.quantity, item.unit_price, JSON.stringify(item.extras || {})]
      );
    }

    await conn.query('COMMIT');

    res.status(201).json({ order_id: ord.id, order_number, total, status: 'pending' });
  } catch (e) {
    await conn.query('ROLLBACK');
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────
// GET /my — órdenes del usuario
// ─────────────────────────────────────
r.get('/my', auth, async (req, res) => {
  try {
    const { rows: orders } = await db.query(
      'SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    for (const o of orders) {
      const { rows: items } = await db.query(
        `SELECT oi.*, p.name AS product_name, c.name AS combo_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         LEFT JOIN combos   c ON oi.combo_id   = c.id
         WHERE oi.order_id = $1`,
        [o.id]
      );
      o.items = items;
    }
    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────
// GET / — admin (con soporte archived)
// ─────────────────────────────────────
r.get('/', auth, admin, async (req, res) => {
  try {
    // ✅ FIX: soporte para ?archived=1
    const archived = req.query.archived === '1';
    const statusFilter = archived ? `o.status = 'archived'` : `o.status != 'archived'`;

    const { rows: orders } = await db.query(
      `SELECT o.*, u.full_name, u.email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${statusFilter}
       ORDER BY o.created_at DESC`
    );

    // cargar items de cada orden
    for (const o of orders) {
      const { rows: items } = await db.query(
        `SELECT oi.*, p.name AS product_name, c.name AS combo_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         LEFT JOIN combos   c ON oi.combo_id   = c.id
         WHERE oi.order_id = $1`,
        [o.id]
      );
      o.items = items;
    }

    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────
// PUT /:id/status
// ─────────────────────────────────────
r.put('/:id/status', auth, admin, async (req, res) => {
  try {
    const { status, payment_status } = req.body;
    await db.query(
      'UPDATE orders SET status=$1, payment_status=$2 WHERE id=$3',
      [status, payment_status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────
// DELETE /:id — eliminar orden (admin)
// ─────────────────────────────────────
r.delete('/:id', auth, admin, async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ─────────────────────────────────────
// COMPROBANTE DE PAGO
// ─────────────────────────────────────
r.post('/:id/proof',
  auth,
  (req, res, next) => { req.query.folder = 'proofs'; next(); },
  ...upload(),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file' });
      await db.query(
        `UPDATE orders
         SET payment_proof=$1, payment_status='processing', status='payment_review'
         WHERE id=$2`,
        [req.file.savedUrl, req.params.id]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);


// ─────────────────────────────────────
// MENSAJES DE ORDEN (chat admin ↔ cliente)
// ─────────────────────────────────────

// GET /:id/messages
r.get('/:id/messages', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM order_messages
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /:id/messages
r.post('/:id/messages', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Mensaje vacío' });

    const { rows: [msg] } = await db.query(
      `INSERT INTO order_messages (order_id, sender_id, sender_role, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.id, req.user.role, message.trim()]
    );
    res.status(201).json(msg);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


export default r;
