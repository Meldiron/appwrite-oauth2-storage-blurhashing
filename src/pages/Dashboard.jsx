import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import FileThumb from '../components/FileThumb'
import { IconSearch, IconSync, IconImage } from '../components/icons'
import { useProject } from '../context/ProjectContext'
import {
  listAllBuckets,
  listImageFiles,
  getBlurhashRows,
  getFileBytes,
  saveBlurhashRow,
} from '../lib/appwrite'
import { generateBlurhash } from '../lib/blurhash'

const CONCURRENCY = 4

// Run async workers over items with a bounded pool.
async function runPool(items, concurrency, worker) {
  const queue = [...items.entries()]
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const [index, item] = queue.shift()
      await worker(item, index)
    }
  })
  await Promise.all(workers)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { project, services } = useProject()

  const [buckets, setBuckets] = useState([])
  const [bucketsLoading, setBucketsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [bucketSearch, setBucketSearch] = useState('')

  const [active, setActive] = useState(null)
  const [files, setFiles] = useState([])
  const [rows, setRows] = useState({}) // fileId -> row
  const [filesLoading, setFilesLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [fileSearch, setFileSearch] = useState('')

  const [sync, setSync] = useState(null)
  const ran = useRef(false)

  // Load buckets on mount.
  useEffect(() => {
    if (!services) {
      navigate('/selection', { replace: true })
      return
    }
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const { buckets: all } = await listAllBuckets(services.storage)
        setBuckets(all)
        if (all[0]) setActive(all[0].$id)
      } catch (e) {
        setLoadError(e.message)
      } finally {
        setBucketsLoading(false)
      }
    })()
  }, [services])

  // Load files + rows whenever the active bucket changes.
  useEffect(() => {
    if (!active || !services) return
    let alive = true
    setFilesLoading(true)
    setFileError('')
    setFiles([])
    ;(async () => {
      try {
        const [imgs, rowMap] = await Promise.all([
          listImageFiles(services.storage, active),
          getBlurhashRows(services.tablesDB, active).catch(() => new Map()),
        ])
        if (!alive) return
        setFiles(imgs)
        setRows(Object.fromEntries(rowMap))
      } catch (e) {
        if (alive) setFileError(e.message)
      } finally {
        if (alive) setFilesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [active, services])

  const filteredBuckets = useMemo(() => {
    const q = bucketSearch.trim().toLowerCase()
    if (!q) return buckets
    return buckets.filter(
      (b) => (b.name || '').toLowerCase().includes(q) || b.$id.toLowerCase().includes(q),
    )
  }, [buckets, bucketSearch])

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => (f.name || '').toLowerCase().includes(q))
  }, [files, fileSearch])

  const withHash = files.filter((f) => rows[f.$id]?.blurhash).length
  const activeBucket = buckets.find((b) => b.$id === active)

  function onGenerated(fileId, data) {
    setRows((prev) => ({ ...prev, [fileId]: { ...(prev[fileId] || {}), ...data } }))
  }

  // ---- global synchronize ----
  async function synchronize() {
    setSync({ phase: 'scanning', running: true, scanned: 0, found: 0, done: 0, total: 0, created: 0, errors: 0 })
    try {
      // Pass 1 — scan every bucket for image files lacking a blurhash row.
      const worklist = []
      let scanned = 0
      for (const b of buckets) {
        let imgs = []
        let rowMap = new Map()
        try {
          imgs = await listImageFiles(services.storage, b.$id)
          rowMap = await getBlurhashRows(services.tablesDB, b.$id).catch(() => new Map())
        } catch {
          /* bucket without table / no access — skip */
        }
        for (const f of imgs) {
          if (!rowMap.get(f.$id)?.blurhash) worklist.push({ bucketId: b.$id, file: f })
        }
        scanned++
        setSync((s) => ({ ...s, scanned, found: worklist.length }))
      }

      // Pass 2 — generate + persist, with a bounded pool.
      setSync((s) => ({ ...s, phase: 'generating', total: worklist.length }))
      let created = 0
      let errors = 0
      const activeUpdates = {}
      await runPool(worklist, CONCURRENCY, async ({ bucketId, file }) => {
        try {
          const bytes = await getFileBytes(services.storage, bucketId, file.$id)
          const result = await generateBlurhash(bytes, file.mimeType)
          await saveBlurhashRow(services.tablesDB, bucketId, file, result)
          created++
          if (bucketId === active) activeUpdates[file.$id] = { ...result, fileId: file.$id, $id: file.$id }
        } catch {
          errors++
        }
        setSync((s) => ({ ...s, done: s.done + 1, created, errors }))
      })

      // Reflect new hashes for the currently open bucket.
      if (Object.keys(activeUpdates).length) {
        setRows((prev) => ({ ...prev, ...activeUpdates }))
      }
      setSync((s) => ({ ...s, phase: 'done', running: false }))
    } catch (e) {
      setSync((s) => ({ ...(s || {}), phase: 'error', running: false, message: e.message }))
    }
  }

  const pct = sync?.total ? Math.round((sync.done / sync.total) * 100) : sync?.phase === 'done' ? 100 : 0

  return (
    <div className="app-shell">
      <Header wide />
      <main className="page">
        <div className="container container-wide">
          <div className="stack" style={{ gap: 20 }}>
            <div className="row spread" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 className="page-title">{project?.name}</h1>
                <p className="page-sub">
                  {buckets.length} bucket{buckets.length === 1 ? '' : 's'} · Generate and browse
                  blurhashes.
                </p>
              </div>
            </div>

            {/* Sync panel */}
            <div className="sync-panel">
              <div className="row spread" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3>Synchronize blurhashes</h3>
                  <p>Scan every bucket, then generate a blurhash for each image without one.</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={synchronize}
                  disabled={sync?.running || bucketsLoading || buckets.length === 0}
                >
                  {sync?.running ? (
                    <div className="spinner on-brand" />
                  ) : (
                    <IconSync width={18} height={18} />
                  )}
                  {sync?.running ? 'Synchronizing…' : 'Synchronize'}
                </button>
              </div>

              {sync && (
                <>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="stat-grid">
                    <div className="stat">
                      <b>{sync.scanned}</b>
                      <span>Buckets scanned</span>
                    </div>
                    <div className="stat">
                      <b>{sync.phase === 'scanning' ? sync.found : sync.total}</b>
                      <span>Images to hash</span>
                    </div>
                    <div className="stat">
                      <b>{sync.created}</b>
                      <span>Hashes created</span>
                    </div>
                  </div>
                  <p style={{ marginTop: 12, position: 'relative', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    {sync.phase === 'scanning' && 'Scanning buckets…'}
                    {sync.phase === 'generating' && `Generating… ${sync.done}/${sync.total}`}
                    {sync.phase === 'done' &&
                      `✓ Done — ${sync.created} created${sync.errors ? `, ${sync.errors} failed` : ''}.`}
                    {sync.phase === 'error' && `Error: ${sync.message}`}
                  </p>
                </>
              )}
            </div>

            {/* Viewer */}
            {loadError ? (
              <div className="notice error">{loadError}</div>
            ) : bucketsLoading ? (
              <div className="center-col" style={{ minHeight: 200 }}>
                <div className="spinner lg" />
              </div>
            ) : buckets.length === 0 ? (
              <div className="empty-state">No buckets in this project yet.</div>
            ) : (
              <>
                {/* Bucket picker */}
                <div className="card card-pad">
                  <div className="section-label">Buckets</div>
                  <div className="search" style={{ marginTop: 0, marginBottom: 12 }}>
                    <IconSearch width={17} height={17} />
                    <input
                      placeholder="Search buckets…"
                      value={bucketSearch}
                      onChange={(e) => setBucketSearch(e.target.value)}
                    />
                  </div>
                  <div className="bucket-scroll">
                    {filteredBuckets.map((b) => (
                      <button
                        key={b.$id}
                        className={`bucket-chip ${active === b.$id ? 'active' : ''}`}
                        onClick={() => setActive(b.$id)}
                      >
                        {b.name || b.$id}
                      </button>
                    ))}
                    {filteredBuckets.length === 0 && (
                      <span className="muted" style={{ fontSize: 13 }}>
                        No buckets match.
                      </span>
                    )}
                  </div>
                </div>

                {/* Files */}
                <div className="card card-pad">
                  <div className="row spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.01em' }}>
                        {activeBucket?.name || active}
                        {!filesLoading && (
                          <span className="muted" style={{ fontWeight: 500, fontSize: 12.5 }}>
                            {' '}· {withHash}/{files.length} hashed
                          </span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{active}</div>
                    </div>
                    <div className="search" style={{ margin: 0, minWidth: 220, flex: 1, maxWidth: 320 }}>
                      <IconSearch width={17} height={17} />
                      <input
                        placeholder="Search files…"
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {fileError ? (
                    <div className="notice error">{fileError}</div>
                  ) : filesLoading ? (
                    <div className="center-col" style={{ minHeight: 180 }}>
                      <div className="spinner" />
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="empty-state">
                      <IconImage width={30} height={30} />
                      <p style={{ marginTop: 8 }}>
                        {files.length === 0 ? 'No images in this bucket.' : 'No files match your search.'}
                      </p>
                    </div>
                  ) : (
                    <div className="file-grid">
                      {filteredFiles.map((f) => (
                        <FileThumb
                          key={f.$id}
                          services={services}
                          bucketId={active}
                          file={f}
                          row={rows[f.$id]}
                          onGenerated={onGenerated}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
