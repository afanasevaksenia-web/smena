import { useEffect } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProject, listMembers, myRole } from '../api/projects'
import { getShift, listShifts } from '../api/shifts'
import { useAuth } from '../state/auth'
import { useProjectState } from '../state/project'
import { ProjectContext } from '../context/ProjectContext'

export default function ProjectProvider() {
  const { projectId } = useParams<{ projectId: string }>()
  const user = useAuth((s) => s.user)
  const setActiveProject = useProjectState((s) => s.setActiveProject)
  const viewingShiftId = useProjectState((s) => s.viewingShiftId)

  useEffect(() => {
    if (projectId) setActiveProject(projectId)
  }, [projectId, setActiveProject])

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
    retry: false,
  })

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listMembers(projectId!),
    enabled: !!projectId,
  })

  const shiftsQuery = useQuery({
    queryKey: ['shifts', projectId],
    queryFn: () => listShifts(projectId!),
    enabled: !!projectId,
  })

  const currentShiftId = projectQuery.data?.current_shift_id ?? null
  const currentShiftQuery = useQuery({
    queryKey: ['shift', currentShiftId],
    queryFn: () => getShift(currentShiftId!),
    enabled: !!currentShiftId,
  })

  if (projectQuery.isError) {
    return <Navigate to="/welcome" replace />
  }

  if (projectQuery.isLoading || membersQuery.isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-dim)]">
        Загрузка проекта…
      </div>
    )
  }

  if (!projectQuery.data) return null

  const viewingShift =
    (viewingShiftId ? shiftsQuery.data?.find((s) => s.id === viewingShiftId) : null) ?? currentShiftQuery.data ?? null

  return (
    <ProjectContext.Provider
      value={{
        project: projectQuery.data,
        members: membersQuery.data ?? [],
        myRole: myRole(membersQuery.data ?? [], user?.id),
        currentShift: currentShiftQuery.data ?? null,
        viewingShift,
        isViewingHistory: !!viewingShiftId && viewingShiftId !== currentShiftId,
      }}
    >
      <Outlet />
    </ProjectContext.Provider>
  )
}
