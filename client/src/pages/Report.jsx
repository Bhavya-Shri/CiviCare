import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import MapView from '../components/MapView.jsx'

export default function Report() {
  const location = useLocation()
  const navigate = useNavigate()
  const [meta, setMeta] = useState(null)
  const [form, setForm] = useState({
    reporterRole: location.state?.reporterRole || 'self',
    incidentType: 'medical',
    lat: 13.0827,
    lng: 80.2707,
    locationPrecision: 'map_pin',
    affectedCount: '',
    accessNote: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/meta').then(setMeta).catch((err) => setError(err.message))
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function useDeviceLocation() {
    if (!navigator.geolocation) {
      setError('This browser cannot share location. Drop a pin on the map instead.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update('lat', Number(position.coords.latitude.toFixed(5)))
        update('lng', Number(position.coords.longitude.toFixed(5)))
        update('locationPrecision', 'device')
      },
      () => setError('Location was blocked. Drop a pin on the map instead.'),
    )
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/incidents', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          lat: Number(form.lat),
          lng: Number(form.lng),
          affectedCount: form.affectedCount === '' ? null : Number(form.affectedCount),
          accessNote: form.accessNote || null,
        }),
      })
      navigate(`/status/${result.publicToken}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div>
        <p className="eyebrow">Guest report</p>
        <h1>Tell the prototype what happened</h1>
        <p className="lede">Call 112 if this is urgent. Submitting this form only stores a simulated report.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="split">
        <div className="card">
          <label>
            Who is reporting?
            <select value={form.reporterRole} onChange={(event) => update('reporterRole', event.target.value)}>
              <option value="self">I need help</option>
              <option value="bystander">I am helping someone</option>
            </select>
          </label>
          <label>
            Category
            <select value={form.incidentType} onChange={(event) => update('incidentType', event.target.value)}>
              {meta && Object.entries(meta.incidentTypes).map(([code, item]) => (
                <option key={code} value={code}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            People affected, if known
            <input value={form.affectedCount} inputMode="numeric" onChange={(event) => update('affectedCount', event.target.value)} />
          </label>
          <label>
            Access note
            <textarea rows="3" maxLength="280" value={form.accessNote} onChange={(event) => update('accessNote', event.target.value)} placeholder="Gate, floor, or landmark. No names." />
          </label>
          <p>Pin: {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</p>
          <div className="actions">
            <button className="ghost" type="button" onClick={useDeviceLocation}>Use my location</button>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Store report'}</button>
          </div>
        </div>
        <div>
          <div className="map-frame">
            <MapView
              center={[form.lat, form.lng]}
              markers={[{ id: 'pin', lat: Number(form.lat), lng: Number(form.lng), label: 'Report location' }]}
              onPick={(point) => {
                update('lat', Number(point.lat.toFixed(5)))
                update('lng', Number(point.lng.toFixed(5)))
                update('locationPrecision', 'map_pin')
              }}
            />
          </div>
          <p className="notice">Click the map to move the pin. A pin outside the project zones can still be stored; allocation may then find nobody eligible.</p>
        </div>
      </div>
    </form>
  )
}
