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

export default function ProjectPickerModal({ accessToken, initialTotal, onPick }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(initialTotal || 0)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [names, setNames] = useState({}) // projectId -> resolved name
  const debounceRef = useRef()

  // Fetch a page whenever offset or (debounced) search changes.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    listConsoleProjects(accessToken, { limit: LIMIT, offset, search })
      .then((res) => {
        if (!alive) return
        setProjects(res.projects)
        setTotal(res.total)
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [accessToken, offset, search])

  // The projects list only returns $id + endpoint. Resolve each project's real
  // name via Project.get() (client setProject'd to that id + its endpoint).
  useEffect(() => {
    let alive = true
    projects.forEach((p) => {
      if (names[p.$id]) return
      const { client } = makeServices({ endpoint: p.endpoint, projectId: p.$id, accessToken })
      getProjectInfo(client)
        .then((info) => {
          if (alive && info?.name) setNames((m) => ({ ...m, [p.$id]: info.name }))
        })
        .catch(() => {})
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, accessToken])

  function onSearchChange(v) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
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
            <div style={{ padding: '40px 0', display: 'grid', placeItems: 'center' }}>
              <div className="spinner" />
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-state">No projects match “{search}”.</div>
          ) : (
            projects.map((p) => (
              <button
                key={p.$id}
                className={`pick-item ${selected?.$id === p.$id ? 'selected' : ''}`}
                onClick={() => setSelected(p)}
              >
                <div className="pick-avatar" style={{ background: avatarColor(p.$id) }}>
                  {(names[p.$id] || p.name || p.$id).charAt(0).toUpperCase()}
                </div>
                <div className="meta">
                  <b>{names[p.$id] || p.name || p.$id}</b>
                  <span>{p.$id}</span>
                </div>
                {selected?.$id === p.$id && (
                  <span className="badge ok" style={{ flex: 'none' }}>
                    Selected
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="modal-foot">
          <div className="pager">
            <button
              className="btn btn-soft btn-icon"
              disabled={!canPrev}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            >
              <IconChevronLeft width={16} height={16} />
            </button>
            <span>
              Page {page} / {pageCount}
            </span>
            <button
              className="btn btn-soft btn-icon"
              disabled={!canNext}
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
