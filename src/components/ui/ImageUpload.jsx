import { useRef, useState } from 'react';
import { uploadFile, isVideoUrl } from '../../lib/uploadApi';

/**
 * Reusable image/video upload component backed by Cloudinary.
 *
 * Props:
 *   value      — current URL (string)
 *   onChange   — called with the new Cloudinary URL
 *   folder     — 'avatars' | 'rooms' | 'gallery' | 'hero'
 *   accept     — MIME types string, default 'image/*'
 *   label      — button label, default 'Upload Image'
 *   className  — extra classes for the wrapper
 *   preview    — show preview thumbnail (default true)
 *   rounded    — 'full' for circle (avatar), 'xl' for card (default)
 */
export default function ImageUpload({
  value,
  onChange,
  folder = 'misc',
  accept = 'image/*',
  label = 'Upload Image',
  className = '',
  preview = true,
  rounded = 'xl',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadFile(file, folder);
      onChange(url);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const isVideo = isVideoUrl(value);
  const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded-xl';

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Preview */}
      {preview && value && (
        <div className={`overflow-hidden bg-slate-100 border border-slate-200 ${roundedClass} ${rounded === 'full' ? 'w-24 h-24' : 'w-full h-40'}`}>
          {isVideo ? (
            <video src={value} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={value} alt="preview" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          )}
        </div>
      )}

      {/* Upload button */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {uploading
          ? <><i className="fas fa-spinner fa-spin"></i> Uploading...</>
          : <><i className="fas fa-upload"></i> {label}</>}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
