'use client';

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '@/lib/firebase';

/**
 * Firebase Storage utility for reference images
 * Stores images in Firebase Storage instead of base64 in Firestore
 */

// Allowed image types and max size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1024; // Max width/height in pixels
const COMPRESSION_QUALITY = 0.8;

/**
 * Validates an image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Nur JPEG, PNG, WEBP, HEIC/HEIF Dateien erlaubt' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Datei zu groß. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
  }
  return { valid: true };
}

/**
 * Compresses and resizes an image file
 * Strips EXIF data in the process
 */
export async function processImageFile(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image (this strips EXIF data)
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Image compression failed'));
          }
        },
        'image/jpeg',
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Uploads a reference image to Firebase Storage
 * Returns the download URL
 */
export async function uploadReferenceImage(
  userId: string,
  appointmentId: string,
  file: File
): Promise<string> {
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Process image (compress, resize, strip EXIF)
  const processedBlob = await processImageFile(file);

  // Create storage reference
  const storage = getStorage(app);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storagePath = `reference-images/${userId}/${appointmentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  // Upload with metadata
  const metadata = {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
    customMetadata: {
      uploadedBy: userId,
      appointmentId,
      originalName: file.name,
      originalType: file.type,
      uploadedAt: new Date().toISOString(),
    },
  };

  await uploadBytes(storageRef, processedBlob, metadata);

  // Get download URL
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * Deletes a reference image from Firebase Storage
 */
export async function deleteReferenceImage(downloadURL: string): Promise<void> {
  try {
    const storage = getStorage(app);
    const storageRef = ref(storage, downloadURL);
    await deleteObject(storageRef);
  } catch (error) {
    // Ignore if file doesn't exist
    console.warn('Failed to delete reference image:', error);
  }
}
