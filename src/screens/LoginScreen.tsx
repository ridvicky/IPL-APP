import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import gplLogo from '@/assets/gpl_logo.svg'

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
    if (err) setError(typeof err === 'string' && err.length > 0 ? err : 'Something went wrong. Please try again.')
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
          {/* GPL Logo */}
          <div className="relative mx-auto mb-4 w-fit">
            <div className="absolute inset-0 rounded-full bg-ipl-gold/20 blur-2xl scale-150 pointer-events-none" />
            <img
              src={gplLogo}
              alt="GPL Auction"
              className="relative w-44 h-auto drop-shadow-[0_0_32px_rgba(201,162,39,0.5)]"
            />
          </div>

          <p className="text-gray-400 text-sm font-semibold tracking-[0.3em] uppercase mt-2">
            Auction Simulator
          </p>

          {/* Franchise color strip */}
          <div className="flex justify-center gap-1 mt-4">
            {['bg-yellow-400','bg-blue-500','bg-red-500','bg-purple-500','bg-sky-400','bg-pink-400','bg-orange-400','bg-rose-500','bg-cyan-500','bg-teal-400'].map((c, i) => (
              <span key={i} className={`w-5 h-[3px] rounded-full ${c} opacity-60`} />
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
