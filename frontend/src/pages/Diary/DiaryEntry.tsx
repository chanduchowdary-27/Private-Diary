import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, Save, Clock, Tag, X, Smile, Paperclip,
  Shield, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { MOODS, type Mood } from '../../utils/mockData';
import { EncryptedBadge } from '../../components/ui/LockBadge';
import {
  getDiaryEntry,
  saveDiaryEntry,
  ensureInitialSeed,
  type StoredDiaryEntry,
} from '../../services/storageService';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export default function DiaryEntry() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const currentIdRef = useRef<string | undefined>(isNew ? undefined : id);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Mood>('peaceful');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState('');
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const isInitialLoad = useRef(true);

  const autosaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const moodRef = useRef<HTMLDivElement>(null);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Load entry from storage on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      await ensureInitialSeed();
      if (!isNew && id) {
        try {
          const entry = await getDiaryEntry(id);
          if (entry && mounted) {
            setTitle(entry.title);
            setContent(entry.content);
            setMood(entry.mood);
            setTags(entry.tags || []);
            setEntryDate(new Date(entry.date));
            currentIdRef.current = entry.id;
          }
        } catch (err) {
          console.error('Failed to load entry:', err);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id, isNew]);

  // Actual persistent save
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      const saved: StoredDiaryEntry = await saveDiaryEntry({
        id: currentIdRef.current,
        title: title.trim() || 'Untitled Memory',
        content,
        mood,
        tags,
        date: entryDate,
      });
      currentIdRef.current = saved.id;
      setSaveStatus('saved');
      if (isNew && id === 'new') {
        navigate(`/diary/${saved.id}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'Save failed. Please try again.');
    }
  }, [title, content, mood, tags, entryDate, isNew, id, navigate]);

  // Autosave handler
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    setSaveStatus('unsaved');
    clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(autosaveRef.current);
  }, [title, content, mood, tags, loading, handleSave]);

  // Close mood picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moodRef.current && !moodRef.current.contains(e.target as Node)) {
        setShowMoodPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (t && !tags.includes(t) && tags.length < 10) {
        setTags(prev => [...prev, t]);
        setTagInput('');
      }
    }
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const currentMood = MOODS.find(m => m.value === mood) || MOODS[0];

  const StatusIcon = {
    saved: CheckCircle2,
    saving: Loader2,
    unsaved: Clock,
    error: AlertCircle,
  }[saveStatus];

  const statusColor = {
    saved: '#2a8050',
    saving: '#9d6de8',
    unsaved: '#c0637f',
    error: '#cc3333',
  }[saveStatus];

  const statusText = {
    saved: 'Saved & encrypted',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: errorMessage || 'Save failed',
  }[saveStatus];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-dawn)' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: '#9d6de8' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-dawn)' }}>
      {/* Sticky toolbar */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(253,232,240,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(249,198,212,0.4)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/diary')}
            className="btn-ghost p-2"
            aria-label="Back to diary"
            id="back-to-diary-btn"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1" />

          {/* Save status */}
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            role="status"
            aria-live="polite"
            aria-label={`Save status: ${statusText}`}
            style={{ color: statusColor }}
            id="diary-save-status"
          >
            <StatusIcon
              size={13}
              className={saveStatus === 'saving' ? 'animate-spin' : ''}
            />
            {statusText}
          </div>

          <EncryptedBadge />

          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
            id="save-entry-btn"
            aria-label="Save entry"
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* Diary page */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {saveStatus === 'error' && errorMessage && (
          <div
            className="mb-4 flex items-center gap-2 p-3 rounded-2xl text-xs font-medium"
            role="alert"
            style={{
              background: 'rgba(232,127,160,0.2)',
              border: '1px solid rgba(232,127,160,0.5)',
              color: '#a03050',
            }}
          >
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div
          className="rounded-3xl overflow-hidden shadow-card"
          style={{ border: '1px solid rgba(249,198,212,0.4)' }}
        >
          {/* Paper header */}
          <div
            className="px-8 pt-8 pb-4"
            style={{
              background: 'linear-gradient(180deg, rgba(253,232,240,0.8) 0%, rgba(255,249,244,0.9) 100%)',
              borderBottom: '1px dashed rgba(201,175,240,0.4)',
            }}
          >
            {/* Date + mood */}
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm font-medium opacity-60" style={{ color: '#6b3fbc' }}>
                <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
                {format(entryDate, 'EEEE, MMMM d, yyyy')}
              </div>

              {/* Mood picker */}
              <div className="relative" ref={moodRef}>
                <button
                  onClick={() => setShowMoodPicker(!showMoodPicker)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${currentMood.className}`}
                  aria-expanded={showMoodPicker}
                  aria-haspopup="listbox"
                  aria-label={`Current mood: ${currentMood.label}. Click to change`}
                >
                  <span>{currentMood.emoji}</span>
                  <span>{currentMood.label}</span>
                  <Smile size={13} />
                </button>
                {showMoodPicker && (
                  <div
                    role="listbox"
                    aria-label="Select mood"
                    className="absolute right-0 top-full mt-2 p-2 rounded-2xl shadow-glow z-40"
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(201,175,240,0.4)',
                      width: '220px',
                    }}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {MOODS.map(m => (
                        <button
                          key={m.value}
                          role="option"
                          aria-selected={mood === m.value}
                          onClick={() => { setMood(m.value); setShowMoodPicker(false); }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${m.className}
                            ${mood === m.value ? 'ring-2 ring-violet/40' : 'hover:opacity-80'}`}
                        >
                          {m.emoji} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title of this memory…"
              className="w-full text-2xl font-heading font-semibold bg-transparent border-none outline-none placeholder-opacity-30"
              style={{ color: '#3d1a4a', fontFamily: 'var(--font-heading)' }}
              id="entry-title"
              aria-label="Entry title"
            />
          </div>

          {/* Diary page content area */}
          <div className="diary-page px-8 py-6 min-h-[420px]">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Dear Diary… write your thoughts here. Everything here is encrypted, just for you. ✨"
              className="w-full bg-transparent border-none outline-none resize-none text-base leading-7"
              style={{
                color: '#3d1a4a',
                fontFamily: 'var(--font-body)',
                minHeight: '380px',
              }}
              id="entry-content"
              aria-label="Entry content"
              aria-multiline="true"
            />
          </div>

          {/* Footer: tags + word count */}
          <div
            className="px-8 py-4 flex items-center gap-3 flex-wrap"
            style={{
              background: 'rgba(237,230,249,0.4)',
              borderTop: '1px dashed rgba(201,175,240,0.4)',
            }}
          >
            <Tag size={14} style={{ color: '#9d6de8', flexShrink: 0 }} />
            <div className="flex flex-wrap gap-1.5 flex-1">
              {tags.map(t => (
                <span
                  key={t}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(201,175,240,0.3)', color: '#6b3fbc' }}
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag: ${t}`}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder={tags.length === 0 ? 'Add tags… (press Enter)' : 'Add more…'}
                className="bg-transparent border-none outline-none text-xs"
                style={{ color: '#6b3fbc', minWidth: 80 }}
                aria-label="Add tag"
              />
            </div>
            <div className="text-xs opacity-40 ml-auto" style={{ color: '#6b3fbc' }}>
              {wordCount} word{wordCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Attach media reminder */}
        <div className="mt-4 flex items-center gap-2 text-sm opacity-60" style={{ color: '#9d6de8' }}>
          <Paperclip size={14} />
          <span>Media attachments are stored safely in your private memory vault</span>
        </div>

        {/* Encryption notice */}
        <div
          className="mt-3 flex items-center gap-2 text-xs rounded-xl p-3"
          style={{ background: 'rgba(157,109,232,0.08)', border: '1px solid rgba(157,109,232,0.2)', color: '#6b3fbc' }}
        >
          <Shield size={13} />
          Your entry content, title, mood, and tags are encrypted and stored persistently in your local vault.
        </div>
      </div>
    </div>
  );
}
