import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './state/auth'
import AuthGate from './layout/AuthGate'
import Shell from './layout/Shell'
import SignIn from './pages/auth/SignIn'
import Welcome from './pages/onboarding/Welcome'
import CreateProject from './pages/onboarding/CreateProject'
import JoinProject from './pages/onboarding/JoinProject'
import ProjectProvider from './layout/ProjectProvider'
import Today from './pages/today/Today'
import Site from './pages/site/Site'
import Chats from './pages/chats/Chats'
import Board from './pages/board/Board'
import More from './pages/more/More'
import CallSheet from './pages/more/CallSheet'
import ScriptPage from './pages/more/ScriptPage'
import LocationsPage from './pages/more/LocationsPage'
import CalendarPage from './pages/more/CalendarPage'
import ShiftHistoryPage from './pages/more/ShiftHistoryPage'
import MembersPage from './pages/more/MembersPage'
import ProjectSettingsPage from './pages/more/ProjectSettingsPage'

export default function App() {
  const init = useAuth((s) => s.init)
  useEffect(() => init(), [init])

  return (
    <Routes>
      <Route path="/auth" element={<SignIn />} />
      <Route element={<AuthGate />}>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/create-project" element={<CreateProject />} />
        <Route path="/join" element={<JoinProject />} />
        <Route path="/p/:projectId" element={<ProjectProvider />}>
          <Route element={<Shell />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<Today />} />
            <Route path="site" element={<Site />} />
            <Route path="chats" element={<Chats />} />
            <Route path="chats/:channelId" element={<Chats />} />
            <Route path="board" element={<Board />} />
            <Route path="more" element={<More />} />
            <Route path="callsheet" element={<CallSheet />} />
            <Route path="script" element={<ScriptPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="shifts" element={<ShiftHistoryPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<ProjectSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Route>
    </Routes>
  )
}
