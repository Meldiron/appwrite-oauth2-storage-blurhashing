import { IconCheck } from './icons'

const STATUS_ICON = {
  done: <IconCheck width={20} height={20} />,
  warn: '!',
  error: '×',
}

export default function ProgressCard({ status = 'pending', icon, title, description, children }) {
  return (
    <div className="card prep-card">
      <div className={`status-dot ${status}`}>
        {status === 'working' ? (
          <div className="spinner" style={{ width: 20, height: 20 }} />
        ) : (
          STATUS_ICON[status] || icon
        )}
      </div>
      <div className="prep-body">
        <div className="row spread">
          <h3>{title}</h3>
        </div>
        {description && <p>{description}</p>}
        {children && <div style={{ marginTop: 14 }}>{children}</div>}
      </div>
    </div>
  )
}
