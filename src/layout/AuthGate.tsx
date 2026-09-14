import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../state/auth'
import OutboxSync from './OutboxSync'

export default function AuthGate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-dim)]">
        Загрузка…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return (
    <>
      <OutboxSync />
      <Outlet />
    </>
  )
}
