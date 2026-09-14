import { Link } from 'react-router-dom'
import { useProjectContext } from '../../context/ProjectContext'
import { useAuth } from '../../state/auth'
import { roleAtLeast } from '../../api/projects'

export default function More() {
  const { project, myRole } = useProjectContext()
  const signOut = useAuth((s) => s.signOut)

  const links = [
    { to: 'callsheet', label: 'Вызывной' },
    { to: 'script', label: 'Сценарий' },
    { to: 'locations', label: 'Объекты съёмки' },
    { to: 'calendar', label: 'Календарь КПП' },
    { to: 'shifts', label: 'История смен' },
    { to: 'members', label: 'Участники' },
  ]
  if (roleAtLeast(myRole, 'owner')) {
    links.push({ to: 'settings', label: 'Настройки проекта и приглашения' })
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div>
        <div className="text-sm text-[var(--color-text-dim)]">{project.name}</div>
        <h1 className="text-xl font-semibold">Ещё</h1>
      </div>

      <nav className="flex flex-col divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)]">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="tap-target flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--color-bg-sunken)]">
            <span>{l.label}</span>
            <span aria-hidden="true" className="text-[var(--color-text-faint)]">
              →
            </span>
          </Link>
        ))}
        <Link to="/welcome" className="tap-target flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--color-bg-sunken)]">
          <span>Переключить проект</span>
          <span aria-hidden="true" className="text-[var(--color-text-faint)]">
            →
          </span>
        </Link>
      </nav>

      <button
        type="button"
        onClick={() => signOut()}
        className="tap-target rounded-xl border border-[var(--color-border)] px-4 py-3 text-center text-sm text-[var(--color-danger)]"
      >
        Выйти из аккаунта
      </button>
    </div>
  )
}
