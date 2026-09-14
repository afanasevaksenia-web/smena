import { create } from 'zustand'

const ACTIVE_PROJECT_KEY = 'smena:activeProjectId'

function readInitial(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY)
  } catch {
    return null
  }
}

interface ProjectState {
  activeProjectId: string | null
  /**
   * Смена, которую пользователь ПРОСМАТРИВАЕТ на этом устройстве (история).
   * Это НЕ то же самое, что "текущая смена проекта" на сервере — просмотр
   * истории одним человеком не должен переключать день у остальных.
   */
  viewingShiftId: string | null
  setActiveProject: (id: string | null) => void
  setViewingShift: (id: string | null) => void
}

export const useProjectState = create<ProjectState>((set) => ({
  activeProjectId: readInitial(),
  viewingShiftId: null,
  setActiveProject: (id) => {
    try {
      if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id)
      else localStorage.removeItem(ACTIVE_PROJECT_KEY)
    } catch {
      // localStorage недоступен (приватный режим и т.п.) — переживём без персистентности
    }
    set({ activeProjectId: id, viewingShiftId: null })
  },
  setViewingShift: (id) => set({ viewingShiftId: id }),
}))
