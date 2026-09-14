import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { redeemInvite } from '../../api/invites'
import { useAuth } from '../../state/auth'

export default function JoinProject() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const project = await redeemInvite(code.trim(), displayName || user?.email?.split('@')[0] || 'Пользователь')
      navigate(`/p/${project.id}/today`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)]">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-xl font-semibold">Присоединиться по коду</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Код приглашения</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXX"
              autoCapitalize="characters"
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Ваше имя для группы</span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Имя Фамилия"
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          {error && <div className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="tap-target mt-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-medium text-[var(--color-accent-text)] disabled:opacity-60"
          >
            {busy ? 'Присоединяемся…' : 'Присоединиться'}
          </button>
        </form>
      </div>
    </div>
  )
}
