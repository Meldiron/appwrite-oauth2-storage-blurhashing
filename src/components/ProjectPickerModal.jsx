import { useEffect, useRef, useState } from 'react'
import { listConsoleProjects, makeServices, getProjectInfo } from '../lib/appwrite'
import { IconSearch, IconChevronLeft, IconChevronRight } from './icons'

const LIMIT = 6
const PALETTE = ['#00c2e8', '#7b61ff', '#fd366e', '#12b981', '#f59e0b', '#ff5c8a']

function avatarColor(id = '') {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return PALETTE[sum % PALETTE.length]
}

function RowSkeleton() {
  return (
    <div className="pick-item skeleton" aria-hidden="true">
      <div className="pick-avatar skel" />
      <div className="meta">
        <div className="skel" style={{ height: 13, width: '52%', marginBottom: 8 }} />
        <div className="skel" style={{ height: 10, width: '78%' }} />
      </div>
    </div>
  )
}

export default function ProjectPickerModal({ accessToken, initialTotal, onPick }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(initialTotal || 0)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [names, setNames] = useState({}) // projectId -> resolved name (id string on failure; undefined = still loading)
  const debounceRef = useRef()
  const reqRef = useRef(0) // guards against out-of-order page responses

  // Fetch a page whenever offset or (debounced) search changes.
  useEffect(() => {
    const reqId = ++reqRef.current
    setLoading(true)
    setError('')
    listConsoleProjects(accessToken, { limit: LIMIT, offset, search })
      .then((res) => {
        if (reqId !== reqRef.current) return // a newer request superseded this one
        setProjects(res.projects)
        setTotal(res.total)
      })
      .catch((e) => {
        if (reqId === reqRef.current) setError(e.message)
      })
      .finally(() => {
        if (reqId === reqRef.current) setLoading(false)
      })
  }, [accessToken, offset, search])

  // The projects list only returns $id + endpoint. Resolve each project's real
  // name via Project.get(). Store the id as a fallback on failure so a row never
  // stays in the skeleton state forever.
  useEffect(() => {
    let alive = true
    projects.forEach((p) => {
      if (p.$id in names) return // already resolved or attempted
      const { client } = makeServices({ endpoint: p.endpoint, projectId: p.$id, accessToken })
      getProjectInfo(client)
        .then((info) => {
          if (alive) setNames((m) => ({ ...m, [p.$id]: info?.name || p.$id }))
        })
        .catch(() => {
          if (alive) setNames((m) => ({ ...m, [p.$id]: p.$id }))
        })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, accessToken])

  function onSearchChange(v) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSelected(null) // selection from a previous filter is no longer relevant
      setOffset(0)
      setSearch(v)
    }, 320)
  }

  const page = Math.floor(offset / LIMIT) + 1
  const pageCount = Math.max(1, Math.ceil(total / LIMIT))
  const canPrev = offset > 0
  const canNext = offset + LIMIT < total

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="page-title" style={{ fontSize: 20 }}>
            Choose a project
          </h2>
          <p className="page-sub" style={{ marginTop: 4 }}>
            {total} project{total === 1 ? '' : 's'} authorized. Pick the one to add blurhashes to.
          </p>
          <div className="search">
            <IconSearch width={17} height={17} />
            <input
              type="text"
              placeholder="Search projects…"
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="modal-body">
          {error && <div className="notice error" style={{ margin: '8px 0' }}>{error}</div>}

          {loading ? (
            Array.from({ length: LIMIT }).map((_, i) => <RowSkeleton key={i} />)
          ) : projects.length === 0 ? (
            <div className="empty-state">
              {search ? `No projects match “${search}”.` : 'No projects found.'}
            </div>
          ) : (
            projects.map((p) => {
              const name = names[p.$id]
              const resolving = name === undefined
              const label = name || p.$id
              return (
                <button
                  key={p.$id}
                  className={`pick-item ${selected?.$id === p.$id ? 'selected' : ''}`}
                  onClick={() => setSelected(p)}
                >
                  <div className="pick-avatar" style={{ background: avatarColor(p.$id) }}>
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div className="meta">
                    {resolving ? (
                      <div className="skel" style={{ height: 14, width: '58%', margin: '1px 0 6px' }} />
                    ) : (
                      <b>{label}</b>
                    )}
                    <span>{p.$id}</span>
                  </div>
                  {selected?.$id === p.$id && (
                    <span className="badge ok" style={{ flex: 'none' }}>
                      Selected
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="modal-foot">
          <div className="pager">
            <button
              className="btn btn-soft btn-icon"
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            >
              <IconChevronLeft width={16} height={16} />
            </button>
            <span>
              Page {page} / {pageCount}
            </span>
            <button
              className="btn btn-soft btn-icon"
              disabled={!canNext || loading}
              onClick={() => setOffset(offset + LIMIT)}
            >
              <IconChevronRight width={16} height={16} />
            </button>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={!selected}
            onClick={() => onPick({ ...selected, name: names[selected.$id] || selected.name || selected.$id })}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
