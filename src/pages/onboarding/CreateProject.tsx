import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject } from '../../api/projects'
import { useAuth } from '../../state/auth'

export default function CreateProject() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const [name, setName] = useState('')
  const [firstShiftDate, setFirstShiftDate] = useState('')
  const [locationName, setLocationName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const project = await createProject({
        name,
        firstShiftDate: firstShiftDate || null,
        locationName: locationName || null,
        displayName: displayName || user?.email?.split('@')[0] || 'Пользователь',
      })
      navigate(`/p/${project.id}/today`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать проект')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)]">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-xl font-semibold">Новый проект</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Название проекта</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: «Осенний свет»"
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Дата первой смены</span>
            <input
              type="date"
              value={firstShiftDate}
              onChange={(e) => setFirstShiftDate(e.target.value)}
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-dim)]">Место съёмки</span>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Город, объект"
              className="tap-target rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
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
            {busy ? 'Создаём…' : 'Создать проект'}
          </button>
        </form>
      </div>
    </div>
  )
}
