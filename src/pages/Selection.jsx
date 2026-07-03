import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Logo from '../components/Logo'
import ProjectPickerModal from '../components/ProjectPickerModal'
import { listConsoleProjects } from '../lib/appwrite'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'

export default function Selection() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const { selectProject } = useProject()
  const [state, setState] = useState({ status: 'loading' }) // loading | pick | empty | error
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    listConsoleProjects(accessToken, { limit: 6, offset: 0 })
      .then(({ total, projects }) => {
        if (total === 1 && projects[0]) {
          // Exactly one authorized project — go straight to preparation.
          selectProject(projects[0])
          navigate('/preparation', { replace: true })
        } else if (total === 0) {
          setState({ status: 'empty' })
        } else {
          setState({ status: 'pick', total })
        }
      })
      .catch((e) => setState({ status: 'error', message: e.message }))
  }, [])

  function handlePick(p) {
    selectProject(p)
    navigate('/preparation')
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="page">
        <div className="container">
          {state.status === 'loading' && (
            <div className="center-col">
              <Logo size={52} />
              <div className="spinner lg" />
              <h2 className="page-title" style={{ fontSize: 20 }}>
                Loading your projects…
              </h2>
            </div>
          )}

          {state.status === 'error' && (
            <div className="center-col">
              <h2 className="page-title">Something went wrong</h2>
              <div className="notice error" style={{ maxWidth: 400 }}>
                {state.message}
              </div>
            </div>
          )}

          {state.status === 'empty' && (
            <div className="center-col">
              <Logo size={52} />
              <h2 className="page-title">No projects authorized</h2>
              <p className="muted" style={{ maxWidth: 360 }}>
                The sign-in didn’t grant access to any projects. Try signing in again and select a
                project during authorization.
              </p>
            </div>
          )}

          {state.status === 'pick' && (
            <ProjectPickerModal
              accessToken={accessToken}
              initialTotal={state.total}
              onPick={handlePick}
            />
          )}
        </div>
      </main>
    </div>
  )
}
