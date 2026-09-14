import { createContext, useContext } from 'react'
import type { Project, ProjectMember } from '../api/projects'
import type { Shift } from '../api/shifts'

export interface ProjectContextValue {
  project: Project
  members: ProjectMember[]
  myRole: ProjectMember['role'] | null
  currentShift: Shift | null
  /** Смена, которую пользователь просматривает на этом устройстве (история или текущая). */
  viewingShift: Shift | null
  isViewingHistory: boolean
}

export const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext должен использоваться внутри ProjectProvider')
  return ctx
}
