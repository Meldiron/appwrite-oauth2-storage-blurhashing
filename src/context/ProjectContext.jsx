import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { makeServices, getProjectInfo } from '../lib/appwrite'
import { useAuth } from './AuthContext'

const ProjectContext = createContext(null)
const STORE_KEY = 'bh_project'

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
  } catch {
    return null
  }
}

export function ProjectProvider({ children }) {
  const { accessToken } = useAuth()
  const [project, setProjectState] = useState(loadStored)

  function selectProject(p) {
    // p: { $id, endpoint, name }
    const stored = { id: p.$id, endpoint: p.endpoint, name: p.name || p.$id }
    localStorage.setItem(STORE_KEY, JSON.stringify(stored))
    setProjectState(stored)
  }

  function clearProject() {
    localStorage.removeItem(STORE_KEY)
    setProjectState(null)
  }

  // Build authenticated SDK services for the active project.
  const services = useMemo(() => {
    if (!project?.id || !project?.endpoint || !accessToken) return null
    return makeServices({
      endpoint: project.endpoint,
      projectId: project.id,
      accessToken,
    })
  }, [project?.id, project?.endpoint, accessToken])

  // Resolve the real project name (the projects list only gives $id + endpoint).
  useEffect(() => {
    if (!services || !project?.id) return
    if (project.name && project.name !== project.id) return // already resolved
    let alive = true
    getProjectInfo(services.client)
      .then((info) => {
        if (!alive || !info?.name) return
        const updated = { ...project, name: info.name }
        localStorage.setItem(STORE_KEY, JSON.stringify(updated))
        setProjectState(updated)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, project?.id])

  const value = useMemo(
    () => ({ project, services, selectProject, clearProject }),
    [project, services],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
