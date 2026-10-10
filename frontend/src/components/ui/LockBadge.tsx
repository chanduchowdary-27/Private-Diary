import { Lock, Unlock, Shield } from 'lucide-react';

interface LockBadgeProps {
  locked: boolean;
  showText?: boolean;
  size?: 'sm' | 'md';
}

export default function LockBadge({ locked, showText = true, size = 'md' }: LockBadgeProps) {
  const cls = locked ? 'lock-badge-locked' : 'lock-badge-unlocked';
  const iconSize = size === 'sm' ? 12 : 14;
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cls} ${padding} ${textSize}`}
      role="status"
      aria-label={locked ? 'Diary locked' : 'Diary unlocked'}
    >
      {locked ? <Lock size={iconSize} /> : <Unlock size={iconSize} />}
      {showText && (locked ? 'Locked' : 'Unlocked')}
    </span>
  );
}

export function EncryptedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'sm' ? 11 : 14;
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${padding} ${textSize} font-medium`}
      style={{ background: 'rgba(157,109,232,0.12)', color: '#6b3fbc', border: '1px solid rgba(157,109,232,0.3)' }}
    >
      <Shield size={iconSize} />
      Encrypted
    </span>
  );
}
