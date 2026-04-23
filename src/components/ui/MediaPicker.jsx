import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { uploadFile, isVideoUrl, deleteMedia } from '../../lib/uploadApi';

/**
 * MediaPicker — drop-in replacement for ImageUpload in the site builder.
 *
 * Opens a modal with two tabs:
 *  • "Upload New"    — drag-and-drop / click to upload to Cloudinary
 *  • "Media Library" — browse existing gallery images + room images
 *
 * Props:
 *   value       — current URL string
 *   onChange    — called with the new URL
 *   previousUrl — URL to delete from Cloudinary when replaced (usually same as value at edit-open time)
 *   folder      — Cloudinary folder: 'hero' | 'gallery' | 'rooms' | 'avatars'
 *   accept      — file input accept string, default 'image/*,video/*'
 *   label       — button label, default 'Choose Media'
 *   className   — extra wrapper classes
 */
export default function MediaPicker({
  value = '',
  onChange,
  previousUrl = '',
  folder = 'misc',
  accept = 'image/*,video/*',
  label = 'Choose Media',
  className = '',
}) {
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState('upload');
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [library, setLibrary]         = useState([]);
  const [libLoading, setLibLoading]   = useState(false);
  const [libLoaded, setLibLoaded]     = useState(false);
  const inputRef = useRef(null);

  // Load media library once when that tab is opened
  useEffect(() => {
    if (tab !== 'library' || libLoaded) return;
    setLibLoading(true);
    Promise.all([
      api.get('/api/admin/gallery'),
      api.get('/api/admin/rooms'),
    ])
      .then(([galleryRes, roomsRes]) => {
        const galleryItems = (galleryRes.data.data || []).map(i => ({
          url:   i.image_url,
          label: i.caption || i.category || 'Gallery',
        }));
        const roomItems = (roomsRes.data.data || [])
          .filter(r => r.image)
          .map(r => ({ url: r.image, label: r.name }));
        setLibrary([...galleryItems, ...roomItems]);
        setLibLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLibLoading(false));
  }, [tab, libLoaded]);

  function openPicker() {
    setTab('upload');
    setUploadError('');
    setOpen(true);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const url = await uploadFile(file, folder);
      // Delete old Cloudinary file if it's being replaced
      if (previousUrl && previousUrl !== url) {
        deleteMedia(previousUrl);
      }
      onChange(url);
      setOpen(false);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function selectFromLibrary(url) {
    if (previousUrl && previousUrl !== url) {
      deleteMedia(previousUrl);
    }
    onChange(url);
    setOpen(false);
  }

  function close() {
    setOpen(false);
    setUploadError('');
  }

  return (
    <div className={className}>
      {/* Current preview */}
      {value && (
        <div className="mb-2 w-full h-40 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          {isVideoUrl(value) ? (
            <video src={value} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={value} alt="preview" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={e => { e.target.style.display = 'none'; }} />
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
      >
        <i className="fas fa-photo-film"></i> {label}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Media picker">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-brand">
                  <i className="fas fa-photo-film text-sm"></i>
                </div>
                <h3 className="font-bold text-slate-800 text-base">Choose Media</h3>
              </div>
              <button type="button" onClick={close} className="text-slate-400 hover:text-slate-600 w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'upload'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className="fas fa-upload mr-2"></i>Upload New
              </button>
              <button
                type="button"
                onClick={() => setTab('library')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'library'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className="fas fa-images mr-2"></i>Media Library
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ── Upload tab ── */}
              {tab === 'upload' && (
                <div className="space-y-4">
                  <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
                  <div
                    onClick={() => !uploading && inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                      uploading
                        ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                        : 'border-slate-300 hover:border-brand hover:bg-blue-50 cursor-pointer'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <i className="fas fa-spinner fa-spin text-4xl text-slate-300 mb-4"></i>
                        <p className="text-slate-500 font-medium">Uploading to Cloudinary…</p>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-cloud-upload-alt text-5xl text-slate-200 mb-4"></i>
                        <p className="text-slate-600 font-medium">Click to upload image or video</p>
                        <p className="text-xs text-slate-400 mt-1">Supports: JPG, PNG, WebP, MP4, WebM · Max 50 MB</p>
                      </>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <i className="fas fa-exclamation-circle"></i> {uploadError}
                    </p>
                  )}
                </div>
              )}

              {/* ── Library tab ── */}
              {tab === 'library' && (
                libLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <i className="fas fa-spinner fa-spin text-3xl mb-3"></i>
                    <p>Loading media library…</p>
                  </div>
                ) : library.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <i className="fas fa-images text-5xl mb-4"></i>
                    <p className="font-medium">No media found</p>
                    <p className="text-xs mt-1">Upload images or videos first using the Upload tab.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {library.map((item, i) => {
                      const isSelected = value === item.url;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectFromLibrary(item.url)}
                          title={item.label}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                            isSelected
                              ? 'border-brand ring-2 ring-brand ring-offset-1'
                              : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          {isVideoUrl(item.url) ? (
                            <>
                              <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="bg-black/50 rounded-full w-8 h-8 flex items-center justify-center">
                                  <i className="fas fa-play text-white text-xs ml-0.5"></i>
                                </div>
                              </div>
                            </>
                          ) : (
                            <img
                              src={item.url}
                              alt={item.label}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={e => { e.target.src = 'https://placehold.co/200x200?text=Error'; }}
                            />
                          )}

                          {/* Selected checkmark */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-brand rounded-full w-5 h-5 flex items-center justify-center shadow">
                              <i className="fas fa-check text-white text-xs"></i>
                            </div>
                          )}

                          {/* Label tooltip on hover */}
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs px-1.5 py-1 truncate opacity-0 hover:opacity-100 transition-opacity">
                            {item.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
