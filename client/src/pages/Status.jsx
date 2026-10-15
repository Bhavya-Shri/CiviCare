import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function Status() {
  const { token } = useParams()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const data = await api(`/api/incidents/status/${token}`)
        if (!stop) setStatus(data)
      } catch (err) {
        if (!stop) setError(err.message)
      }
    }
    load()
    const timer = setInterval(load, 8000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [token])

  return (
    <section className="card stack">
      <p className="eyebrow">Report reference</p>
      <h1>Status</h1>
      {error && <p className="error">{error}</p>}
      {!status && !error && <p>Checking the prototype record…</p>}
      {status && (
        <>
          <p className="pill">{status.status}</p>
          <p>{status.message}</p>
          <p>Reference <strong>{status.publicToken}</strong></p>
          <p>Category: {status.incidentType}. Role: {status.reporterRole}.</p>
          <a className="call-112" href="tel:112">Call 112</a>
        </>
      )}
    </section>
  )
}
