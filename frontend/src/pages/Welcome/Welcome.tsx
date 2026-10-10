import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, Lock, Mail, User, AlertTriangle } from 'lucide-react';
import StarParticles from '../../components/ui/StarParticles';

interface WelcomeProps {
  onAuth: (authData: { userId: string; email: string; token: string }) => void;
}

export default function Welcome({ onAuth }: WelcomeProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vaultPassword, setVaultPassword] = useState('');
  const [confirmVault, setConfirmVault] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    if (!email.trim()) return 'Email is required.';
    if (!email.includes('@')) return 'Please enter a valid email address.';
    if (password.length < 8) return 'Account password must be at least 8 characters.';
    if (mode === 'register') {
      if (vaultPassword.length < 8) return 'Diary vault password must be at least 8 characters.';
      if (vaultPassword !== confirmVault) return 'Vault passwords do not match.';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register'
        ? { email: email.trim().toLowerCase(), password, vaultPassword }
        : { email: email.trim().toLowerCase(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || (mode === 'register' ? 'Registration failed.' : 'Invalid email or password.'));
      }

      onAuth({
        userId: data.userId,
        email: data.email,
        token: data.token,
      });
      navigate('/unlock');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #fde8f0 0%, #ede6f9 50%, #dde8ff 100%)' }}
    >
      <StarParticles count={50} variant="light" />

      {/* Decorative circles */}
      <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #e87fa0, transparent)' }} aria-hidden />
      <div className="absolute bottom-[-60px] right-[-60px] w-72 h-72 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #9d6de8, transparent)' }} aria-hidden />

      <div className="relative z-10 w-full max-w-md mx-4 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 animate-float inline-block" aria-hidden>👑</div>
          <h1 className="font-heading text-4xl font-bold mb-1" style={{ color: '#6b3fbc' }}>
            My Private
          </h1>
          <div className="font-script text-3xl" style={{ color: '#c0637f' }}>Moon Diary</div>
          <p className="mt-2 text-sm" style={{ color: '#9d6de8' }}>
            Your magical, encrypted personal sanctuary ✨
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8 shadow-glow"
          style={{ border: '1px solid rgba(249,198,212,0.5)' }}>

          {/* Mode toggle */}
          <div className="flex rounded-2xl p-1 mb-6"
            style={{ background: 'rgba(201,175,240,0.2)' }}>
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200
                  ${mode === m
                    ? 'bg-white shadow-soft text-violet'
                    : 'text-violet/60 hover:text-violet'
                  }`}
                style={{ color: mode === m ? '#6b3fbc' : undefined }}
              >
                {m === 'login' ? '✨ Sign In' : '🌸 Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: '#6b3fbc' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                  style={{ color: '#9d6de8' }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="princess@example.com"
                  className="input-princess pl-9"
                  aria-required="true"
                />
              </div>
            </div>

            {/* Account password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: '#6b3fbc' }}>
                Account Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                  style={{ color: '#9d6de8' }} />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Account password (min 8 chars)"
                  className="input-princess pl-9 pr-10"
                  aria-required="true"
                  aria-describedby="password-hint"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === 'register' && (
                <p id="password-hint" className="mt-1 text-xs opacity-60" style={{ color: '#6b3fbc' }}>
                  Used to authenticate your account. Different from your diary vault password.
                </p>
              )}
            </div>

            {/* Vault password (register only) */}
            {mode === 'register' && (
              <>
                <div
                  className="rounded-2xl p-4 text-sm"
                  style={{ background: 'rgba(157,109,232,0.08)', border: '1px solid rgba(157,109,232,0.2)' }}
                >
                  <div className="flex gap-2 font-semibold mb-1" style={{ color: '#6b3fbc' }}>
                    <Sparkles size={15} /> Diary Vault Password
                  </div>
                  <p className="text-xs leading-relaxed opacity-80" style={{ color: '#6b3fbc' }}>
                    This password <strong>never leaves your device</strong>. It encrypts all your diary entries.
                    If you forget it and lose your recovery key, your diary is <strong>permanently inaccessible</strong>.
                    Store it safely.
                  </p>
                </div>

                <div>
                  <label htmlFor="vault-pwd" className="block text-sm font-medium mb-1.5" style={{ color: '#6b3fbc' }}>
                    Vault Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                      style={{ color: '#c0637f' }} />
                    <input
                      id="vault-pwd"
                      type={showVault ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={vaultPassword}
                      onChange={e => setVaultPassword(e.target.value)}
                      placeholder="Diary vault password (min 12 chars)"
                      className="input-princess pl-9 pr-10"
                      aria-required="true"
                    />
                    <button
                      type="button"
                      onClick={() => setShowVault(!showVault)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                      aria-label={showVault ? 'Hide vault password' : 'Show vault password'}
                    >
                      {showVault ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-vault" className="block text-sm font-medium mb-1.5" style={{ color: '#6b3fbc' }}>
                    Confirm Vault Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                      style={{ color: '#c0637f' }} />
                    <input
                      id="confirm-vault"
                      type="password"
                      autoComplete="new-password"
                      value={confirmVault}
                      onChange={e => setConfirmVault(e.target.value)}
                      placeholder="Repeat vault password"
                      className="input-princess pl-9"
                      aria-required="true"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl p-3 text-sm"
                style={{ background: 'rgba(232,127,160,0.15)', border: '1px solid rgba(232,127,160,0.4)', color: '#a03050' }}
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 text-base mt-2"
              id={mode === 'login' ? 'login-submit' : 'register-submit'}
            >
              {loading ? (
                <span className="inline-block w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? <Sparkles size={16} /> : <User size={16} />}
                  {mode === 'login' ? 'Enter Your Diary' : 'Create My Diary'}
                </>
              )}
            </button>
          </form>

          {/* Security disclaimer */}
          <p className="mt-4 text-center text-xs opacity-50" style={{ color: '#6b3fbc' }}>
            🔒 End-to-end encrypted · Your content is private
          </p>
        </div>

        <p className="text-center mt-4 text-xs opacity-40" style={{ color: '#3d1a4a' }}>
          Not production-secured without independent audit. See threat model.
        </p>
      </div>
    </div>
  );
}
