import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadImage } from '../config/cloudinary.js';
import { v4 as uuid } from 'uuid';

// almacenamiento en memoria
const memStorage = multer.memoryStorage();

const multerMem = multer({
  storage: memStorage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

function upload(fieldName) {
  return [
    multerMem.single(fieldName),

    async (req, res, next) => {
      if (!req.file) return next();

      const folder = req.query.folder || req.driveFolder || 'general';

      try {
        const url = await uploadImage(
          req.file.buffer,
          req.file.originalname,
          folder
        );

        req.file.savedUrl = url;
        next();

      } catch (e) {
        console.error('Upload error:', e.message);

        // fallback local
        const ext = path.extname(req.file.originalname);
        const fname = uuid() + ext;

        const dir = path.join(process.cwd(), 'src/uploads', folder);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, fname), req.file.buffer);

        req.file.savedUrl = `/uploads/${folder}/${fname}`;
        next();
      }
    }
  ];
}

// 🔥 ESTA LÍNEA ES LA CLAVE
export default upload;
