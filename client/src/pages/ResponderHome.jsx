import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function ResponderHome() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [skillCode, setSkillCode] = useState('first_aid')
  const [issuerLabel, setIssuerLabel] = useState('Community training record')

  async function load() {
    const next = await api('/api/responders/me')
    setData(next)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function setAvailable(available) {
    setError('')
    try {
      const result = await api('/api/responders/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({ available }),
      })
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function respond(id, status) {
    setError('')
    try {
      const result = await api(`/api/assignments/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      })
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitCert(event) {
    event.preventDefault()
    setError('')
    try {
      const result = await api('/api/responders/me/certifications', {
        method: 'POST',
        body: JSON.stringify({ skillCode, issuerLabel }),
      })
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data) return <p>{error || 'Loading profile…'}</p>

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">{data.responder.zoneName}</p>
        <h1>{data.responder.displayName}</h1>
        <p>Profile status: {data.responder.status}. Offers here are simulated.</p>
      </div>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}
      <div className="actions">
        <button className="primary" type="button" onClick={() => setAvailable(true)}>I am available now</button>
        <button className="ghost" type="button" onClick={() => setAvailable(false)}>I am unavailable</button>
      </div>
      <div className="grid two">
        <article className="card">
          <h2>Offers</h2>
          {!data.offers.length && <p>No simulated offers yet.</p>}
          {data.offers.map((offer) => (
            <div key={offer.assignment_id}>
              <p><strong>{offer.incident_type}</strong> · {offer.status}</p>
              <div className="actions">
                {offer.status === 'offered' && <button className="primary" type="button" onClick={() => respond(offer.assignment_id, 'accepted')}>Accept</button>}
                {offer.status === 'offered' && <button className="ghost" type="button" onClick={() => respond(offer.assignment_id, 'declined')}>Decline</button>}
                {offer.status === 'accepted' && <button className="secondary" type="button" onClick={() => respond(offer.assignment_id, 'en_route')}>Mark en route (simulated)</button>}
                {offer.status === 'en_route' && <button className="secondary" type="button" onClick={() => respond(offer.assignment_id, 'arrived')}>Mark arrived (simulated)</button>}
                {offer.status === 'arrived' && <button className="secondary" type="button" onClick={() => respond(offer.assignment_id, 'completed')}>Mark completed (simulated)</button>}
              </div>
            </div>
          ))}
        </article>
        <article className="card">
          <h2>Certifications</h2>
          <ul>
            {data.certifications.map((cert) => (
              <li key={cert.certification_id}>{cert.skill_name}: {cert.verified_status}</li>
            ))}
          </ul>
          <form onSubmit={submitCert}>
            <label>Skill code<input value={skillCode} onChange={(event) => setSkillCode(event.target.value)} /></label>
            <label>Issuer label<input value={issuerLabel} onChange={(event) => setIssuerLabel(event.target.value)} /></label>
            <button className="ghost" type="submit">Submit for review</button>
          </form>
        </article>
      </div>
    </section>
  )
}
