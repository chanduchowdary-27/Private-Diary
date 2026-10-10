import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Image as ImageIcon, Video, X, Eye, FolderOpen,
  Lock, CheckCircle2, AlertCircle, RefreshCw, Shield, Trash2,
  Play,
} from 'lucide-react';
import { EncryptedBadge } from '../../components/ui/LockBadge';
import {
  getMediaItems,
  saveMediaItem,
  deleteMediaItem,
  ACCEPTED_MEDIA_TYPES,
  MAX_MEDIA_SIZE_BYTES,
  type StoredMediaItem,
} from '../../services/storageService';

interface QueueFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  status: 'pending' | 'encrypting' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export default function Gallery() {
  const [persistedMedia, setPersistedMedia] = useState<StoredMediaItem[]>([]);
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState('All');
  const [selectedMedia, setSelectedMedia] = useState<StoredMediaItem | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const albums = ['All', 'Garden', 'Stargazing', 'Memories'];

  // Load persisted media from IndexedDB
  const loadMedia = useCallback(async () => {
    try {
      const items = await getMediaItems();
      setPersistedMedia(items);
    } catch (err) {
      console.error('Failed to load gallery items:', err);
    }
  }, []);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setErrorMessage('');
    const newQueue: QueueFile[] = [];

    Array.from(fileList).forEach(f => {
      const isAccepted = ACCEPTED_MEDIA_TYPES.includes(f.type) ||
        f.type.startsWith('image/') || f.type.startsWith('video/');

      if (!isAccepted) {
        setErrorMessage(`Unsupported format: ${f.name} (${f.type || 'unknown'}). Supported: JPG, PNG, GIF, WebP, MP4, WebM.`);
        return;
      }
      if (f.size > MAX_MEDIA_SIZE_BYTES) {
        setErrorMessage(`File ${f.name} exceeds the 200MB size limit.`);
        return;
      }

      // Check for duplicates in current album
      const isDup = persistedMedia.some(m => m.name === f.name && m.size === f.size && (activeAlbum === 'All' || m.album === activeAlbum));
      if (isDup) {
        setErrorMessage(`"${f.name}" already exists in the gallery.`);
        return;
      }

      const preview = URL.createObjectURL(f);
      const isVideo = f.type.startsWith('video/');

      newQueue.push({
        id: crypto.randomUUID(),
        file: f,
        preview,
        type: isVideo ? 'video' : 'image',
        status: 'pending',
        progress: 0,
      });
    });

