import { Link } from 'react-router-dom'
import Logo from './Logo'
import { IconLogout } from './icons'
import { useAuth } from '../context/AuthContext'

export default function Header({ wide = false }) {
  const { isAuthed, signOut } = useAuth()
  return (
    <header className="header">
      <div className={`container ${wide ? 'container-wide' : ''}`}>
        <div className="header-inner">
          <Link to={isAuthed ? '/selection' : '/'} className="brand">
            <Logo size={30} />
            <span>
              Blurhash
              <small>for Appwrite Storage</small>
            </span>
          </Link>
          {isAuthed && (
            <button className="btn btn-soft" onClick={signOut} title="Sign out">
              <IconLogout width={16} height={16} />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
