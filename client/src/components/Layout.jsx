import { Link, NavLink } from 'react-router-dom'

export default function Layout({ session, onSignOut, children }) {
  return (
    <div className="app-shell">
      <div className="safety-strip">
        <span>Emergency? Do not wait for this prototype.</span>
        <a className="call-112" href="tel:112">Call 112</a>
      </div>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">CiviCare</span>
          <span className="brand-tag">Prepared communities. Coordinated care.</span>
        </Link>
        <nav>
          <NavLink to="/report">Report</NavLink>
          <NavLink to="/facilities">Facilities</NavLink>
          {session?.user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          {session?.user?.role === 'admin' && <NavLink to="/readiness">Readiness</NavLink>}
          {session?.user?.role === 'admin' && <NavLink to="/experiments">Experiments</NavLink>}
          {session?.user?.role === 'responder' && <NavLink to="/responder">My shifts</NavLink>}
          {session ? (
            <button type="button" className="text-button" onClick={onSignOut}>Sign out</button>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <p>CiviCare is an academic prototype for community readiness research. It does not dispatch help, replace 112, or show live hospital capacity.</p>
        <p>Map tiles © OpenStreetMap contributors.</p>
      </footer>
    </div>
  )
}
