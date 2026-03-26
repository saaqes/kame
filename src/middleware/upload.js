import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadImage } from '../config/cloudinary.js';

// almacenamiento en memoria
const storage = multer.memoryStorage();

// acepta cualquier campo
const uploader = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
}).any();

export default function upload() {
  return [
    uploader,
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) {
          return next();
        }

        const file = req.files[0];
        const folder = req.query.folder || req.driveFolder || 'general';

        try {
          const url = await uploadImage(
            file.buffer,
            file.originalname,
            folder
          );

          req.file = { savedUrl: url };
          next();

        } catch (e) {
          console.error('Cloudinary error:', e.message);

          const ext = path.extname(file.originalname);
          const fname = Date.now() + ext;

          const dir = path.join(process.cwd(), 'src/uploads', folder);

          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, fname), file.buffer);

          req.file = { savedUrl: `/uploads/${folder}/${fname}` };

          next();
        }

      } catch (err) {
        console.error('Upload middleware error:', err.message);
        res.status(500).json({ message: 'Error subiendo archivo' });
      }
    }
  ];
}
