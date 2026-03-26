import { v4 as uuid } from 'uuid';
import { v2 as cloudinaryLib } from 'cloudinary';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// carpetas
const FOLDERS = {
  avatars: 'kame/avatars',
  banners: 'kame/banners',
  slides: 'kame/carousel',
  products: 'kame/products',
  combos: 'kame/combos',
  proofs: 'kame/payment-proofs',
  logos: 'kame/logos',
  general: 'kame/general',
  reels: 'kame/reels',
};

function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

let _cloudinary = null;

function getCloudinary() {
  if (!isConfigured()) return null;

  if (_cloudinary) return _cloudinary;

  cloudinaryLib.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  _cloudinary = cloudinaryLib;
  return _cloudinary;
}

// 🔥 EXPORT CORRECTO (CLAVE)
export async function uploadImage(buffer, originalName, folder = 'general') {
  const cloudinary = getCloudinary();

  if (cloudinary) {
    const cloudFolder = FOLDERS[folder] || 'kame/general';
    const ext = (originalName || 'file').split('.').pop().toLowerCase();
    const publicId = `${cloudFolder}/${uuid()}`;

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'auto',
          format: ext
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result.secure_url);
        }
      );

      Readable.from(buffer).pipe(stream);
    });
  }

  // fallback local
  const ext = (originalName || 'file').split('.').pop();
  const fname = `${uuid()}.${ext}`;
  const dir = path.join(process.cwd(), 'src/uploads', folder);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fname), buffer);

  return `/uploads/${folder}/${fname}`;
}

// opcional si lo usas en otro lado
export { isConfigured };
