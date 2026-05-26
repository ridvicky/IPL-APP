import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { useAuthStore } from '@/store/authStore'

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col">
      {/* Hero section */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pb-8 overflow-hidden safe-top">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-ipl-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-ipl-gold/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 text-center mb-10 animate-fade-in">
          {/* Cricket ball SVG */}
          <div className="w-20 h-20 mx-auto mb-5 relative">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="38" fill="url(#ballGrad)" />
              <path d="M40 4 C40 4 18 20 18 40 C18 60 40 76 40 76" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none"/>
              <path d="M40 4 C40 4 62 20 62 40 C62 60 40 76 40 76" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none"/>
              <path d="M4 40 L76 40" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
              {/* Seam lines */}
              <path d="M24 16 Q30 28 26 40 Q22 52 28 64" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M56 16 Q50 28 54 40 Q58 52 52 64" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <defs>
                <linearGradient id="ballGrad" x1="0" y1="0" x2="80" y2="80">
                  <stop offset="0%" stopColor="#e94560"/>
                  <stop offset="100%" stopColor="#8b1a2e"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h1 className="text-5xl font-black text-white tracking-tight leading-none">
            IPL
          </h1>
          <p className="text-ipl-gold font-bold text-xl tracking-widest mt-1">AUCTION</p>
          <p className="text-gray-500 text-sm mt-1 tracking-wider">SIMULATOR</p>

          {/* Team dots decoration */}
          <div className="flex justify-center gap-1.5 mt-4">
            {['bg-yellow-400','bg-blue-500','bg-red-500','bg-purple-500','bg-sky-400','bg-pink-400','bg-orange-400','bg-rose-500','bg-cyan-500','bg-teal-400'].map((c, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${c} opacity-70`} />
            ))}
          </div>
        </div>

        {/* Auth Card */}
        <div className="relative z-10 w-full max-w-sm animate-slide-up">
          <div className="bg-ipl-card border border-ipl-border rounded-2xl p-6 shadow-card">
            {/* Tab toggle */}
            <div className="flex rounded-xl bg-ipl-darker p-1 mb-6">
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null) }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    mode === m
                      ? 'bg-ipl-accent text-white shadow-glow-accent'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-ipl-darker border border-ipl-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-ipl-accent focus:ring-1 focus:ring-ipl-accent/30 transition-colors placeholder-gray-700"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5 font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-ipl-darker border border-ipl-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-ipl-accent focus:ring-1 focus:ring-ipl-accent/30 transition-colors placeholder-gray-700"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-ipl-accent/10 border border-ipl-accent/30 rounded-xl px-4 py-3">
                  <p className="text-ipl-accent text-sm">{error}</p>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 h-12 text-base font-bold">
                {mode === 'login' ? 'Sign In →' : 'Create Account →'}
              </Button>
            </form>
          </div>

          {mode === 'signup' && (
            <p className="text-gray-600 text-xs text-center mt-4">
              Sessions are saved to the cloud and synced across devices.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
