import { SCENARIOS, SEED_VERSION } from './constants.js'
import { query, withTransaction } from './db.js'
import { HttpError } from './http.js'
import { allocateIncident } from './allocation.js'
import { isLowCoverage, mean, median } from './policy.js'

async function scenarioIncidents(db, codes) {
  return db.query(
    `SELECT incident_id, scenario_code
     FROM incidents
     WHERE synthetic = true AND scenario_code = ANY($1::text[])
     ORDER BY scenario_code, created_at`,
    [codes],
  )
}

function metricsOf(decisions, coverageRows) {
  const selected = decisions.filter((decision) => decision.selected)
  const distances = selected.map((decision) => decision.selected.distanceM)
  const lowCoverage = coverageRows.filter((row) => isLowCoverage(Number(row.eligible_count)))
  return {
    incidents: decisions.length,
    assigned: selected.length,
    noEligible: decisions.length - selected.length,
    eligibleAssignmentRate: decisions.length ? selected.length / decisions.length : 0,
    meanDistanceM: mean(distances),
    medianDistanceM: median(distances),
    lowCoverageZones: lowCoverage.length,
    uncoveredZones: coverageRows.filter((row) => Number(row.eligible_count) === 0).length,
    constraintViolations:
      decisions.filter((decision) => decision.constraintViolation).length
      + (new Set(selected.map((decision) => decision.selected.responderId)).size === selected.length ? 0 : 1),
  }
}

export async function compareScenario(scenarioName) {
  const scenario = SCENARIOS[scenarioName]
  if (!scenario) throw new HttpError(404, 'Unknown scenario.', 'not_found')

  const policies = {}
  for (const policy of ['nearest_eligible', 'coverage_aware']) {
    const outcome = await withTransaction(async (tx) => {
      const incidents = await scenarioIncidents(tx, scenario.codes)
      if (!incidents.length) {
        throw new HttpError(404, 'That scenario has no seeded incidents. Run setup again.', 'not_found')
      }
      const ids = incidents.map((incident) => incident.incident_id)
      await tx.query(`DELETE FROM assignment_events`)
      await tx.query(`DELETE FROM assignments`)
      await tx.query(
        `UPDATE incidents SET status = 'pending' WHERE incident_id = ANY($1::uuid[])`,
        [ids],
      )

      const decisions = []
      for (const incident of incidents) {
        decisions.push(await allocateIncident(incident.incident_id, policy, { tx }))
      }
      const coverage = await tx.query(
        `SELECT zone_id, zone_name, eligible_count
         FROM zone_skill_readiness
         WHERE skill_code = 'basic_life_support'
         ORDER BY zone_name`,
      )
      return { decisions, coverage }
    }, { rollback: true })

    policies[policy] = {
      policyVersion: outcome.decisions[0]?.policyVersion,
      decisions: outcome.decisions.map((decision) => ({
        incidentId: decision.incidentId,
        scenarioCode: decision.scenarioCode,
        assignmentId: decision.assignmentId,
        selected: decision.selected,
        constraintViolation: decision.constraintViolation,
        candidates: decision.candidates,
      })),
      coverage: outcome.coverage.map((row) => ({
        zoneId: row.zone_id,
        zoneName: row.zone_name,
        eligibleCount: Number(row.eligible_count),
      })),
      metrics: metricsOf(outcome.decisions, outcome.coverage),
    }
  }

  const runRows = await query(
    `INSERT INTO experiment_runs (scenario_name, seed, policy_version, parameters, completed_at)
     VALUES ($1, $2, 'comparison', $3::jsonb, now())
     RETURNING run_id`,
    [
      scenarioName,
      SEED_VERSION,
      JSON.stringify({
        policies: ['nearest_eligible', 'coverage_aware'],
        rolledBack: true,
        alpha: 0.45,
        beta: 0.55,
        maxDistanceM: 8000,
      }),
    ],
  )
  const runId = runRows[0].run_id
  for (const [policy, outcome] of Object.entries(policies)) {
    for (const [metricName, metricValue] of Object.entries(outcome.metrics)) {
      if (metricValue == null) continue
      await query(
        `INSERT INTO experiment_results (run_id, metric_name, metric_value)
         VALUES ($1, $2, $3)`,
        [runId, `${policy}.${metricName}`, metricValue],
      )
    }
  }

  return {
    runId,
    scenario: scenarioName,
    label: scenario.label,
    summary: scenario.summary,
    seed: SEED_VERSION,
    simulated: true,
    note: 'The comparison is rolled back, including any offers cleared for the run. Live reports are restored afterward. Distances are straight-line proxies, not arrival times.',
    policies,
  }
}
