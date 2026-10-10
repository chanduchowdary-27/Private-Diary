import { useState, useEffect, useCallback } from 'react';
import {
  PenLine, CheckSquare, Target, Heart, Smile, Search, Plus, Tag, Trash2,
  AlertCircle, Check, Loader2,
} from 'lucide-react';
import { EncryptedBadge } from '../../components/ui/LockBadge';
import {
  getNotes,
  saveNote,
  deleteNote as deleteNoteFromStorage,
  toggleTodoNote,
  ensureInitialSeed,
  type StoredNote,
} from '../../services/storageService';

const NOTE_TYPES: { type: StoredNote['type']; icon: typeof PenLine; label: string; color: string; bg: string }[] = [
  { type: 'note',      icon: PenLine,      label: 'Notes',    color: '#9d6de8', bg: 'rgba(157,109,232,0.12)' },
  { type: 'todo',      icon: CheckSquare,  label: 'To-do',    color: '#e87fa0', bg: 'rgba(232,127,160,0.12)' },
  { type: 'goal',      icon: Target,       label: 'Goals',    color: '#f5c842', bg: 'rgba(245,200,66,0.12)'  },
  { type: 'gratitude', icon: Heart,        label: 'Gratitude',color: '#c0637f', bg: 'rgba(192,99,127,0.12)' },
  { type: 'mood',      icon: Smile,        label: 'Mood',     color: '#2a8050', bg: 'rgba(42,128,80,0.12)'  },
];

interface NotesProps {
  initialType?: StoredNote['type'] | 'all';
}

