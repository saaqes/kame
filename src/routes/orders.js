const r=require('express').Router(),db=require('../config/db'),{auth,admin}=require('../middleware/auth'),upload=require('../middleware/upload'),{v4:uuid}=require('uuid');

r.post('/',auth,async(req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const{items,payment_method,delivery_address,notes,coupon_code}=req.body;
    if(!items?.length)return res.status(400).json({message:'Carrito vacío'});
    let subtotal=0;
    for(const item of items){
      if(item.product_id){const[p]=await conn.query('SELECT price,discount_percent FROM products WHERE id=? AND is_active=1',[item.product_id]);if(!p.length)throw new Error('Producto no disponible');item.unit_price=p[0].price*(1-(p[0].discount_percent||0)/100);}
      else if(item.combo_id){const[c]=await conn.query('SELECT price FROM combos WHERE id=? AND is_active=1',[item.combo_id]);if(!c.length)throw new Error('Combo no disponible');item.unit_price=c[0].price;}
      subtotal+=item.unit_price*item.quantity;
    }
    let discount=0;
    if(coupon_code){const[cp]=await conn.query("SELECT * FROM coupons WHERE code=? AND is_active=1 AND(expires_at IS NULL OR expires_at>NOW())AND(max_uses IS NULL OR used_count<max_uses)",[coupon_code]);if(cp.length&&subtotal>=cp[0].min_purchase){discount=cp[0].discount_type==='percent'?subtotal*cp[0].discount_value/100:cp[0].discount_value;await conn.query('UPDATE coupons SET used_count=used_count+1 WHERE id=?',[cp[0].id]);}}
    const total=Math.max(0,subtotal-discount);
    const order_number='KME-'+Date.now()+'-'+uuid().slice(0,6).toUpperCase();
    const[ord]=await conn.query('INSERT INTO orders(user_id,order_number,total,subtotal,discount,payment_method,delivery_address,notes)VALUES(?,?,?,?,?,?,?,?)',[req.user.id,order_number,total,subtotal,discount,payment_method||'cash',delivery_address||'',notes||'']);
    for(const item of items)await conn.query('INSERT INTO order_items(order_id,product_id,combo_id,quantity,unit_price,extras)VALUES(?,?,?,?,?,?)',[ord.insertId,item.product_id||null,item.combo_id||null,item.quantity,item.unit_price,JSON.stringify(item.extras||{})]);
    await conn.query('INSERT INTO notifications(user_id,title,message,type)VALUES(?,?,?,?)',[req.user.id,'Orden recibida','Tu orden '+order_number+' fue recibida. Total: $'+total,'order']);
    await conn.commit();
    res.status(201).json({order_id:ord.insertId,order_number,total,status:'pending'});
  }catch(e){await conn.rollback();res.status(500).json({message:e.message});}
  finally{conn.release();}
});

r.get('/my',auth,async(req,res)=>{
  const[orders]=await db.query('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[req.user.id]);
  for(const o of orders){const[items]=await db.query('SELECT oi.*,p.name AS product_name,c.name AS combo_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN combos c ON oi.combo_id=c.id WHERE oi.order_id=?',[o.id]);o.items=items;}
  res.json(orders);
});

// upload('proof') devuelve array de middlewares — spread con ...
r.post('/:id/proof', auth, (req,res,next)=>{req.query.folder='proofs';next();}, ...upload('proof'), async(req,res)=>{
  if(!req.file)return res.status(400).json({message:'No se recibió archivo'});
  const[o]=await db.query('SELECT * FROM orders WHERE id=?',[req.params.id]);
  if(!o.length)return res.status(404).json({message:'Orden no encontrada'});
  const fp=req.file.savedUrl;
  await db.query('UPDATE orders SET payment_proof=?,payment_status=?,status=? WHERE id=?',[fp,'processing','payment_review',req.params.id]);
  res.json({ok:true,payment_proof:fp});
});

r.get('/',auth,admin,async(req,res)=>{
  const[rows]=await db.query('SELECT o.*,u.full_name,u.email FROM orders o LEFT JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 100');
  res.json(rows);
});

r.put('/:id/status',auth,admin,async(req,res)=>{
  const{status,payment_status}=req.body;
  await db.query('UPDATE orders SET status=?,payment_status=? WHERE id=?',[status,payment_status,req.params.id]);
  res.json({ok:true});
});

module.exports=r;
