import { INCIDENT_TYPES, MAX_DISTANCE_M, POLICIES } from './constants.js'
import { query } from './db.js'
import { HttpError } from './http.js'
import { pickCoverageAware, pickNearest, scoreCandidate } from './policy.js'

function parsePgArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value == null || value === '{}' || value === '') return []
  const text = String(value).trim()
  if (text === '{}') return []
  if (text.startsWith('{') && text.endsWith('}')) {
    return text
      .slice(1, -1)
      .split(',')
      .map((part) => part.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)
  }
  return [text]
}

const CANDIDATE_SQL = `
WITH incident_point AS (
  SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS geog
)
SELECT
  r.responder_id,
  r.display_name,
  r.responder_status,
  z.zone_id,
  z.zone_name,
  ST_Distance(r.base_location::geography, incident_point.geog) AS distance_m,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN r.responder_status <> 'approved' THEN 'profile_not_approved' END,
    CASE
      WHEN cert.responder_id IS NULL THEN 'skill_not_held'
      WHEN NOT COALESCE(cert.valid_cert, false) AND COALESCE(cert.pending_cert, false) THEN 'certification_pending'
      WHEN NOT COALESCE(cert.valid_cert, false) AND COALESCE(cert.rejected_cert, false) THEN 'certification_rejected'
      WHEN NOT COALESCE(cert.valid_cert, false) AND COALESCE(cert.expired_cert, false) THEN 'certification_expired'
      WHEN NOT COALESCE(cert.valid_cert, false) THEN 'certification_invalid'
    END,
    CASE
      WHEN NOT COALESCE(shift.on_shift, false) THEN 'off_shift'
      WHEN NOT COALESCE(shift.fresh, false) THEN 'availability_stale'
    END,
    CASE WHEN COALESCE(active.busy, false) THEN 'already_assigned' END
  ]::text[], NULL) AS hard_reasons
FROM responders r
JOIN zones z ON z.zone_id = r.base_zone_id
CROSS JOIN incident_point
LEFT JOIN LATERAL (
  SELECT
    c.responder_id,
    bool_or(
      c.verified_status = 'verified'
      AND c.valid_from <= $4::timestamptz
      AND c.valid_until >= $4::timestamptz
    ) AS valid_cert,
    bool_or(c.verified_status = 'pending') AS pending_cert,
    bool_or(c.verified_status = 'rejected') AS rejected_cert,
    bool_or(
      c.verified_status = 'expired'
      OR (c.verified_status = 'verified' AND c.valid_until < $4::timestamptz)
    ) AS expired_cert
  FROM certifications c
  JOIN skills s ON s.skill_id = c.skill_id
  WHERE c.responder_id = r.responder_id
    AND s.skill_code = $3
  GROUP BY c.responder_id
) cert ON true
LEFT JOIN LATERAL (
  SELECT
    bool_or(
      sh.availability_status = 'available'
      AND sh.start_at <= $4::timestamptz
      AND sh.end_at > $4::timestamptz
    ) AS on_shift,
    bool_or(
      sh.availability_status = 'available'
      AND sh.start_at <= $4::timestamptz
      AND sh.end_at > $4::timestamptz
      AND sh.last_confirmed_at >= $4::timestamptz - interval '4 hours'
    ) AS fresh
  FROM shifts sh
  WHERE sh.responder_id = r.responder_id
) shift ON true
LEFT JOIN LATERAL (
  SELECT true AS busy
  FROM assignments a
  WHERE a.responder_id = r.responder_id
    AND a.status IN ('offered', 'accepted', 'en_route', 'arrived')
  LIMIT 1
) active ON true
`