export default function Notes({ initialType = 'all' }: NotesProps) {
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StoredNote['type'] | 'all'>(initialType);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<StoredNote['type']>(initialType === 'all' ? 'note' : initialType);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saveError, setSaveError] = useState('');

  const loadData = useCallback(async () => {
    try {
      await ensureInitialSeed();
      const loaded = await getNotes();
      setNotes(loaded);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (initialType && initialType !== 'all') {
      setFilter(initialType);
      setNewType(initialType);
    }
  }, [initialType]);

  const filtered = notes.filter(n => {
    const q = search.toLowerCase();
    const matchType = filter === 'all' || n.type === filter;
    const matchSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const createNote = async () => {
    if (!newTitle.trim()) return;
    setSaveError('');
    try {
      const saved = await saveNote({
        type: newType,
        title: newTitle.trim(),
        content: newContent,
        tags: [],
      });
      setNotes(prev => [saved, ...prev.filter(n => n.id !== saved.id)]);
      setNewTitle('');
      setNewContent('');
      setShowNew(false);
    } catch (err: any) {
      console.error('Failed to save note:', err);
      setSaveError(err.message || 'Failed to save note. Please try again.');
    }
  };

  const deleteNote = async (id: string) => {
    if (window.confirm('Delete this note?')) {
      try {
        const ok = await deleteNoteFromStorage(id);
        if (ok) {
          setNotes(prev => prev.filter(n => n.id !== id));
        }
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      const updated = await toggleTodoNote(id);
      if (updated) {
        setNotes(prev => prev.map(n => n.id === id ? updated : n));
      }
    } catch (err) {
      console.error('Failed to toggle todo status:', err);
    }
  };

  const getMeta = (type: StoredNote['type']) => NOTE_TYPES.find(t => t.type === type)!;

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-dawn)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(253,248,244,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(245,200,66,0.3)',
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PenLine size={22} style={{ color: '#f5c842' }} />
              <h1 className="font-heading text-2xl font-bold" style={{ color: '#3d1a4a' }}>
                {filter === 'todo' ? 'To-Do & Tasks' : 'Notes & Planner'}
              </h1>
              <EncryptedBadge />
            </div>
            <button
              onClick={() => { setShowNew(!showNew); setSaveError(''); }}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
              id="new-note-btn"
            >
              <Plus size={15} /> New Note
            </button>
          </div>

          {/* Type filter tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={filter === 'all'
                ? { background: '#3d1a4a', color: 'white' }
                : { background: 'rgba(255,255,255,0.5)', color: '#6b3fbc' }
              }
              id="filter-all"
            >
              All
            </button>
            {NOTE_TYPES.map(({ type, icon: Icon, label, color, bg }) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={filter === type
                  ? { background: color, color: 'white' }
                  : { background: bg, color }
                }
                id={`filter-${type}`}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
              style={{ color: '#9d6de8' }} />
            <input
              type="search"
              placeholder="Search notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-princess pl-9 py-2 text-sm"
              aria-label="Search notes"
              id="notes-search-input"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {saveError && (
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
            <span>{saveError}</span>
          </div>
        )}

        {/* New note form */}
        {showNew && (
          <div className="princess-card p-5 space-y-3 animate-slide-up">
            <div className="flex gap-2 flex-wrap">
              {NOTE_TYPES.map(({ type, icon: Icon, label, color, bg }) => (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={newType === type
                    ? { background: color, color: 'white' }
                    : { background: bg, color }
                  }
                  id={`new-type-${type}`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Note title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="input-princess"
              autoFocus
              id="new-note-title"
            />
            <textarea
              placeholder="Write your note…"
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={4}
              className="input-princess resize-none"
              id="new-note-content"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
              <button
                onClick={createNote}
                className="btn-primary py-2 px-4 text-sm"
                disabled={!newTitle.trim()}
                id="save-new-note-btn"
              >
                Save Note
              </button>
            </div>
          </div>
        )}

        {/* Notes grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20" role="status">
            <Loader2 className="animate-spin" size={32} style={{ color: '#9d6de8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📝</div>
            <p className="font-heading text-lg" style={{ color: '#3d1a4a' }}>No notes yet</p>
            <p className="text-sm mt-1 opacity-60" style={{ color: '#6b3fbc' }}>Create your first note above</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" role="list" aria-label="Notes">
            {filtered.map(note => {
              const meta = getMeta(note.type);
              const Icon = meta.icon;
              const isTodo = note.type === 'todo';
              const createdDate = new Date(note.createdAt);

              return (
                <article
                  key={note.id}
                  className="princess-card p-5 flex flex-col gap-3"
                  role="listitem"
                  data-testid="note-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: meta.bg }}
                      >
                        <Icon size={15} style={{ color: meta.color }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isTodo && (
                        <button
                          onClick={() => handleToggleTodo(note.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            note.completed
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'border-violet-300 hover:border-violet-500'
                          }`}
                          aria-label={note.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                          title={note.completed ? 'Completed' : 'Pending'}
                        >
                          {note.completed && <Check size={12} strokeWidth={3} />}
                        </button>
                      )}
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1 rounded hover:text-red-400 transition-colors"
                        style={{ color: 'rgba(160,100,130,0.4)' }}
                        aria-label={`Delete note: ${note.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3
                      className={`font-heading font-semibold text-sm ${
                        isTodo && note.completed ? 'line-through opacity-50' : ''
                      }`}
                      style={{ color: '#3d1a4a' }}
                    >
                      {note.title}
                    </h3>
                    <p className={`text-xs mt-1.5 leading-relaxed line-clamp-4 ${
                      isTodo && note.completed ? 'line-through opacity-40' : 'opacity-70'
                    }`}
                      style={{ color: '#6b3fbc', whiteSpace: 'pre-wrap' }}>
                      {note.content}
                    </p>
                  </div>

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {note.tags.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: 'rgba(201,175,240,0.2)', color: '#6b3fbc' }}>
                          <Tag size={9} /> {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs opacity-40 mt-auto" style={{ color: '#6b3fbc' }}>
                    {isNaN(createdDate.getTime()) ? 'Recently' : createdDate.toLocaleDateString()}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
