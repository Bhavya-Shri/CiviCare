import { useEffect, useState } from 'react'
import { api } from '../api.js'
import MapView from '../components/MapView.jsx'

export default function Facilities() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/facilities').then(setData).catch((err) => setError(err.message))
  }, [])

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Directory</p>
        <h1>Facilities</h1>
        <p className="lede">These pins are approximate samples for the prototype map. A pin does not mean a facility can accept a patient now.</p>
      </div>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <p className="notice">{data.caveat}</p>
          <div className="map-frame">
            <MapView
              height={420}
              markers={data.facilities.map((facility) => ({
                id: facility.name,
                lat: facility.lat,
                lng: facility.lng,
                label: `${facility.name}. ${facility.address}`,
              }))}
            />
          </div>
          <div className="grid two">
            {data.facilities.map((facility) => (
              <article className="card" key={facility.name}>
                <h3>{facility.name}</h3>
                <p>{facility.address}</p>
                <p>{facility.capabilities?.[0]?.note || 'No verified capability is listed.'}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
