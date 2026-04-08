import { api } from './api';

/**
 * Upload a file to Cloudinary via the backend.
 *
 * @param {File}   file    — the File object from an <input type="file">
 * @param {string} folder  — 'avatars' | 'rooms' | 'gallery' | 'hero'
 * @returns {Promise<string>} — the Cloudinary secure URL
 */
export async function uploadFile(file, folder = 'misc') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data.url;
}

/**
 * Check if a Cloudinary URL is a video
 */
export function isVideoUrl(url) {
  if (!url) return false;
  return url.includes('/video/upload/') || /\.(mp4|webm|ogg|mov)$/i.test(url);
}

/**
 * Delete a Cloudinary file by its URL (admin only).
 * Silently skips non-Cloudinary URLs.
 */
export async function deleteMedia(url) {
  if (!url || !url.includes('res.cloudinary.com')) return;
  try {
    await api.delete('/api/admin/delete-media', { data: { url } });
  } catch {
    // Non-fatal — log silently
  }
}
