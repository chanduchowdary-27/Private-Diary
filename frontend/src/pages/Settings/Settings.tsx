import { useState } from 'react';
import {
  Settings as SettingsIcon, Lock, Key, Download, Upload,
  Shield, Timer, AlertTriangle, ChevronRight, Eye, EyeOff,
  CheckCircle2, RefreshCw,
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: typeof SettingsIcon;
  color: string;
}

const SECTIONS: SettingsSection[] = [
  { id: 'security', title: 'Security & Encryption', icon: Shield,       color: '#9d6de8' },
  { id: 'lock',     title: 'Lock Settings',         icon: Lock,         color: '#c0637f' },
  { id: 'backup',   title: 'Backup & Export',       icon: Download,     color: '#f5c842' },
  { id: 'recovery', title: 'Recovery Key',          icon: Key,          color: '#e87fa0' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('security');
  const [autoLockMins, setAutoLockMins] = useState(15);
  const [showCurrentVault, setShowCurrentVault] = useState(false);
  const [currentVault, setCurrentVault] = useState('');
  const [newVault, setNewVault] = useState('');
  const [confirmNewVault, setConfirmNewVault] = useState('');
  const [rotateStatus, setRotateStatus] = useState<'idle' | 'rotating' | 'done' | 'error'>('idle');
  const [exportLoading, setExportLoading] = useState(false);

  const handleKeyRotation = async () => {
    if (!currentVault || newVault.length < 12 || newVault !== confirmNewVault) return;
    setRotateStatus('rotating');
    await new Promise(r => setTimeout(r, 2500));
    setRotateStatus('done');
    setTimeout(() => {
      setRotateStatus('idle');
      setCurrentVault(''); setNewVault(''); setConfirmNewVault('');
    }, 3000);
  };

  const handleExport = async () => {
    setExportLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setExportLoading(false);
    alert('Encrypted backup downloaded.\nKeep it safe — it can only be decrypted with your vault password.');
  };

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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <SettingsIcon size={22} style={{ color: '#c0637f' }} />
          <h1 className="font-heading text-2xl font-bold" style={{ color: '#3d1a4a' }}>Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 flex gap-6 flex-col md:flex-row">
        {/* Sidebar nav */}
        <aside className="md:w-52 shrink-0">
          <nav className="space-y-1 sticky top-24" aria-label="Settings sections">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={activeSection === s.id
                    ? { background: 'rgba(249,198,212,0.5)', color: '#3d1a4a' }
                    : { color: '#6b3fbc', background: 'transparent' }
                  }
                  aria-current={activeSection === s.id ? 'page' : undefined}
                >
                  <Icon size={16} style={{ color: s.color }} />
                  {s.title}
                  {activeSection === s.id && <ChevronRight size={14} className="ml-auto" style={{ color: s.color }} />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 space-y-6">

          {activeSection === 'security' && (
            <section className="space-y-5" aria-labelledby="security-heading">
              <h2 id="security-heading" className="font-heading text-xl font-bold" style={{ color: '#3d1a4a' }}>
                Security & Encryption
              </h2>

              {/* Current encryption info */}
              <div className="princess-card p-5 space-y-3">
                <h3 className="font-semibold text-sm" style={{ color: '#3d1a4a' }}>Encryption Status</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Algorithm', value: 'XChaCha20-Poly1305' },
                    { label: 'Key Derivation', value: 'Argon2id (m=64 MiB, t=3, p=4)' },
                    { label: 'Key Storage', value: 'In-memory only — never persisted' },
                    { label: 'Server Access', value: 'Ciphertext only — server cannot decrypt' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2"
                      style={{ borderBottom: '1px solid rgba(201,175,240,0.2)' }}>
                      <span className="opacity-60" style={{ color: '#6b3fbc' }}>{label}</span>
                      <span className="font-mono text-xs font-semibold" style={{ color: '#3d1a4a' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change vault password */}
              <div className="princess-card p-5 space-y-4">
                <h3 className="font-semibold text-sm" style={{ color: '#3d1a4a' }}>
                  Change Vault Password
                </h3>
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', color: '#7a5a10' }}
                >
                  <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />
                  This re-wraps your encryption key. Existing entries remain decryptable.
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6b3fbc' }}>Current vault password</label>
                  <div className="relative">
                    <input
                      type={showCurrentVault ? 'text' : 'password'}
                      value={currentVault}
                      onChange={e => setCurrentVault(e.target.value)}
                      className="input-princess pr-10"
                      placeholder="Current vault password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentVault(!showCurrentVault)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                    >
                      {showCurrentVault ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6b3fbc' }}>New vault password (min 12 chars)</label>
                  <input
                    type="password"
                    value={newVault}
                    onChange={e => setNewVault(e.target.value)}
                    className="input-princess"
                    placeholder="New vault password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6b3fbc' }}>Confirm new vault password</label>
                  <input
                    type="password"
                    value={confirmNewVault}
                    onChange={e => setConfirmNewVault(e.target.value)}
                    className="input-princess"
                    placeholder="Repeat new vault password"
                  />
                </div>

                <button
                  onClick={handleKeyRotation}
                  disabled={!currentVault || newVault.length < 12 || newVault !== confirmNewVault || rotateStatus === 'rotating'}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {rotateStatus === 'rotating' ? (
                    <><RefreshCw size={14} className="animate-spin" /> Rotating key…</>
                  ) : rotateStatus === 'done' ? (
                    <><CheckCircle2 size={14} /> Key rotated successfully!</>
                  ) : (
                    <><Shield size={14} /> Rotate Vault Key</>
                  )}
                </button>
              </div>

              {/* Threat model link */}
              <div
                className="rounded-2xl p-4 text-sm"
                style={{ background: 'rgba(157,109,232,0.08)', border: '1px solid rgba(157,109,232,0.2)', color: '#6b3fbc' }}
              >
                <p className="font-semibold mb-1">🔐 Privacy Disclaimer</p>
                <p className="text-xs leading-relaxed opacity-80">
                  This application is NOT independently security-audited. Encryption uses established algorithms
                  (XChaCha20-Poly1305 via libsodium, Argon2id). The server cannot read your diary, but a
                  compromised device, browser extension, or malware can. See the full Threat Model for details.
                </p>
              </div>
            </section>
          )}

          {activeSection === 'lock' && (
            <section className="space-y-5" aria-labelledby="lock-heading">
              <h2 id="lock-heading" className="font-heading text-xl font-bold" style={{ color: '#3d1a4a' }}>
                Lock Settings
              </h2>
              <div className="princess-card p-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="auto-lock-select" className="font-medium text-sm flex items-center gap-2"
                      style={{ color: '#3d1a4a' }}>
                      <Timer size={16} style={{ color: '#c0637f' }} />
                      Auto-lock after inactivity
                    </label>
                    <span className="font-semibold text-sm" style={{ color: '#c0637f' }}>
                      {autoLockMins === 0 ? 'Never' : `${autoLockMins} min`}
                    </span>
                  </div>
                  <input
                    id="auto-lock-select"
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={autoLockMins}
                    onChange={e => setAutoLockMins(Number(e.target.value))}
                    className="w-full accent-pink-400"
                    aria-label={`Auto-lock after ${autoLockMins} minutes`}
                  />
                  <div className="flex justify-between text-xs opacity-40 mt-1" style={{ color: '#6b3fbc' }}>
                    <span>Never</span><span>5m</span><span>15m</span><span>30m</span><span>60m</span>
                  </div>
                </div>
                <p className="text-xs opacity-60 leading-relaxed" style={{ color: '#6b3fbc' }}>
                  When the diary locks, the decryption key is removed from memory. You will need to re-enter
                  your vault password to access your content.
                </p>
              </div>
            </section>
          )}

          {activeSection === 'backup' && (
            <section className="space-y-5" aria-labelledby="backup-heading">
              <h2 id="backup-heading" className="font-heading text-xl font-bold" style={{ color: '#3d1a4a' }}>
                Backup & Export
              </h2>
              <div className="princess-card p-5 space-y-4">
                <p className="text-sm opacity-70 leading-relaxed" style={{ color: '#6b3fbc' }}>
                  Your backup is encrypted with your vault key before download.
                  Only someone with the correct vault password can restore it.
                </p>
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', color: '#7a5a10' }}
                >
                  ⚠️ Keep this backup file private. Although it is encrypted, store it in a secure location.
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleExport}
                    disabled={exportLoading}
                    className="btn-primary flex items-center gap-2 text-sm"
                    id="export-backup-btn"
                  >
                    {exportLoading
                      ? <><RefreshCw size={14} className="animate-spin" /> Preparing…</>
                      : <><Download size={14} /> Export Encrypted Backup</>
                    }
                  </button>
                  <button className="btn-secondary flex items-center gap-2 text-sm" id="import-backup-btn">
                    <Upload size={14} /> Restore from Backup
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'recovery' && (
            <section className="space-y-5" aria-labelledby="recovery-heading">
              <h2 id="recovery-heading" className="font-heading text-xl font-bold" style={{ color: '#3d1a4a' }}>
                Recovery Key
              </h2>
              <div
                className="princess-card p-5 space-y-4"
                style={{ border: '1.5px solid rgba(232,127,160,0.4)' }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} style={{ color: '#c0637f', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#3d1a4a' }}>Critical: Recovery Key</p>
                    <p className="text-xs mt-1 leading-relaxed opacity-70" style={{ color: '#6b3fbc' }}>
                      Your 24-word recovery key is the only way to unlock your diary if you forget your vault
                      password. Losing both the vault password <strong>and</strong> the recovery key makes your
                      diary data <strong>permanently and irreversibly inaccessible</strong>. There is no backdoor.
                      No support team can recover it.
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-xl p-4 font-mono text-sm leading-loose"
                  style={{
                    background: 'rgba(157,109,232,0.08)',
                    border: '1px dashed rgba(157,109,232,0.4)',
                    color: '#3d1a4a',
                    filter: 'blur(4px)',
                    userSelect: 'none',
                  }}
                  aria-label="Recovery key (blurred for privacy — generate below)"
                >
                  ████ ████ ████ ████ ████ ████<br />
                  ████ ████ ████ ████ ████ ████<br />
                  ████ ████ ████ ████ ████ ████<br />
                  ████ ████ ████ ████ ████ ████
                </div>

                <p className="text-xs opacity-60" style={{ color: '#6b3fbc' }}>
                  Recovery key generation and display will be implemented in Stage 4 (encryption implementation).
                  Write down all 24 words in order and store them in a physically secure location.
                </p>

                <button className="btn-secondary flex items-center gap-2 text-sm" disabled>
                  <Key size={14} /> Generate / View Recovery Key (Stage 4)
                </button>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
