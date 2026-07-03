import { useEffect, useState } from 'react'
import { Blurhash } from 'react-blurhash'
import { getFileBytes, saveBlurhashRow } from '../lib/appwrite'
import { generateBlurhash } from '../lib/blurhash'
import { IconCheck, IconCopy, IconEye, IconImage, IconMore, IconSparkles, IconX } from './icons'

function prettySize(bytes) {
  if (!bytes && bytes !== 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default function FileThumb({ services, bucketId, file, row, onGenerated }) {
  const [busy, setBusy] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [error, setError] = useState('')
  const [originalUrl, setOriginalUrl] = useState(null)
  const [loadingOriginal, setLoadingOriginal] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const hash = row?.blurhash

  // Close the kebab menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  async function copy(text, label) {
    setMenuOpen(false)
    try {
      await navigator.clipboard.writeText(text)
      setToast(`${label} copied`)
    } catch {
      setToast('Copy failed')
    }
    setTimeout(() => setToast(''), 1200)
  }

  // Without a blurhash, eagerly load the original to show behind the card.
  useEffect(() => {
    if (hash) return
    let alive = true
    setLoadingOriginal(true)
    getFileBytes(services.storage, bucketId, file.$id)
      .then((bytes) => {
        if (!alive) return
        const blob = new Blob([bytes], { type: file.mimeType || 'image/*' })
        setOriginalUrl(URL.createObjectURL(blob))
      })
      .catch(() => {})
      .finally(() => alive && setLoadingOriginal(false))
    return () => {
      alive = false
    }
  }, [hash, bucketId, file.$id, services])

  // Revoke object URLs when they change / on unmount.
  useEffect(() => () => originalUrl && URL.revokeObjectURL(originalUrl), [originalUrl])

  async function handleGenerate() {
    setBusy(true)
    setError('')
    try {
      const bytes = await getFileBytes(services.storage, bucketId, file.$id)
      const result = await generateBlurhash(bytes, file.mimeType)
      await saveBlurhashRow(services.tablesDB, bucketId, file, result)
      onGenerated?.(file.$id, { ...result, fileId: file.$id, $id: file.$id })
    } catch (e) {
      setError(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  // Eye icon: swap the blurhash for the original image inline (lazy-loaded).
  async function togglePeek() {
    if (showOriginal) {
      setShowOriginal(false)
      return
    }
    if (!originalUrl) {
      setPeeking(true)
      try {
        const bytes = await getFileBytes(services.storage, bucketId, file.$id)
        const blob = new Blob([bytes], { type: file.mimeType || 'image/*' })
        setOriginalUrl(URL.createObjectURL(blob))
      } catch (e) {
        setError(e.message || 'Failed to load')
        setPeeking(false)
        return
      }
      setPeeking(false)
    }
    setShowOriginal(true)
  }

  return (
    <div className="file-card">
      <div className="file-thumb">
        {hash ? (
          <>
            <span className="badge ok thumb-badge">
              <IconCheck width={13} height={13} />
              Blurhash
            </span>
            {showOriginal && originalUrl ? (
              <img src={originalUrl} alt={file.name} />
            ) : (
              <Blurhash hash={hash} width="100%" height="100%" resolutionX={32} resolutionY={32} punch={1} />
            )}
            <button
              className="peek"
              onClick={togglePeek}
              title={showOriginal ? 'Show blurhash' : 'View original'}
              disabled={peeking}
            >
              {peeking ? <div className="spinner" style={{ width: 15, height: 15 }} /> : <IconEye width={16} height={16} />}
            </button>
          </>
        ) : (
          <>
            <span className="badge bad thumb-badge">
              <IconX width={13} height={13} />
              No blurhash
            </span>
            {originalUrl && <img src={originalUrl} alt={file.name} />}
            <div className={`empty ${originalUrl ? 'over-image' : ''}`}>
              {loadingOriginal && !originalUrl ? (
                <div className="spinner" style={{ width: 20, height: 20 }} />
              ) : (
                <>
                  {!originalUrl && <IconImage width={26} height={26} />}
                  <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={busy}>
                    {busy ? (
                      <div className="spinner on-brand" style={{ width: 15, height: 15 }} />
                    ) : (
                      <>
                        <IconSparkles width={15} height={15} />
                        Generate
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <button
          className="thumb-menu"
          title="More"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((o) => !o)
          }}
        >
          <IconMore width={16} height={16} />
        </button>
        {menuOpen && (
          <div className="menu" onClick={(e) => e.stopPropagation()}>
            <button className="menu-item" onClick={() => copy(file.$id, 'File ID')}>
              <IconCopy width={15} height={15} />
              Copy file ID
            </button>
            {hash && (
              <button className="menu-item" onClick={() => copy(hash, 'Blurhash')}>
                <IconCopy width={15} height={15} />
                Copy blurhash
              </button>
            )}
          </div>
        )}
        {toast && (
          <div className="copy-toast">
            <span>
              <IconCheck width={14} height={14} />
              {toast}
            </span>
          </div>
        )}
      </div>
      <div className="file-info">
        <b title={file.name}>{file.name}</b>
        <span>{prettySize(file.sizeOriginal)}</span>
        {error && (
          <span style={{ color: 'var(--danger)', display: 'block', marginTop: 2 }}>{error}</span>
        )}
      </div>
    </div>
  )
}
