import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { api } from '../api.js'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

function km(metres) {
  if (metres == null) return '—'
  return `${(metres / 1000).toFixed(2)} km`
}

export default function Experiments() {
  const [meta, setMeta] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/meta').then(setMeta).catch((err) => setError(err.message))
  }, [])

  async function run(scenario) {
    setBusy(true)
    setError('')
    try {
      setResult(await api('/api/experiments/compare', {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const nearest = result?.policies?.nearest_eligible
  const coverage = result?.policies?.coverage_aware

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">Same incidents, two rules</p>
        <h1>Experiments</h1>
        <p className="lede">Each run uses the seeded scenario, then rolls the assignments back. Distance is a straight-line proxy. A higher coverage score is not a clinical win.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {meta?.scenarios?.map((scenario) => (
          <button key={scenario.id} className="ghost" type="button" disabled={busy} onClick={() => run(scenario.id)}>
            {scenario.label}
          </button>
        ))}
      </div>
      {result && (
        <>
          <article className="notice">
            <strong>{result.label}.</strong> {result.summary} {result.note}
          </article>
          <div className="grid two">
            <PolicyCard title="Nearest eligible" outcome={nearest} />
            <PolicyCard title="Coverage-aware" outcome={coverage} />
          </div>
          <div className="card">
            <Bar
              data={{
                labels: ['Mean distance (m)', 'Low-coverage zones', 'Assigned'],
                datasets: [
                  {
                    label: 'Nearest',
                    data: [nearest.metrics.meanDistanceM || 0, nearest.metrics.lowCoverageZones, nearest.metrics.assigned],
                    backgroundColor: '#1a2433',
                  },
                  {
                    label: 'Coverage-aware',
                    data: [coverage.metrics.meanDistanceM || 0, coverage.metrics.lowCoverageZones, coverage.metrics.assigned],
                    backgroundColor: '#0d6a5c',
                  },
                ],
              }}
            />
          </div>
          <article className="card">
            <h2>Decision detail</h2>
            {result.policies.nearest_eligible.decisions.map((decision, index) => (
              <DecisionBlock
                key={decision.incidentId}
                nearest={decision}
                coverage={result.policies.coverage_aware.decisions[index]}
              />
            ))}
          </article>
        </>
      )}
    </section>
  )
}

function PolicyCard({ title, outcome }) {
  const selected = outcome.decisions.map((decision) => decision.selected?.displayName || 'none').join(', ')
  return (
    <article className="card">
      <h2>{title}</h2>
      <p>Selected: <strong>{selected}</strong></p>
      <p>Mean distance: {km(outcome.metrics.meanDistanceM)}</p>
      <p>Low-coverage zones after: {outcome.metrics.lowCoverageZones}</p>
      <p>Constraint violations: {outcome.metrics.constraintViolations}</p>
    </article>
  )
}

function DecisionBlock({ nearest, coverage }) {
  const rows = nearest.candidates.filter((candidate) => candidate.eligible || candidate.reasons.length).slice(0, 8)
  return (
    <div>
      <h3>{nearest.scenarioCode}</h3>
      <p>Nearest chose {nearest.selected?.displayName || 'nobody'} ({km(nearest.selected?.distanceM)}). Coverage-aware chose {coverage.selected?.displayName || 'nobody'} ({km(coverage.selected?.distanceM)}).</p>
      <table>
        <thead>
          <tr><th>Responder</th><th>Zone</th><th>Distance</th><th>Zone cover</th><th>Score</th><th>Why excluded</th></tr>
        </thead>
        <tbody>
          {rows.map((candidate) => (
            <tr key={candidate.displayName}>
              <td>{candidate.displayName}</td>
              <td>{candidate.zoneName}</td>
              <td>{km(candidate.distanceM)}</td>
              <td>{candidate.eligible ? candidate.zoneEligible : '—'}</td>
              <td>{candidate.score ?? '—'}</td>
              <td>{candidate.reasons.join(', ') || 'Eligible'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
