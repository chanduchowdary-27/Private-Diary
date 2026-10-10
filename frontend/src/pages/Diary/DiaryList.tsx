import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  PenLine, Search, Tag, Trash2, BookHeart,
  ChevronRight, Clock, Sparkles, Loader2,
} from 'lucide-react';
import { MOODS } from '../../utils/mockData';
import { EncryptedBadge } from '../../components/ui/LockBadge';
import {
  getDiaryEntries,
  deleteDiaryEntry,
  ensureInitialSeed,
  type StoredDiaryEntry,
} from '../../services/storageService';

export default function DiaryList() {
  const [entries, setEntries] = useState<StoredDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<string>('');
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      await ensureInitialSeed();
      const data = await getDiaryEntries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load diary entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
      || e.tags.some(t => t.toLowerCase().includes(q));
    const matchMood = !moodFilter || e.mood === moodFilter;
    return matchSearch && matchMood;
  });

  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('Delete this entry? This action cannot be undone.')) {
      try {
        const ok = await deleteDiaryEntry(id);
        if (ok) {
          setEntries(prev => prev.filter(e => e.id !== id));
        }
      } catch (err) {
        console.error('Failed to delete diary entry:', err);
      }
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-dawn)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(253,232,240,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(249,198,212,0.4)',
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookHeart size={22} style={{ color: '#c0637f' }} />
              <h1 className="font-heading text-2xl font-bold" style={{ color: '#3d1a4a' }}>My Diary</h1>
              <EncryptedBadge />
            </div>
            <button
              onClick={() => navigate('/diary/new')}
              id="new-entry-btn"
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
            >
              <PenLine size={15} /> New Entry
            </button>
          </div>

          {/* Search + filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                style={{ color: '#9d6de8' }} />
              <input
                type="search"
                placeholder="Search entries…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-princess pl-9 py-2 text-sm"
                id="diary-search"
                aria-label="Search diary entries"
              />
            </div>
            <select
              value={moodFilter}
              onChange={e => setMoodFilter(e.target.value)}
              className="input-princess py-2 text-sm w-auto"
              aria-label="Filter by mood"
            >
              <option value="">All moods</option>
              {MOODS.map(m => (
                <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
              ))}
            </select>
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(201,175,240,0.5)' }}>
              {(['list', 'timeline'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: view === v ? 'rgba(201,175,240,0.4)' : 'rgba(255,255,255,0.5)',
                    color: view === v ? '#6b3fbc' : '#9d6de8',
                  }}
                >
                  {v === 'list' ? '≡ List' : '⊕ Timeline'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-24" role="status" aria-label="Loading entries">
            <Loader2 className="animate-spin" size={32} style={{ color: '#9d6de8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📖</div>
            <p className="font-heading text-lg" style={{ color: '#3d1a4a' }}>No entries found</p>
            <p className="text-sm mt-1 opacity-60" style={{ color: '#6b3fbc' }}>
              {search || moodFilter ? 'Try adjusting your search' : 'Write your first diary entry ✨'}
            </p>
            {!search && !moodFilter && (
              <button onClick={() => navigate('/diary/new')} className="btn-primary mt-4 text-sm">
                Write first entry
              </button>
            )}
          </div>
        ) : view === 'list' ? (
          <div className="space-y-3" role="list" aria-label="Diary entries">
            {filtered.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onOpen={() => navigate(`/diary/${entry.id}`)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        ) : (
          <TimelineView entries={filtered} onOpen={id => navigate(`/diary/${id}`)} />
        )}
      </div>
    </div>
  );
}

/* ─── Entry Card ──────────────────────────────────────────── */
function EntryCard({
  entry, onOpen, onDelete,
}: {
  entry: StoredDiaryEntry;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const mood = MOODS.find(m => m.value === entry.mood);
  const entryDate = new Date(entry.date);

  return (
    <article
      className="princess-card px-5 py-4 flex gap-4"
      role="listitem"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl cursor-pointer"
        style={{ background: 'rgba(249,198,212,0.25)' }}
        onClick={onOpen}
        aria-hidden
      >
        {mood?.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={onOpen}
          className="w-full text-left group"
        >
          <div className="font-heading font-semibold leading-snug group-hover:text-gradient-pink transition-colors"
            style={{ color: '#3d1a4a' }}>
            {entry.title}
          </div>
          <p className="text-xs mt-1 line-clamp-2 opacity-60 leading-relaxed" style={{ color: '#6b3fbc' }}>
            {entry.content}
          </p>
        </button>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full ${mood?.className}`}>
            {mood?.label}
          </span>
          {entry.tags.slice(0, 3).map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(201,175,240,0.2)', color: '#6b3fbc' }}>
              <Tag size={10} /> {t}
            </span>
          ))}
          <span className="text-xs opacity-40 flex items-center gap-1 ml-auto" style={{ color: '#6b3fbc' }}>
            <Clock size={10} /> {isNaN(entryDate.getTime()) ? 'Recent' : format(entryDate, 'MMM d, yyyy')}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          onClick={onOpen}
          className="btn-ghost p-1.5"
          aria-label={`Open entry: ${entry.title}`}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-colors hover:text-red-400"
          style={{ color: 'rgba(160,100,130,0.4)' }}
          aria-label={`Delete entry: ${entry.title}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

/* ─── Timeline View ──────────────────────────────────────── */
function TimelineView({
  entries,
  onOpen,
}: {
  entries: StoredDiaryEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-0 bottom-0 w-0.5 rounded-full"
        style={{ background: 'linear-gradient(to bottom, #f9c6d4, #c9aff0, transparent)' }} aria-hidden />

      {entries.map((entry, i) => {
        const mood = MOODS.find(m => m.value === entry.mood);
        const entryDate = new Date(entry.date);
        return (
          <div key={entry.id} className="relative mb-6 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            {/* Dot */}
            <div
              className="absolute -left-[18px] top-3 w-3.5 h-3.5 rounded-full border-2 border-white"
              style={{ background: '#e87fa0' }}
              aria-hidden
            />
            <button
              onClick={() => onOpen(entry.id)}
              className="w-full text-left princess-card px-5 py-4 ml-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-heading font-semibold text-sm" style={{ color: '#3d1a4a' }}>
                    {entry.title}
                  </div>
                  <div className="text-xs opacity-50 mt-0.5" style={{ color: '#6b3fbc' }}>
                    {isNaN(entryDate.getTime()) ? '' : format(entryDate, 'EEEE, MMMM d')} · {mood?.emoji} {mood?.label}
                  </div>
                </div>
                <Sparkles size={14} style={{ color: '#f5c842', flexShrink: 0, marginTop: 2 }} />
              </div>
              <p className="text-xs mt-2 line-clamp-2 leading-relaxed opacity-60" style={{ color: '#6b3fbc' }}>
                {entry.content}
              </p>
            </button>
          </div>
        );
      })}
    </div>
  );
}
