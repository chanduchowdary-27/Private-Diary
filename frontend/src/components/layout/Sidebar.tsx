import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookHeart, Home, Image, StickyNote, Settings,
  Lock, Menu, X, Sparkles, LogOut,
} from 'lucide-react';
import LockBadge from '../ui/LockBadge';

const NAV_ITEMS = [
  { to: '/home',    icon: Home,       label: 'Home'     },
  { to: '/diary',   icon: BookHeart,  label: 'Diary'    },
  { to: '/gallery', icon: Image,      label: 'Gallery'  },
  { to: '/notes',   icon: StickyNote, label: 'Notes'    },
  { to: '/settings',icon: Settings,   label: 'Settings' },
];

interface SidebarProps {
  isLocked: boolean;
  onLock: () => void;
  onSignOut?: () => void;
}

export default function Sidebar({ isLocked, onLock, onSignOut }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      onLock();
    }
    navigate('/');
  };

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-white/40 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-gradient-pink" style={{ color: '#e87fa0' }} />
          <span className="font-script text-xl" style={{ color: '#c0637f' }}>My Princess Diary</span>
        </div>
        <div className="flex items-center gap-3">
          <LockBadge locked={isLocked} size="sm" />
          <button
            onClick={() => setOpen(true)}
            className="btn-ghost p-2"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:h-screen
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          width: '260px',
          background: 'linear-gradient(180deg, #fde8f0 0%, #ede6f9 100%)',
          borderRight: '1px solid rgba(249,198,212,0.6)',
          boxShadow: '4px 0 32px rgba(180,120,200,0.12)',
        }}
      >
        {/* Logo area */}
        <div className="p-6 pb-4 border-b border-rose-petal/40 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">👑</span>
              <div>
                <div className="font-script text-xl leading-tight" style={{ color: '#c0637f' }}>
                  My Moon
                </div>
                <div className="font-script text-xl leading-tight" style={{ color: '#9d6de8' }}>
                  Diary
                </div>
              </div>
            </div>
            <div className="mt-2">
              <LockBadge locked={isLocked} size="sm" />
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden btn-ghost p-1"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                ${isActive
                  ? 'bg-gradient-to-r from-rose-petal/80 to-lavender/60 text-mauve shadow-soft'
                  : 'text-deep-violet/70 hover:bg-white/50 hover:text-deep-violet'
                }`
              }
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} style={{ color: isActive ? '#c0637f' : '#9d6de8' }} />
                  {label}
                  {isActive && <span className="ml-auto text-xs" style={{ color: '#e87fa0' }}>✦</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 space-y-2 border-t border-rose-petal/30">
          <button
            onClick={onLock}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
              text-mauve hover:bg-rose-petal/30 transition-all duration-200"
          >
            <Lock size={16} />
            Lock Diary
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
              text-violet/70 hover:bg-lavender/30 transition-all duration-200"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

        {/* Decorative bottom sparkles */}
        <div className="px-6 pb-5 flex justify-center gap-3 text-lavender text-lg select-none" aria-hidden>
          ✦ ❋ ✦ ❋ ✦
        </div>
      </aside>
    </>
  );
}
