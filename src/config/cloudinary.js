import { v4 as uuid } from 'uuid';
import cloudinaryPkg from 'cloudinary';
import stream from 'stream';

const { v2: cloudinary } = cloudinaryPkg;

const FOLDERS = {
  avatars:'kame/avatars',
  banners:'kame/banners',
  slides:'kame/carousel',
  products:'kame/products',
  combos:'kame/combos',
  proofs:'kame/payment-proofs',
  logos:'kame/logos',
  general:'kame/general',
  reels:'kame/reels',
};

function isConfigured() {
  return !!(
    process.env.dnfbwex5e &&
    process.env.288619156484297 &&
    process.env.je4tJ0YWTzv1MnvwmbegxDzEriw
  );
}

if (isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.dnfbwex5e,
    api_key: process.env.288619156484297,
    api_secret: process.env.je4tJ0YWTzv1MnvwmbegxDzEriw,
  });
}

export async function uploadImage(buffer, originalName, folder = 'general') {
  if (isConfigured()) {
    const cloudFolder = FOLDERS[folder] || 'kame/general';
    const ext = (originalName || 'file').split('.').pop().toLowerCase();
    const publicId = `${cloudFolder}/${uuid()}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'auto', format: ext },
        (err, result) => {
          if (err) return reject(err);
          resolve(result.secure_url);
        }
      );

      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);
      bufferStream.pipe(uploadStream);
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
