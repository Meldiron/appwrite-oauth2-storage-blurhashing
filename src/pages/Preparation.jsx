import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import ProgressCard from '../components/ProgressCard'
import { IconDatabase, IconLayers, IconArrowRight } from '../components/icons'
import { useProject } from '../context/ProjectContext'
import {
  getBlurhashDatabase,
  createBlurhashDatabase,
  listAllBuckets,
  existingTableIds,
  createBlurhashTable,
  BUCKET_HARD_CAP,
} from '../lib/appwrite'

export const SKIP_KEY = 'bh_skip_prep'

function isNotFound(e) {
  return e?.code === 404 || /not.?found/i.test(e?.type || '') || /not found/i.test(e?.message || '')
}

export default function Preparation() {
  const navigate = useNavigate()
  const { project, services } = useProject()

  const [db, setDb] = useState('checking') // checking|done|missing|creating|error
  const [dbErr, setDbErr] = useState('')

  const [tables, setTables] = useState('idle') // idle|checking|done|missing|creating|error
  const [tablesErr, setTablesErr] = useState('')
  const [buckets, setBuckets] = useState([])
  const [missing, setMissing] = useState([])
  const [capped, setCapped] = useState(false)
  const [createProgress, setCreateProgress] = useState(null)

  const [dontShow, setDontShow] = useState(() => localStorage.getItem(SKIP_KEY) === '1')
  const ran = useRef(false)

  useEffect(() => {
    if (!services) {
      navigate('/selection', { replace: true })
      return
    }
    if (ran.current) return
    ran.current = true
    // Honor the "Don't show this again" preference.
    if (localStorage.getItem(SKIP_KEY) === '1') {
      navigate('/dashboard', { replace: true })
      return
    }
    runDbCheck()
  }, [services])

  async function runDbCheck() {
    setDb('checking')
    setDbErr('')
    try {
      await getBlurhashDatabase(services.tablesDB)
      setDb('done')
      runTablesCheck()
    } catch (e) {
      if (isNotFound(e)) setDb('missing')
      else {
        setDb('error')
        setDbErr(e.message)
      }
    }
  }

  async function handleCreateDb() {
    setDb('creating')
    setDbErr('')
    try {
      await createBlurhashDatabase(services.tablesDB)
      setDb('done')
      runTablesCheck()
    } catch (e) {
      setDb('error')
      setDbErr(e.message)
    }
  }

  async function runTablesCheck() {
    setTables('checking')
    setTablesErr('')
    try {
      const { buckets: all, capped: isCapped } = await listAllBuckets(services.storage)
      setBuckets(all)
      setCapped(isCapped)
      const ids = all.map((b) => b.$id)
      const found = ids.length ? await existingTableIds(services.tablesDB, ids) : new Set()
      const miss = ids.filter((id) => !found.has(id))
      setMissing(miss)
      setTables(miss.length === 0 ? 'done' : 'missing')
    } catch (e) {
      setTables('error')
      setTablesErr(e.message)
    }
  }

  async function handleCreateTables() {
    setTables('creating')
    setTablesErr('')
    const bucketById = new Map(buckets.map((b) => [b.$id, b]))
    let done = 0
    try {
      for (const id of missing) {
        const b = bucketById.get(id)
        await createBlurhashTable(services.tablesDB, id, b?.name)
        done++
        setCreateProgress({ done, total: missing.length })
      }
      setMissing([])
      setCreateProgress(null)
      setTables('done')
    } catch (e) {
      setTables('error')
      setTablesErr(`Created ${done}/${missing.length}. ${e.message}`)
    }
  }

  function handleContinue() {
    if (dontShow) localStorage.setItem(SKIP_KEY, '1')
    else localStorage.removeItem(SKIP_KEY)
    navigate('/dashboard')
  }

  const allReady = db === 'done' && tables === 'done'

  // ---- card status mapping ----
  const dbCardStatus =
    db === 'done' ? 'done' : db === 'error' ? 'error' : db === 'checking' || db === 'creating' ? 'working' : 'warn'

  const tablesCardStatus =
    tables === 'done'
      ? 'done'
      : tables === 'error'
      ? 'error'
      : tables === 'checking' || tables === 'creating'
      ? 'working'
      : tables === 'idle'
      ? 'pending'
      : 'warn'

  return (
    <div className="app-shell">
      <Header />
      <main className="page">
        <div className="container">
          <div className="stack">
            <div>
              <h1 className="page-title">Prepare {project?.name}</h1>
              <p className="page-sub">
                We’ll set up a <code>blurhashes</code> database and a table per bucket to store your
                generated hashes.
              </p>
            </div>

            {/* Database card */}
            <ProgressCard
              status={dbCardStatus}
              icon={<IconDatabase width={20} height={20} />}
              title="Blurhashes database"
              description={
                db === 'checking'
                  ? 'Checking whether the “blurhashes” database exists…'
                  : db === 'done'
                  ? 'The “blurhashes” database is ready.'
                  : db === 'missing'
                  ? 'No “blurhashes” database yet. Create it to continue.'
                  : db === 'creating'
                  ? 'Creating the database…'
                  : 'Could not check the database.'
              }
            >
              {db === 'done' && <span className="badge ok">Ready</span>}
              {db === 'missing' && (
                <button className="btn btn-primary btn-sm" onClick={handleCreateDb}>
                  Create database
                </button>
              )}
              {db === 'error' && (
                <div className="stack">
                  <div className="notice error">{dbErr}</div>
                  <button className="btn btn-ghost btn-sm" onClick={runDbCheck}>
                    Retry
                  </button>
                </div>
              )}
            </ProgressCard>

            {/* Tables card */}
            <ProgressCard
              status={tablesCardStatus}
              icon={<IconLayers width={20} height={20} />}
              title="Per-bucket tables"
              description={
                tables === 'idle'
                  ? 'Waiting for the database…'
                  : tables === 'checking'
                  ? 'Listing buckets and matching tables…'
                  : tables === 'done'
                  ? `All ${buckets.length} bucket${buckets.length === 1 ? '' : 's'} have a table.`
                  : tables === 'creating'
                  ? `Creating tables… ${createProgress ? `${createProgress.done}/${createProgress.total}` : ''}`
                  : tables === 'error'
                  ? 'Could not check tables.'
                  : `${missing.length} of ${buckets.length} bucket${
                      buckets.length === 1 ? '' : 's'
                    } are missing a table.`
              }
            >
              {capped && (
                <div className="notice" style={{ marginBottom: 12 }}>
                  <span>⚠️</span>
                  <span>
                    You have more than {BUCKET_HARD_CAP} buckets. Only the first {BUCKET_HARD_CAP}{' '}
                    are processed here.
                  </span>
                </div>
              )}
              {tables === 'done' && <span className="badge ok">All synced</span>}
              {tables === 'missing' && (
                <button className="btn btn-primary btn-sm" onClick={handleCreateTables}>
                  Auto-create {missing.length} table{missing.length === 1 ? '' : 's'}
                </button>
              )}
              {tables === 'error' && (
                <div className="stack">
                  <div className="notice error">{tablesErr}</div>
                  <button className="btn btn-ghost btn-sm" onClick={runTablesCheck}>
                    Retry
                  </button>
                </div>
              )}
            </ProgressCard>

            {/* Continue */}
            <div className="card card-pad">
              <div className="row spread" style={{ flexWrap: 'wrap', gap: 16 }}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={dontShow}
                    onChange={(e) => setDontShow(e.target.checked)}
                  />
                  Don’t show this again
                </label>
                <button className="btn btn-primary" disabled={!allReady} onClick={handleContinue}>
                  Continue to dashboard
                  <IconArrowRight width={17} height={17} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
