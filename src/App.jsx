import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectProvider, useProject } from './context/ProjectContext'
import Home from './pages/Home'
import Redirect from './pages/Redirect'
import Selection from './pages/Selection'
import Preparation from './pages/Preparation'
import Dashboard from './pages/Dashboard'

function RequireAuth({ children }) {
  const { isAuthed } = useAuth()
  return isAuthed ? children : <Navigate to="/" replace />
}

function RequireProject({ children }) {
  const { isAuthed } = useAuth()
  const { project } = useProject()
  if (!isAuthed) return <Navigate to="/" replace />
  if (!project) return <Navigate to="/selection" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/redirect" element={<Redirect />} />
            <Route
              path="/selection"
              element={
                <RequireAuth>
                  <Selection />
                </RequireAuth>
              }
            />
            <Route
              path="/preparation"
              element={
                <RequireProject>
                  <Preparation />
                </RequireProject>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireProject>
                  <Dashboard />
                </RequireProject>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