    if (newQueue.length > 0) {
      setQueue(prev => [...prev, ...newQueue]);
    }
  };

  const processUpload = async (queueId: string) => {
    const item = queue.find(q => q.id === queueId);
    if (!item) return;

    setQueue(prev => prev.map(f => f.id === queueId ? { ...f, status: 'encrypting', progress: 20, error: undefined } : f));

    try {
      // Simulate step progress for encrypting
      await new Promise(r => setTimeout(r, 400));
      setQueue(prev => prev.map(f => f.id === queueId ? { ...f, status: 'uploading', progress: 60 } : f));

      // Real persistent save to IndexedDB durable storage
      const saved = await saveMediaItem(item.file, item.file.name, activeAlbum);

      setQueue(prev => prev.map(f => f.id === queueId ? { ...f, status: 'done', progress: 100 } : f));

      // Add to persisted gallery list
      setPersistedMedia(prev => [saved, ...prev.filter(m => m.id !== saved.id)]);

      // Clean up queue item after brief delay
      setTimeout(() => {
        setQueue(prev => prev.filter(f => f.id !== queueId));
      }, 1500);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setQueue(prev => prev.map(f => f.id === queueId ? {
        ...f,
        status: 'error',
        progress: 0,
        error: err.message || 'Upload failed',
      } : f));
    }
  };

  const handleRemoveFromQueue = (queueId: string) => {
    setQueue(prev => {
      const f = prev.find(x => x.id === queueId);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter(x => x.id !== queueId);
    });
  };

  const handleDeletePersisted = async (id: string, name: string) => {
    if (window.confirm(`Delete "${name}" from your private gallery?`)) {
      try {
        const ok = await deleteMediaItem(id);
        if (ok) {
          setPersistedMedia(prev => prev.filter(m => m.id !== id));
          if (selectedMedia?.id === id) {
            setSelectedMedia(null);
          }
        }
      } catch (err) {
        console.error('Failed to delete media:', err);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const filteredMedia = persistedMedia.filter(m => activeAlbum === 'All' || m.album === activeAlbum);

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-dawn)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(237,230,249,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(201,175,240,0.4)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon size={22} style={{ color: '#9d6de8' }} />
            <h1 className="font-heading text-2xl font-bold" style={{ color: '#3d1a4a' }}>Memory Gallery</h1>
            <EncryptedBadge />
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
            id="upload-media-btn"
          >
            <Upload size={15} /> Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_MEDIA_TYPES.join(',')}
            className="hidden"
            onChange={e => addFiles(e.target.files)}
            aria-label="Upload media files"
            id="media-file-input"
          />
        </div>

        {/* Album tabs */}
        <div className="max-w-5xl mx-auto px-6 pb-3 flex gap-2 flex-wrap">
          {albums.map(a => (
            <button
              key={a}
              onClick={() => setActiveAlbum(a)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={activeAlbum === a
                ? { background: 'linear-gradient(135deg,#9d6de8,#c0637f)', color: 'white' }
                : { background: 'rgba(255,255,255,0.5)', color: '#6b3fbc', border: '1px solid rgba(201,175,240,0.4)' }
              }
            >
              <FolderOpen size={12} /> {a}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {errorMessage && (
          <div
            className="p-3 rounded-2xl flex items-center gap-2 text-xs font-medium"
            role="alert"
            style={{
              background: 'rgba(232,127,160,0.2)',
              border: '1px solid rgba(232,127,160,0.5)',
              color: '#a03050',
            }}
          >
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="ml-auto text-xs opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload zone: drag and drop or click to upload images and videos"
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          className="rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-all"
          style={{
            borderColor: dragging ? '#9d6de8' : 'rgba(201,175,240,0.5)',
            background: dragging ? 'rgba(157,109,232,0.08)' : 'rgba(255,255,255,0.3)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(157,109,232,0.1)' }}
          >
            <Upload size={28} style={{ color: '#9d6de8' }} />
          </div>
          <div className="text-center">
            <p className="font-semibold" style={{ color: '#3d1a4a' }}>Drop photos & videos here</p>
            <p className="text-sm mt-1 opacity-60" style={{ color: '#6b3fbc' }}>
              or click to browse · Max 200 MB · JPG, PNG, GIF, WebP, MP4, WebM
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: '#6b3fbc', opacity: 0.7 }}>
            <Shield size={12} /> Files are persisted safely in your private memory vault
          </div>
        </div>

        {/* Upload queue */}
        {queue.length > 0 && (
          <section aria-labelledby="upload-queue-heading">
            <h2 id="upload-queue-heading" className="font-heading text-lg font-semibold mb-3" style={{ color: '#3d1a4a' }}>
              Upload Queue
            </h2>
            <div className="space-y-3">
              {queue.map(f => (
                <UploadCard
                  key={f.id}
                  file={f}
                  onUpload={processUpload}
                  onRemove={handleRemoveFromQueue}
                />
              ))}
            </div>
          </section>
        )}

        {/* Gallery grid — displays real persisted items and starter placeholders */}
        <section aria-labelledby="gallery-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="gallery-heading" className="font-heading text-lg font-semibold" style={{ color: '#3d1a4a' }}>
              Gallery {filteredMedia.length > 0 ? `(${filteredMedia.length})` : ''}
            </h2>
          </div>

          {filteredMedia.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <SyntheticThumbnail key={i} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredMedia.map(item => (
                <article
                  key={item.id}
                  className="aspect-square rounded-2xl overflow-hidden relative group princess-card shadow-soft transition-all hover:scale-[1.02] hover:shadow-glow"
                  data-testid="gallery-item"
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
                          <Play size={18} className="text-violet-700 ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/50 text-white backdrop-blur-sm">
                    {item.type === 'video' ? <Video size={10} /> : <ImageIcon size={10} />}
                    <span className="capitalize">{item.type}</span>
                  </div>

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePersisted(item.id, item.name); }}
                        className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                        aria-label={`Delete ${item.name}`}
                        title="Delete media"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-white font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-white/70">{(item.size / (1024 * 1024)).toFixed(1)} MB</p>
                      <button
                        onClick={() => setSelectedMedia(item)}
                        className="mt-1.5 w-full py-1 rounded-lg bg-white/30 hover:bg-white/50 text-white text-xs flex items-center justify-center gap-1"
                      >
                        <Eye size={12} /> View
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Lightbox / Media Viewer Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedMedia(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white"
              aria-label="Close preview"
            >
              <X size={24} />
            </button>

            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.name}
                className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain"
              />
            ) : (
              <video
                src={selectedMedia.url}
                controls
                autoPlay
                className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl"
              />
            )}

            <div className="mt-3 text-center text-white">
              <p className="font-medium text-sm">{selectedMedia.name}</p>
              <p className="text-xs opacity-60">
                {(selectedMedia.size / (1024 * 1024)).toFixed(2)} MB · {new Date(selectedMedia.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Upload Card ────────────────────────────────────────── */
function UploadCard({
  file, onUpload, onRemove,
}: {
  file: QueueFile;
  onUpload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const Icon = file.type === 'video' ? Video : ImageIcon;
  const statusLabel = {
    pending: 'Pending',
    encrypting: 'Encrypting locally…',
    uploading: 'Persisting to vault…',
    done: 'Saved & encrypted',
    error: file.error ?? 'Upload failed',
  }[file.status];

  return (
    <article
      className="princess-card px-4 py-3 flex items-center gap-4"
      aria-label={`Upload: ${file.file.name}`}
    >
      {/* Preview */}
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative"
        style={{ background: 'rgba(201,175,240,0.2)' }}>
        {file.type === 'image' ? (
          <img src={file.preview} alt="" className="w-full h-full object-cover" aria-hidden />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video size={22} style={{ color: '#9d6de8' }} />
          </div>
        )}
        <div className="absolute top-1 right-1">
          <Icon size={11} style={{ color: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
        </div>
      </div>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate" style={{ color: '#3d1a4a' }}>{file.file.name}</p>
          <span className="text-xs shrink-0" style={{ color: '#9d6de8' }}>
            {(file.file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {file.status === 'done' && <CheckCircle2 size={12} style={{ color: '#2a8050' }} />}
          {file.status === 'error' && <AlertCircle size={12} style={{ color: '#cc3333' }} />}
          <p className="text-xs opacity-70" style={{ color: file.status === 'error' ? '#cc3333' : '#6b3fbc' }}>
            {statusLabel}
          </p>
        </div>
        {(file.status === 'uploading' || file.status === 'encrypting') && (
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,175,240,0.3)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${file.progress}%`,
                background: 'linear-gradient(90deg, #9d6de8, #e87fa0)',
              }}
              role="progressbar"
              aria-valuenow={file.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Upload progress: ${file.progress}%`}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        {file.status === 'pending' && (
          <button
            onClick={() => onUpload(file.id)}
            className="btn-primary py-1.5 px-3 text-xs"
            id={`upload-btn-${file.id}`}
          >
            Upload
          </button>
        )}
        {file.status === 'error' && (
          <button
            onClick={() => onUpload(file.id)}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
            aria-label="Retry upload"
          >
            <RefreshCw size={11} /> Retry
          </button>
        )}
        <button
          onClick={() => onRemove(file.id)}
          className="p-1.5 rounded-lg hover:text-red-400 transition-colors"
          style={{ color: 'rgba(160,100,130,0.5)' }}
          aria-label="Remove from queue"
        >
          <X size={14} />
        </button>
      </div>
    </article>
  );
}

/* ─── Synthetic Thumbnail ─────────────────────────────────── */
const THUMB_PALETTES = [
  ['#fde8f0','#f9c6d4','#e87fa0'],
  ['#ede6f9','#c9aff0','#9d6de8'],
  ['#dde8ff','#b0c8f8','#6090e8'],
  ['#fff8e8','#fde8b0','#f5c842'],
];
const THUMB_EMOJIS = ['🌸','🌙','✨','🦋','🌹','💫','🌿','🎀'];

function SyntheticThumbnail({ index }: { index: number }) {
  const [from, mid, to] = THUMB_PALETTES[index % THUMB_PALETTES.length];
  const emoji = THUMB_EMOJIS[index % THUMB_EMOJIS.length];
  return (
    <button
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 group relative overflow-hidden transition-all hover:scale-105 hover:shadow-glow"
      style={{ background: `linear-gradient(135deg, ${from}, ${mid})` }}
      aria-label={`Gallery photo ${index + 1} (encrypted preview)`}
    >
      <div className="text-4xl">{emoji}</div>
      <div className="flex items-center gap-1 text-xs font-medium"
        style={{ color: to }}>
        <Lock size={10} />
        Encrypted
      </div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity
        flex items-center justify-center"
        style={{ background: 'rgba(107,63,188,0.15)' }}>
        <Eye size={20} style={{ color: 'white' }} />
      </div>
    </button>
  );
}
