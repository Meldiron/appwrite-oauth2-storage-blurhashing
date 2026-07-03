import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getStoredAuth, clearAuth, fetchUserInfo } from '../lib/oauth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth())
  const [user, setUser] = useState(null)

  useEffect(() => {
    let alive = true
    if (auth?.accessToken) {
      fetchUserInfo(auth.accessToken)
        .then((u) => alive && setUser(u))
        .catch(() => {})
    } else {
      setUser(null)
    }
    return () => {
      alive = false
    }
  }, [auth?.accessToken])

  function signOut() {
    clearAuth()
    setAuth(null)
    setUser(null)
    window.location.assign('/')
  }

  const value = useMemo(
    () => ({
      auth,
      accessToken: auth?.accessToken || null,
      isAuthed: !!auth?.accessToken,
      user,
      refreshAuth: () => setAuth(getStoredAuth()),
      signOut,
    }),
    [auth, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
