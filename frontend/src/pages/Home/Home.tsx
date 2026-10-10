import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  PenLine, Image, StickyNote, ChevronRight,
  Sparkles, CalendarDays, BookHeart, Smile,
} from 'lucide-react';
import StarParticles from '../../components/ui/StarParticles';
import LockBadge, { EncryptedBadge } from '../../components/ui/LockBadge';
import { MOODS, DAILY_INSPIRATIONS } from '../../utils/mockData';
import {
  getDiaryEntries,
  getMediaItems,
  getNotes,
  ensureInitialSeed,
  type StoredDiaryEntry,
} from '../../services/storageService';

interface HomeProps {
  isLocked: boolean;
}

export default function Home({ isLocked }: HomeProps) {
  const navigate = useNavigate();
  const today = new Date();
  const dayOfWeek = format(today, 'EEEE');
  const dateStr = format(today, 'MMMM d, yyyy');
  const inspiration = DAILY_INSPIRATIONS[today.getDate() % DAILY_INSPIRATIONS.length];

  const [entries, setEntries] = useState<StoredDiaryEntry[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await ensureInitialSeed();
        const [loadedEntries, loadedMedia, loadedNotes] = await Promise.all([
          getDiaryEntries(),
          getMediaItems(),
          getNotes(),
        ]);
        if (mounted) {
          setEntries(loadedEntries);
          setMediaCount(loadedMedia.length);
          setNotesCount(loadedNotes.length);
        }
      } catch (err) {
        console.error('Failed to load home data:', err);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const recentEntries = entries.slice(0, 3);
  const todayMoodValue = entries[0]?.mood;
  const todayMoodMeta = todayMoodValue ? MOODS.find(m => m.value === todayMoodValue) : null;

  const quickActions = [
    { icon: PenLine, label: 'New Entry',   color: '#e87fa0', bg: 'rgba(232,127,160,0.12)', to: '/diary/new' },
    { icon: Image,   label: 'Add Memory',  color: '#9d6de8', bg: 'rgba(157,109,232,0.12)', to: '/gallery' },
    { icon: StickyNote, label: 'New Note', color: '#f5c842', bg: 'rgba(245,200,66,0.12)',  to: '/notes' },
  ];

  const getMoodMeta = (mood: string) => MOODS.find(m => m.value === mood);

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--gradient-dawn)' }}>
      {/* Subtle background particles */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <StarParticles count={30} variant="light" />
      </div>

      {/* Decorative header band */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #fde8f0 0%, #ede6f9 60%, #dde8ff 100%)',
          borderBottom: '1px solid rgba(249,198,212,0.4)',
          paddingBottom: '2rem',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 pt-8">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-script text-2xl mb-1" style={{ color: '#c0637f' }}>
                Good Day, Moon ✨
              </div>
              <h1 className="font-heading text-4xl font-bold" style={{ color: '#3d1a4a' }}>
                {dayOfWeek}
              </h1>
              <p className="text-sm mt-1 opacity-70" style={{ color: '#6b3fbc' }}>{dateStr}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <LockBadge locked={isLocked} />
              <EncryptedBadge />
            </div>
          </div>

          {/* Inspiration card */}
          <div
            className="mt-5 rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(249,198,212,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={20} style={{ color: '#f5c842', flexShrink: 0 }} />
            <p className="font-body text-sm italic" style={{ color: '#6b3fbc' }}>
              {inspiration}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Quick actions */}
        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="font-heading text-lg font-semibold mb-4" style={{ color: '#3d1a4a' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {quickActions.map(({ icon: Icon, label, color, bg, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="princess-card flex flex-col items-center gap-3 py-5 px-3 cursor-pointer group"
                style={{ textAlign: 'center' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: bg }}
                >
                  <Icon size={22} style={{ color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: '#4a1f6e' }}>{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Stats row */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">Diary statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: BookHeart, value: entries.length, label: 'Entries', color: '#e87fa0' },
              { icon: Image,     value: mediaCount,      label: 'Memories', color: '#9d6de8' },
              { icon: StickyNote, value: notesCount,     label: 'Notes',   color: '#f5c842' },
              { icon: Smile,     value: todayMoodMeta ? todayMoodMeta.emoji : '🌸', label: "Today's Mood", color: '#c0637f' },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="princess-card p-4 text-center">
                <Icon size={20} style={{ color, margin: '0 auto 8px' }} />
                <div className="font-heading text-2xl font-bold" style={{ color: '#3d1a4a' }}>{value}</div>
                <div className="text-xs opacity-60 mt-1" style={{ color: '#6b3fbc' }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent entries */}
        <section aria-labelledby="recent-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-heading" className="font-heading text-lg font-semibold" style={{ color: '#3d1a4a' }}>
              Recent Memories
            </h2>
            <button
              onClick={() => navigate('/diary')}
              className="flex items-center gap-1 text-sm btn-ghost py-1"
              style={{ color: '#9d6de8' }}
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {recentEntries.length === 0 ? (
              <div className="princess-card p-6 text-center opacity-60 text-sm" style={{ color: '#6b3fbc' }}>
                No diary entries yet. Write your first story!
              </div>
            ) : (
              recentEntries.map(entry => {
                const mood = getMoodMeta(entry.mood);
                const entryDate = new Date(entry.date);
                return (
                  <button
                    key={entry.id}
                    onClick={() => navigate(`/diary/${entry.id}`)}
                    className="w-full text-left princess-card px-5 py-4 flex items-center gap-4 group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                      style={{ background: 'rgba(249,198,212,0.3)' }}
                      aria-hidden
                    >
                      {mood?.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-semibold text-sm truncate" style={{ color: '#3d1a4a' }}>
                        {entry.title}
                      </div>
                      <div className="text-xs mt-0.5 truncate opacity-60" style={{ color: '#6b3fbc' }}>
                        {entry.content}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${mood?.className}`}>
                          {mood?.label}
                        </span>
                        <span className="text-xs opacity-40" style={{ color: '#6b3fbc' }}>
                          {isNaN(entryDate.getTime()) ? 'Recent' : format(entryDate, 'MMM d')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="opacity-30 group-hover:opacity-70 transition-opacity shrink-0"
                      style={{ color: '#9d6de8' }} />
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Mini calendar row */}
        <section aria-labelledby="calendar-heading">
          <h2 id="calendar-heading" className="font-heading text-lg font-semibold mb-4" style={{ color: '#3d1a4a' }}>
            <CalendarDays size={18} style={{ display: 'inline', marginRight: 8, color: '#9d6de8' }} />
            This Month
          </h2>
          <MiniCalendar entries={entries} today={today} />
        </section>

      </div>
    </div>
  );
}

/* ─── Mini Calendar ──────────────────────────────────────────── */
function MiniCalendar({ entries, today }: { entries: StoredDiaryEntry[]; today: Date }) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const entryDays = new Set(
    entries
      .map(e => new Date(e.date))
      .filter(d => !isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year)
      .map(d => d.getDate())
  );

  const cells = Array.from({ length: firstDay }, (_, i) => ({ day: 0, key: `empty-${i}` }))
    .concat(Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, key: `day-${i + 1}` })));

  return (
    <div className="princess-card p-5">
      <div className="text-center font-heading font-semibold mb-4" style={{ color: '#3d1a4a' }}>
        {format(today, 'MMMM yyyy')}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-xs font-semibold opacity-40 py-1" style={{ color: '#6b3fbc' }}>{d}</div>
        ))}
        {cells.map(({ day, key }) => {
          if (day === 0) return <div key={key} />;
          const isToday = day === today.getDate();
          const hasEntry = entryDays.has(day);
          return (
            <div
              key={key}
              className="relative flex items-center justify-center h-8 w-full rounded-xl text-sm transition-all"
              style={{
                background: isToday
                  ? 'linear-gradient(135deg, #e87fa0, #c0637f)'
                  : hasEntry
                    ? 'rgba(201,175,240,0.3)'
                    : 'transparent',
                color: isToday ? 'white' : '#3d1a4a',
                fontWeight: isToday || hasEntry ? '600' : '400',
              }}
            >
              {day}
              {hasEntry && !isToday && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: '#e87fa0' }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
