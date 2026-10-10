import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Key, Eye, EyeOff, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import StarParticles from '../../components/ui/StarParticles';

import { getActiveSession } from '../../services/storageService';

interface UnlockProps {
  onUnlock: (newToken?: string) => void;
}

export default function Unlock({ onUnlock }: UnlockProps) {
  const [vaultPwd, setVaultPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'password' && vaultPwd.length < 1) {
      setError('Please enter your vault password.');
      return;
    }
    if (mode === 'recovery' && recoveryKey.trim().split(/\s+/).length < 24) {
      setError('Recovery key must be 24 words. Please check and try again.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const session = getActiveSession();
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.token ? { 'Authorization': `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify(
          mode === 'password'
            ? { vaultPassword: vaultPwd }
            : { recoveryKey }
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Incorrect vault password. Access denied.');
      }

      onUnlock(data.token);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Unlock failed. Please check your vault credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center overflow-hidden star-field"
      aria-label="Diary vault unlock screen"
    >
      <StarParticles count={120} variant="vault" />

      {/* Purple nebula blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #9d6de8, transparent)' }} aria-hidden />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #e87fa0, transparent)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md mx-4 animate-slide-up">
        {/* Crown & title */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 animate-pulse-glow"
            style={{ background: 'rgba(201,175,240,0.1)', border: '2px solid rgba(201,175,240,0.3)' }}
          >
            <Lock size={40} style={{ color: '#c9aff0' }} />
          </div>
          <h1 className="font-heading text-3xl font-bold text-gradient-gold" style={{ color: '#f5c842' }}>
            Unlock Your Diary
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(201,175,240,0.8)' }}>
            Enter your vault password to decrypt your entries
          </p>
        </div>

        {/* Card */}
        <div className="glass-dark rounded-3xl p-8"
          style={{ boxShadow: '0 0 60px rgba(157,109,232,0.2)' }}>

          {/* Mode toggle */}
          <div className="flex rounded-2xl p-1 mb-6"
            style={{ background: 'rgba(201,175,240,0.1)' }}>
            {(['password', 'recovery'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200
                  ${mode === m
                    ? 'text-white'
                    : 'opacity-50 hover:opacity-75'
                  }`}
                style={mode === m
                  ? { background: 'rgba(157,109,232,0.4)', color: 'white' }
                  : { color: 'rgba(201,175,240,0.8)' }
                }
              >
                {m === 'password' ? <span className="flex items-center justify-center gap-1.5"><Lock size={13} /> Vault Password</span>
                  : <span className="flex items-center justify-center gap-1.5"><Key size={13} /> Recovery Key</span>}
              </button>
            ))}
          </div>

          <form onSubmit={handleUnlock} noValidate className="space-y-4">
            {mode === 'password' ? (
              <div>
                <label htmlFor="vault-unlock-pwd" className="block text-sm font-medium mb-1.5"
                  style={{ color: 'rgba(249,198,212,0.9)' }}>
                  Vault Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(201,175,240,0.5)' }} />
                  <input
                    id="vault-unlock-pwd"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={vaultPwd}
                    onChange={e => setVaultPwd(e.target.value)}
                    placeholder="Enter your diary vault password"
                    aria-required="true"
                    className="w-full rounded-xl px-4 pl-9 pr-10 py-3 text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1.5px solid rgba(201,175,240,0.3)',
                      color: 'white',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#9d6de8')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(201,175,240,0.3)')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity"
                    style={{ color: 'rgba(201,175,240,0.6)' }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="recovery-key" className="block text-sm font-medium mb-1.5"
                  style={{ color: 'rgba(249,198,212,0.9)' }}>
                  24-Word Recovery Key
                </label>
                <textarea
                  id="recovery-key"
                  rows={4}
                  value={recoveryKey}
                  onChange={e => setRecoveryKey(e.target.value)}
                  placeholder="word1 word2 word3 ... word24"
                  aria-required="true"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1.5px solid rgba(201,175,240,0.3)',
                    color: 'white',
                    fontFamily: 'monospace',
                  }}
                />
                <p className="mt-1.5 text-xs" style={{ color: 'rgba(201,175,240,0.6)' }}>
                  Paste all 24 words separated by spaces
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl p-3 text-sm"
                style={{
                  background: 'rgba(232,127,160,0.15)',
                  border: '1px solid rgba(232,127,160,0.4)',
                  color: '#f9c6d4',
                }}
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Warning about key loss */}
            <div className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', color: 'rgba(245,200,66,0.8)' }}>
              ⚠️ Losing both your vault password and recovery key makes all diary data permanently unrecoverable.
              No backdoor exists.
            </div>

            <button
              type="submit"
              id="vault-unlock-submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-base transition-all duration-300"
              style={{
                background: loading ? 'rgba(157,109,232,0.4)' : 'linear-gradient(135deg, #9d6de8, #c0637f)',
                color: 'white',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(157,109,232,0.4)',
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Deriving key…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles size={16} />
                  Open My Diary
                </span>
              )}
            </button>
          </form>

          {/* Recovery link */}
          {mode === 'password' && (
            <button
              onClick={() => setMode('recovery')}
              className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: 'rgba(201,175,240,0.6)' }}
            >
              <RotateCcw size={12} />
              Forgot vault password? Use recovery key
            </button>
          )}
        </div>

        <p className="text-center mt-5 text-xs" style={{ color: 'rgba(201,175,240,0.4)' }}>
          🔐 Decryption happens entirely in your browser
        </p>
      </div>
    </div>
  );
}
