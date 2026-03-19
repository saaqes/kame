// ── Cloudinary — almacenamiento de imágenes en la nube ──────────────────────
// Fallback automático a almacenamiento local si no está configurado
const { v4: uuid } = require('uuid');

const FOLDERS = {
  avatars:  'kame/avatars',
  banners:  'kame/banners',
  slides:   'kame/carousel',
  products: 'kame/products',
  combos:   'kame/combos',
  proofs:   'kame/payment-proofs',
  logos:    'kame/logos',
  general:  'kame/general',
};

function isConfigured() {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'dnfbwex5e' &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

let _cloudinary = null;
function getCloudinary() {
  if (!isConfigured()) return null;
  if (_cloudinary) return _cloudinary;
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  _cloudinary = cloudinary;
  return cloudinary;
}

/**
 * Sube un buffer a Cloudinary o local.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} folder  — 'avatars' | 'banners' | 'slides' | 'products' | 'proofs' | ...
 * @returns {Promise<string>} URL pública de la imagen
 */
async function uploadImage(buffer, originalName, folder = 'general') {
  const cloudinary = getCloudinary();

  if (cloudinary) {
    // Subir a Cloudinary con carpeta organizada
    const cloudFolder = FOLDERS[folder] || 'kame/general';
    const ext = originalName.split('.').pop().toLowerCase();
    const publicId = `${cloudFolder}/${uuid()}`;

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'auto', format: ext },
        (err, result) => {
          if (err) return reject(err);
          resolve(result.secure_url);
        }
      );
      const { Readable } = require('stream');
      Readable.from(buffer).pipe(stream);
    });
  }

  // Sin Cloudinary → guardar local
  const path = require('path');
  const fs   = require('fs');
  const ext  = originalName.split('.').pop();
  const fname = `${uuid()}.${ext}`;
  const dir   = path.join(__dirname, '../uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fname), buffer);
  return `/uploads/${folder}/${fname}`;
}

module.exports = { uploadImage, isConfigured };
