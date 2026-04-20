import multer from 'multer';
import { configureCloudinary } from '../config/cloundinary.js';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024), // 5MB
  },
});

const uploadSingle = (fieldName = 'file') => upload.single(fieldName);
const uploadMultiple = (fieldName = 'files', maxCount = 5) => upload.array(fieldName, maxCount);

const uploadBufferToCloudinary = async (buffer, { folder, publicId, resourceType = 'image' } = {}) => {
  const cloudinary = configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
};

export { upload, uploadSingle, uploadMultiple, uploadBufferToCloudinary };
