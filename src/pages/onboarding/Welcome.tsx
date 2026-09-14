import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listMyProjects } from '../../api/projects'
import { useAuth } from '../../state/auth'

export default function Welcome() {
  const signOut = useAuth((s) => s.signOut)
  const projectsQuery = useQuery({ queryKey: ['my-projects'], queryFn: listMyProjects })

  if (projectsQuery.isLoading) {
    return <div className="flex h-dvh items-center justify-center text-[var(--color-text-dim)]">Загрузка…</div>
  }

  const projects = projectsQuery.data ?? []
  const active = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  if (active.length === 1 && archived.length === 0 && !projectsQuery.isRefetching) {
    return <Navigate to={`/p/${active[0].id}/today`} replace />
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="text-2xl font-semibold tracking-wide text-[var(--color-accent)]">СМЕНА</div>
        </div>

        {active.length > 0 && (
          <div className="mb-8">
            <div className="mb-2 text-sm text-[var(--color-text-dim)]">Ваши проекты</div>
            <div className="flex flex-col gap-2">
              {active.map((p) => (
                <Link
                  key={p.id}
                  to={`/p/${p.id}/today`}
                  className="tap-target flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 hover:border-[var(--color-accent)]"
                >
                  <span className="font-medium">{p.name}</span>
                  {p.location_name && <span className="text-sm text-[var(--color-text-dim)]">{p.location_name}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            to="/create-project"
            className="tap-target rounded-lg bg-[var(--color-accent)] px-4 py-3 text-center font-medium text-[var(--color-accent-text)]"
          >
            Создать проект
          </Link>
          <Link
            to="/join"
            className="tap-target rounded-lg border border-[var(--color-border)] px-4 py-3 text-center font-medium hover:border-[var(--color-accent)]"
          >
            Присоединиться по коду
          </Link>
        </div>

        {archived.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 text-sm text-[var(--color-text-dim)]">Архив</div>
            <div className="flex flex-col gap-2">
              {archived.map((p) => (
                <Link
                  key={p.id}
                  to={`/p/${p.id}/today`}
                  className="tap-target flex flex-col rounded-lg border border-[var(--color-border)] px-4 py-3 opacity-70 hover:border-[var(--color-accent)]"
                >
                  <span className="font-medium">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => signOut()}
          className="tap-target mt-10 w-full text-center text-sm text-[var(--color-text-faint)] underline-offset-2 hover:underline"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}
