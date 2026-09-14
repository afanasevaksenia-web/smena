import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useProjectContext } from '../context/ProjectContext'

const NAV_ITEMS = [
  { to: 'today', label: 'Сегодня', icon: '☀' },
  { to: 'site', label: 'Площадка', icon: '📍' },
  { to: 'chats', label: 'Чаты', icon: '💬' },
  { to: 'board', label: 'Доска дня', icon: '📋' },
  { to: 'more', label: 'Ещё', icon: '⋯' },
]

export default function Shell() {
  const { projectId } = useParams<{ projectId: string }>()
  const { project, isViewingHistory } = useProjectContext()

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg)] text-[var(--color-text)] md:flex-row">
      <aside className="no-print hidden shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-raised)] md:flex md:w-60">
        <div className="px-4 py-5">
          <div className="text-lg font-semibold tracking-wide text-[var(--color-accent)]">СМЕНА</div>
          <div className="mt-1 truncate text-sm text-[var(--color-text-dim)]">{project.name}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={`/p/${projectId}/${item.to}`}
              className={({ isActive }) =>
                `tap-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'text-[var(--color-text-dim)] hover:bg-[var(--color-bg-sunken)]'
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isViewingHistory && (
          <div className="no-print bg-[var(--color-warn)] px-4 py-1.5 text-center text-sm font-medium text-[#241a00]">
            Вы просматриваете прошлую смену — это видно только вам
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-10 flex border-t border-[var(--color-border)] bg-[var(--color-bg-raised)] md:hidden"
        aria-label="Основная навигация"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={`/p/${projectId}/${item.to}`}
            className={({ isActive }) =>
              `tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
                isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-faint)]'
              }`
            }
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
