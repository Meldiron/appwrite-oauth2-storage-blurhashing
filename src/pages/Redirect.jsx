import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { completeLogin } from '../lib/oauth'
import { useAuth } from '../context/AuthContext'

export default function Redirect() {
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // guard StrictMode double-invoke
    ran.current = true

    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) {
      setError(params.get('error_description') || err)
      return
    }

    completeLogin({ code: params.get('code'), state: params.get('state') })
      .then(() => {
        refreshAuth()
        navigate('/selection', { replace: true })
      })
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="app-shell">
      <main className="page">
        <div className="container">
          <div className="center-col">
            <Logo size={56} />
            {error ? (
              <>
                <h2 className="page-title">Sign-in failed</h2>
                <div className="notice error" style={{ maxWidth: 380 }}>
                  {error}
                </div>
                <button className="btn btn-ghost" onClick={() => navigate('/', { replace: true })}>
                  Back to start
                </button>
              </>
            ) : (
              <>
                <div className="spinner lg" />
                <h2 className="page-title" style={{ fontSize: 20 }}>
                  Completing sign-in…
                </h2>
                <p className="muted">Exchanging your authorization code.</p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