export async function evaluateCandidates(db, incident) {
  const skill = INCIDENT_TYPES[incident.incident_type]?.skill
  if (!skill) throw new HttpError(400, 'This incident category is not supported.', 'bad_incident')
  const rows = await db.query(CANDIDATE_SQL, [
    incident.lat,
    incident.lng,
    skill,
    incident.created_at,
  ])

  const mapped = rows.map((row) => {
    const hardReasons = parsePgArray(row.hard_reasons)
    const distanceM = Number(row.distance_m)
    const reasons = [...hardReasons]
    if (distanceM > MAX_DISTANCE_M) reasons.push('beyond_travel_bound')
    return {
      responderId: row.responder_id,
      displayName: row.display_name,
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      distanceM,
      hardReasons,
      reasons,
    }
  })

  const zoneCounts = {}
  for (const candidate of mapped) {
    if (candidate.hardReasons.length === 0) {
      zoneCounts[candidate.zoneId] = (zoneCounts[candidate.zoneId] || 0) + 1
    }
  }

  return mapped.map((candidate) => {
    const zoneEligible = zoneCounts[candidate.zoneId] || 0
    const scored = scoreCandidate(candidate.distanceM, Math.max(zoneEligible, 1))
    const eligible = candidate.reasons.length === 0
    return {
      ...candidate,
      zoneEligible: candidate.hardReasons.length === 0 ? zoneEligible : 0,
      ...scored,
      eligible,
    }
  })
}

function choose(policy, eligible) {
  if (policy === 'nearest_eligible') return pickNearest(eligible)
  if (policy === 'coverage_aware') return pickCoverageAware(eligible)
  throw new HttpError(400, 'Unknown allocation policy.', 'bad_policy')
}

function roundSummary(candidates) {
  return candidates
    .map((candidate) => ({
      displayName: candidate.displayName,
      zoneName: candidate.zoneName,
      distanceM: Math.round(candidate.distanceM),
      eligible: candidate.eligible,
      reasons: candidate.reasons,
      zoneEligible: candidate.zoneEligible,
      score: candidate.eligible ? Number(candidate.score.toFixed(4)) : null,
    }))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.distanceM - b.distanceM)
}

async function loadIncident(db, incidentId, lock) {
  const rows = await db.query(
    `SELECT incident_id, public_token, incident_type, status, scenario_code, created_at,
            ST_Y(location) AS lat, ST_X(location) AS lng
     FROM incidents
     WHERE incident_id = $1
     ${lock ? 'FOR UPDATE' : ''}`,
    [incidentId],
  )
  return rows[0] || null
}

