import { useState } from 'react'
import Header from '../components/Header'
import AppwriteMark from '../components/AppwriteMark'
import { beginLogin } from '../lib/oauth'

export default function Home() {
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    try {
      await beginLogin()
    } catch (e) {
      setLoading(false)
      alert(e.message)
    }
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="page">
        <div className="container">
          <section className="hero">
            <div className="hero-art">
              <div className="blob" style={{ background: '#7b61ff', width: 180, height: 180, top: -30, left: -20 }} />
              <div className="blob" style={{ background: '#00c2e8', width: 170, height: 170, top: -20, right: -30 }} />
              <div className="blob" style={{ background: '#ffd15c', width: 200, height: 200, bottom: -60, right: 20 }} />
              <div className="blob" style={{ background: '#ff5c8a', width: 190, height: 190, bottom: -50, left: -30 }} />
              <div className="blob" style={{ background: '#2fe6a8', width: 120, height: 120, top: 60, left: '42%' }} />
              <div className="card-float">
                <span className="chip">✨ LQIP · instant placeholders</span>
              </div>
            </div>

            <span className="eyebrow">Storage add-on</span>
            <h1>
              Beautiful <span className="accent">blurry placeholders</span> for your Storage
            </h1>
            <p className="lead">
              Auto-generate BlurHash strings for every image in your Appwrite buckets — so your
              apps load with color, not grey boxes.
            </p>

            <div className="hero-cta">
              <button className="btn btn-appwrite btn-block" onClick={signIn} disabled={loading}>
                {loading ? (
                  <div className="spinner on-brand" />
                ) : (
                  <>
                    <AppwriteMark size={19} />
                    Sign in with Appwrite
                  </>
                )}
              </button>
            </div>

            <div className="feature-row">
              <div className="feature">
                <div className="emoji">🖼️</div>
                <b>No grey boxes</b>
                <span>Blur, not blank space</span>
              </div>
              <div className="feature">
                <div className="emoji">📦</div>
                <b>Ships in JSON</b>
                <span>One ~20-char string</span>
              </div>
              <div className="feature">
                <div className="emoji">⚡</div>
                <b>No extra fetch</b>
                <span>Decoded on device</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
