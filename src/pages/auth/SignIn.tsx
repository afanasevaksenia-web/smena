import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../state/auth'

export default function SignIn() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && session) return <Navigate to="/welcome" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error, data } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setNotice('Проверьте почту — мы отправили письмо для подтверждения регистрации.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-4 text-[var(--color-text)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-semibold tracking-wide text-[var(--color-accent)]">СМЕНА</div>
          <div className="mt-1 text-sm text-[var(--color-text-dim)]">Мобильный штаб съёмочной площадки</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Электронная почта</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Пароль</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          {error && <div className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>}
          {notice && <div className="rounded-lg bg-[var(--color-ok)]/10 px-3 py-2 text-sm text-[var(--color-ok)]">{notice}</div>}

          <button
            type="submit"
            disabled={busy}
            className="tap-target mt-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-medium text-[var(--color-accent-text)] disabled:opacity-60"
          >
            {mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="tap-target mt-4 w-full text-center text-sm text-[var(--color-text-dim)] underline-offset-2 hover:underline"
        >
          {mode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  )
}