export async function allocateIncident(incidentId, policy, { tx, actorId = null } = {}) {
  const run = async (db) => {
    const incident = await loadIncident(db, incidentId, true)
    if (!incident) throw new HttpError(404, 'Report not found.', 'not_found')
    if (incident.status !== 'pending') {
      throw new HttpError(409, 'This report is not waiting for allocation.', 'not_pending')
    }

    let evaluated = await evaluateCandidates(db, incident)
    let selected = choose(policy, evaluated.filter((candidate) => candidate.eligible))

    if (selected) {
      await db.query(`SELECT responder_id FROM responders WHERE responder_id = $1 FOR UPDATE`, [
        selected.responderId,
      ])
      evaluated = await evaluateCandidates(db, incident)
      const still = evaluated.find((candidate) => candidate.responderId === selected.responderId && candidate.eligible)
      if (!still) {
        selected = choose(policy, evaluated.filter((candidate) => candidate.eligible))
      } else {
        selected = still
      }
    }

    let assignmentId = null
    if (selected) {
      try {
        const inserted = await db.query(
          `INSERT INTO assignments (incident_id, responder_id, policy_version, status)
           VALUES ($1, $2, $3, 'offered')
           RETURNING assignment_id`,
          [incident.incident_id, selected.responderId, POLICIES[policy]],
        )
        assignmentId = inserted[0].assignment_id
      } catch (error) {
        if (error.code === '23505') {
          throw new HttpError(409, 'That responder was just assigned to another incident.', 'assignment_conflict')
        }
        throw error
      }
      await db.query(`UPDATE incidents SET status = 'assigned' WHERE incident_id = $1`, [incident.incident_id])
      await db.query(
        `INSERT INTO incident_events (incident_id, event_type, actor_id, note)
         VALUES ($1, 'simulated_offer_recorded', $2, $3)`,
        [incident.incident_id, actorId, 'Prototype offer only. This is not a dispatch.'],
      )
      await db.query(
        `INSERT INTO assignment_events (assignment_id, event_type, actor_id, note)
         VALUES ($1, 'offered', $2, 'Simulated offer recorded.')`,
        [assignmentId, actorId],
      )
    } else {
      await db.query(`UPDATE incidents SET status = 'no_eligible' WHERE incident_id = $1`, [incident.incident_id])
      await db.query(
        `INSERT INTO incident_events (incident_id, event_type, actor_id, note)
         VALUES ($1, 'no_eligible_responder', $2, 'No responder passed the hard rules. Call 112.')`,
        [incident.incident_id, actorId],
      )
    }

    const scoreDetails = selected
      ? {
          distanceM: Math.round(selected.distanceM),
          normalizedTravel: Number(selected.normalizedTravel.toFixed(4)),
          coverageLoss: Number(selected.coverageLoss.toFixed(4)),
          zoneEligible: selected.zoneEligible,
          alpha: selected.alpha,
          beta: selected.beta,
          score: Number(selected.score.toFixed(4)),
          distanceProxy: 'straight_line_metres',
          maxDistanceM: MAX_DISTANCE_M,
        }
      : { distanceProxy: 'straight_line_metres', maxDistanceM: MAX_DISTANCE_M }

    await db.query(
      `INSERT INTO allocation_decision_logs
        (incident_id, policy_version, candidate_summary, selected_responder_id, reason_code, score_details)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)`,
      [
        incident.incident_id,
        POLICIES[policy],
        JSON.stringify({ candidates: roundSummary(evaluated) }),
        selected?.responderId ?? null,
        selected ? 'selected' : 'no_eligible_candidate',
        JSON.stringify(scoreDetails),
      ],
    )
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'allocate', 'incident', $2, $3::jsonb)`,
      [
        actorId,
        incident.incident_id,
        JSON.stringify({ policy, selected: selected?.displayName ?? null, simulated: true }),
      ],
    )

    return {
      incidentId: incident.incident_id,
      scenarioCode: incident.scenario_code,
      policy,
      policyVersion: POLICIES[policy],
      assignmentId,
      selected: selected
        ? {
            responderId: selected.responderId,
            displayName: selected.displayName,
            zoneName: selected.zoneName,
            distanceM: Math.round(selected.distanceM),
            zoneEligible: selected.zoneEligible,
            score: Number(selected.score.toFixed(4)),
          }
        : null,
      candidates: roundSummary(evaluated),
      constraintViolation: selected ? !selected.eligible : false,
    }
  }

  if (tx) return run(tx)
  const { withTransaction } = await import('./db.js')
  return withTransaction(run)
}

export async function publicIncidentStatus(token) {
  const rows = await query(
    `SELECT public_token, incident_type, reporter_role, status, created_at, location_precision
     FROM incidents WHERE public_token = $1`,
    [token],
  )
  const incident = rows[0]
  if (!incident) return null
  const messages = {
    pending: 'The report is stored in this prototype. No community responder has been contacted. If you need emergency help, call 112.',
    assigned: 'A simulated offer was recorded inside the prototype. Nobody has been dispatched. If you need emergency help, call 112.',
    no_eligible: 'No eligible community responder was found under the prototype rules. Call 112 if you need help.',
    closed: 'This prototype report is closed. It was never a live dispatch.',
  }
  return {
    publicToken: incident.public_token,
    incidentType: incident.incident_type,
    reporterRole: incident.reporter_role,
    status: incident.status,
    createdAt: incident.created_at,
    locationPrecision: incident.location_precision,
    simulated: true,
    message: messages[incident.status] || messages.pending,
  }
}
