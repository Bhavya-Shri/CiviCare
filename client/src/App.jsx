import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { loadSession, saveSession } from './api.js'
import Layout from './components/Layout.jsx'
import Landing from './pages/Landing.jsx'
import Report from './pages/Report.jsx'
import Status from './pages/Status.jsx'
import Facilities from './pages/Facilities.jsx'
import Auth from './pages/Auth.jsx'
import ResponderHome from './pages/ResponderHome.jsx'
import Admin from './pages/Admin.jsx'
import Readiness from './pages/Readiness.jsx'
import Experiments from './pages/Experiments.jsx'

export default function App() {
  const [session, setSession] = useState(loadSession)

  function updateSession(next) {
    saveSession(next)
    setSession(next)
  }

  const authed = (element, role) => {
    if (!session?.token) return <Navigate to="/login" replace />
    if (role && session.user?.role !== role) return <Navigate to="/" replace />
    return element
  }

  return (
    <Layout session={session} onSignOut={() => updateSession(null)}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/report" element={<Report />} />
        <Route path="/status/:token" element={<Status />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/login" element={<Auth mode="login" onSession={updateSession} />} />
        <Route path="/register" element={<Auth mode="register" onSession={updateSession} />} />
        <Route path="/responder" element={authed(<ResponderHome />, 'responder')} />
        <Route path="/admin" element={authed(<Admin />, 'admin')} />
        <Route path="/readiness" element={authed(<Readiness />, 'admin')} />
        <Route path="/experiments" element={authed(<Experiments />, 'admin')} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
