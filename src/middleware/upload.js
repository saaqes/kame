// Middleware de subida — usa Cloudinary si está configurado, local si no
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { uploadImage } = require('../config/cloudinary');

// Siempre recibir el archivo en memoria para poder enviarlo a Cloudinary
const memStorage = multer.memoryStorage();
const multerMem  = multer({ storage: memStorage, limits: { fileSize: 15 * 1024 * 1024 } });

// Exporta una función que devuelve el middleware listo para usar
// Uso en rutas: upload('avatar'), upload('file'), etc.
function upload(fieldName) {
  return [
    multerMem.single(fieldName),
    async (req, res, next) => {
      if (!req.file) return next();
      const folder = req.query.folder || req.driveFolder || 'general';
      try {
        const url = await uploadImage(req.file.buffer, req.file.originalname, folder);
        req.file.savedUrl = url;
        next();
      } catch (e) {
        console.error('Upload error:', e.message);
        // Fallback: guardar localmente
        const { v4: uuid } = require('uuid');
        const ext  = path.extname(req.file.originalname);
        const fname = uuid() + ext;
        const dir   = path.join(__dirname, '../uploads', folder);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, fname), req.file.buffer);
        req.file.savedUrl = `/uploads/${folder}/${fname}`;
        next();
      }
    }
  ];
}

module.exports = upload;
