const r=require('express').Router(),db=require('../config/db'),{auth,admin}=require('../middleware/auth'),upload=require('../middleware/upload'),{v4:uuid}=require('uuid');

r.post('/',auth,async(req,res)=>{
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    const{items,payment_method,delivery_address,notes,coupon_code,customer_name,customer_phone,customer_ambiente}=req.body;
    if(!items?.length)return res.status(400).json({message:'Carrito vacío'});
    let subtotal=0;
    for(const item of items){
      if(item.product_id){const p=await client.query('SELECT price,discount_percent FROM products WHERE id=$1 AND is_active=true',[item.product_id]);if(!p.rows.length)throw new Error('Producto no disponible');item.unit_price=p.rows[0].price*(1-(p.rows[0].discount_percent||0)/100);}
      else if(item.combo_id){const c=await client.query('SELECT price FROM combos WHERE id=$1 AND is_active=true',[item.combo_id]);if(!c.rows.length)throw new Error('Combo no disponible');item.unit_price=c.rows[0].price;}
      subtotal+=item.unit_price*item.quantity;
    }
    let discount=0;
    if(coupon_code){const cp=await client.query('SELECT * FROM coupons WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at>NOW())',[coupon_code]);if(cp.rows.length&&subtotal>=cp.rows[0].min_purchase){const c=cp.rows[0];discount=c.discount_type==='percent'?subtotal*c.discount_value/100:c.discount_value;await client.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1',[c.id]);}}
    const total=Math.max(0,subtotal-discount);
    const order_number='KME-'+Date.now()+'-'+uuid().slice(0,6).toUpperCase();
    const ord=await client.query(
      `INSERT INTO orders(user_id,order_number,total,payment_method,delivery_address,notes,customer_name,customer_phone,customer_ambiente)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.id,order_number,total,payment_method||'cash',delivery_address||'',notes||'',
       customer_name||null,customer_phone||null,customer_ambiente||null]
    );
    const order_id=ord.rows[0].id;
    for(const item of items)await client.query('INSERT INTO order_items(order_id,product_id,combo_id,quantity,unit_price,extras)VALUES($1,$2,$3,$4,$5,$6)',[order_id,item.product_id||null,item.combo_id||null,item.quantity,item.unit_price,JSON.stringify(item.extras||{})]);
    await client.query('COMMIT');
    res.status(201).json({order_id,order_number,total,status:'pending'});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({message:e.message});}
  finally{client.release();}
});

r.get('/my',auth,async(req,res)=>{
  try{
    const orders=await db.query(`SELECT * FROM orders WHERE user_id=$1 AND (status IS NULL OR status!='archived') ORDER BY created_at DESC`,[req.user.id]);
    for(const o of orders.rows){const items=await db.query(`SELECT oi.*,p.name AS product_name,c.name AS combo_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN combos c ON oi.combo_id=c.id WHERE oi.order_id=$1`,[o.id]);o.items=items.rows;}
    res.json(orders.rows);
  }catch(e){res.status(500).json({message:e.message});}
});

r.post('/:id/proof',auth,(req,res,next)=>{req.query.folder='proofs';next();},...upload('proof'),async(req,res)=>{
  try{if(!req.file?.savedUrl)return res.status(400).json({message:'No se recibió archivo'});await db.query(`UPDATE orders SET payment_proof=$1,payment_status='processing',status='payment_review' WHERE id=$2`,[req.file.savedUrl,req.params.id]);res.json({ok:true,payment_proof:req.file.savedUrl});}
  catch(e){res.status(500).json({message:e.message});}
});

r.get('/:id/messages',auth,async(req,res)=>{
  try{const r2=await db.query('SELECT * FROM order_messages WHERE order_id=$1 ORDER BY created_at ASC',[req.params.id]);res.json(r2.rows);}
  catch(e){res.status(500).json({message:e.message});}
});

r.post('/:id/messages',auth,async(req,res)=>{
  try{const{message}=req.body;await db.query('INSERT INTO order_messages(order_id,sender_role,message)VALUES($1,$2,$3)',[req.params.id,req.user.role==='admin'?'admin':'client',message]);res.status(201).json({ok:true});}
  catch(e){res.status(500).json({message:e.message});}
});

r.get('/',auth,admin,async(req,res)=>{
  try{
    const archived=req.query.archived==='1';
    const orders=await db.query(`SELECT o.*,u.full_name,u.email FROM orders o LEFT JOIN users u ON o.user_id=u.id WHERE ${archived?"o.status='archived'":"(o.status!='archived' OR o.status IS NULL)"} ORDER BY o.created_at DESC LIMIT 200`);
    for(const o of orders.rows){const items=await db.query(`SELECT oi.*,p.name AS product_name,c.name AS combo_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN combos c ON oi.combo_id=c.id WHERE oi.order_id=$1`,[o.id]);o.items=items.rows;}
    res.json(orders.rows);
  }catch(e){res.status(500).json({message:e.message});}
});

r.put('/:id/status',auth,admin,async(req,res)=>{
  try{const{status,payment_status}=req.body;await db.query('UPDATE orders SET status=$1,payment_status=$2 WHERE id=$3',[status,payment_status,req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({message:e.message});}
});

r.delete('/:id',auth,admin,async(req,res)=>{
  const client=await db.connect();
  try{await client.query('BEGIN');await client.query('DELETE FROM order_messages WHERE order_id=$1',[req.params.id]);await client.query('DELETE FROM order_items WHERE order_id=$1',[req.params.id]);await client.query('DELETE FROM orders WHERE id=$1',[req.params.id]);await client.query('COMMIT');res.json({ok:true});}
  catch(e){await client.query('ROLLBACK');res.status(500).json({message:e.message});}
  finally{client.release();}
});

module.exports=r;
