import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { api } from '../api.js'
import MapView from '../components/MapView.jsx'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

export default function Readiness() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/dashboard/readiness').then(setData).catch((err) => setError(err.message))
  }, [])

  if (!data) return <p>{error || 'Loading readiness…'}</p>

  const bls = data.zones.map((zone) => ({
    name: zone.name,
    count: zone.skills.find((skill) => skill.code === 'basic_life_support')?.eligibleCount || 0,
    lat: zone.lat,
    lng: zone.lng,
  }))

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Area view</p>
        <h1>Readiness</h1>
        <p className="lede">{data.freshness} A zone with 0 or 1 eligible responder for a skill is marked low coverage. Counts are simulated.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <Bar
          data={{
            labels: bls.map((zone) => zone.name),
            datasets: [{
              label: 'Eligible basic life support',
              data: bls.map((zone) => zone.count),
              backgroundColor: bls.map((zone) => (zone.count <= 1 ? '#b64024' : '#0d6a5c')),
            }],
          }}
          options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
        />
      </div>
      <div className="map-frame">
        <MapView
          height={420}
          circles={bls.map((zone) => ({
            id: zone.name,
            lat: zone.lat,
            lng: zone.lng,
            color: zone.count <= 1 ? '#b64024' : '#0d6a5c',
          }))}
        />
      </div>
      <div className="grid three">
        {data.zones.map((zone) => {
          const focus = zone.skills.find((skill) => skill.code === 'basic_life_support')
          return (
            <article className="card" key={zone.code}>
              <h3>{zone.name}</h3>
              <p className="metric">{focus?.eligibleCount ?? 0}</p>
              <p>Eligible for basic life support now.</p>
              {focus && focus.eligibleCount <= 1 && <p className="pill">Low coverage</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
