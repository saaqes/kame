const jwt=require('jsonwebtoken');
const auth=(req,res,next)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return res.status(401).json({message:'Token requerido'});try{req.user=jwt.verify(t,process.env.JWT_SECRET);next();}catch{res.status(401).json({message:'Token inválido'});}};
const admin=(req,res,next)=>{if(req.user?.role!=='admin')return res.status(403).json({message:'Solo admin'});next();};
module.exports={auth,admin};