import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Admin() {
  const [incidents, setIncidents] = useState([])
  const [certs, setCerts] = useState([])
  const [responders, setResponders] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const [incidentData, certData, responderData] = await Promise.all([
      api('/api/admin/incidents'),
      api('/api/admin/certifications'),
      api('/api/admin/responders'),
    ])
    setIncidents(incidentData.incidents)
    setCerts(certData.certifications)
    setResponders(responderData.responders)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function allocate(id, policy) {
    setError('')
    try {
      const result = await api(`/api/admin/incidents/${id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ policy }),
      })
      setMessage(result.message + (result.selected ? ` Selected ${result.selected.displayName}.` : ''))
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function reviewCert(id, verifiedStatus) {
    setError('')
    try {
      const result = await api(`/api/admin/certifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ verifiedStatus }),
      })
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function reviewResponder(id, responderStatus) {
    setError('')
    try {
      await api(`/api/admin/responders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ responderStatus }),
      })
      setMessage(`Responder marked ${responderStatus}.`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Verifier</p>
        <h1>Admin desk</h1>
        <p>Allocation here is committed as a simulated offer. For a side-by-side comparison that rolls back, use <Link to="/experiments">Experiments</Link>.</p>
      </div>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}
      <article className="card">
        <h2>Reports</h2>
        <table>
          <thead>
            <tr><th>Reference</th><th>Type</th><th>Status</th><th>Scenario</th><th></th></tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.incident_id}>
                <td>{incident.public_token}</td>
                <td>{incident.incident_type}</td>
                <td>{incident.status}</td>
                <td>{incident.scenario_code || '—'}</td>
                <td>
                  {incident.status === 'pending' && (
                    <div className="actions">
                      <button className="ghost" type="button" onClick={() => allocate(incident.incident_id, 'nearest_eligible')}>Nearest</button>
                      <button className="primary" type="button" onClick={() => allocate(incident.incident_id, 'coverage_aware')}>Coverage</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <div className="grid two">
        <article className="card">
          <h2>Pending certifications</h2>
          {!certs.length && <p>None waiting.</p>}
          {certs.map((cert) => (
            <div key={cert.certification_id}>
              <p>{cert.display_name} · {cert.skill_name}</p>
              <div className="actions">
                <button className="primary" type="button" onClick={() => reviewCert(cert.certification_id, 'verified')}>Verify</button>
                <button className="ghost" type="button" onClick={() => reviewCert(cert.certification_id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </article>
        <article className="card">
          <h2>Pending profiles</h2>
          {!responders.length && <p>None waiting.</p>}
          {responders.map((responder) => (
            <div key={responder.responder_id}>
              <p>{responder.display_name} · {responder.zone_name}</p>
              <div className="actions">
                <button className="primary" type="button" onClick={() => reviewResponder(responder.responder_id, 'approved')}>Approve profile</button>
                <button className="ghost" type="button" onClick={() => reviewResponder(responder.responder_id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </article>
      </div>
    </section>
  )
}
