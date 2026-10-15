import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  ALPHA,
  ASSIGNMENT_TRANSITIONS,
  BETA,
  FRESHNESS_HOURS,
  INCIDENT_TYPES,
  MAX_DISTANCE_M,
  SCENARIOS,
  SKILLS,
} from './constants.js'
import { query } from './db.js'
import { requireRole, requireUser, signToken } from './auth.js'
import { asyncRoute, HttpError } from './http.js'
import { allocateIncident, publicIncidentStatus } from './allocation.js'
import { compareScenario } from './experiments.js'
import {
  allocateSchema,
  availabilitySchema,
  certificationSchema,
  incidentSchema,
  loginSchema,
  registerSchema,
  respondSchema,
  reviewSchema,
  scenarioSchema,
} from './validation.js'

const hits = new Map()

function rateLimit(req) {
  const key = req.ip || 'local'
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((stamp) => now - stamp < 10 * 60 * 1000)
  if (recent.length >= 30) {
    throw new HttpError(429, 'Too many reports from this browser. Wait a few minutes and call 112 if you need help.', 'rate_limited')
  }
  recent.push(now)
  hits.set(key, recent)
}

async function responderForUser(userId) {
  const rows = await query(
    `SELECT r.responder_id, r.display_name, r.responder_status, r.availability_fixture,
            r.availability_updated_at, z.zone_code, z.zone_name
     FROM responders r
     JOIN zones z ON z.zone_id = r.base_zone_id
     WHERE r.user_id = $1`,
    [userId],
  )
  return rows[0] || null
}

export function mountRoutes(app) {
  app.get('/api/health', asyncRoute(async (_req, res) => {
    const rows = await query(`SELECT COUNT(*)::int AS zones FROM zones`)
    res.json({ ok: true, service: 'civicare', zones: Number(rows[0].zones) })
  }))

  app.get('/api/meta', asyncRoute(async (_req, res) => {
    const zones = await query(
      `SELECT zone_code, zone_name, ST_Y(center) AS lat, ST_X(center) AS lng FROM zones ORDER BY zone_name`,
    )
    res.json({
      name: 'CiviCare',
      expandedName: 'Community Emergency Readiness & Response',
      tagline: 'Prepared communities. Coordinated care.',
      emergencyNumber: '112',
      prototype: true,
      incidentTypes: INCIDENT_TYPES,
      skills: SKILLS.map(([code, name, description]) => ({ code, name, description })),
      zones: zones.map((zone) => ({
        code: zone.zone_code,
        name: zone.zone_name,
        lat: Number(zone.lat),
        lng: Number(zone.lng),
      })),
      scenarios: Object.entries(SCENARIOS).map(([id, scenario]) => ({
        id,
        label: scenario.label,
        summary: scenario.summary,
      })),
      allocation: {
        maxDistanceM: MAX_DISTANCE_M,
        freshnessHours: FRESHNESS_HOURS,
        alpha: ALPHA,
        beta: BETA,
        distanceLabel: 'Straight-line distance proxy, not an arrival time.',
      },
    })
  }))

  app.get('/api/facilities', asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT f.name, f.address, f.provenance, f.source_checked_at,
              ST_Y(f.location) AS lat, ST_X(f.location) AS lng,
              (SELECT json_agg(json_build_object('code', fc.capability_code, 'note', fc.source_note))
               FROM facility_capabilities fc WHERE fc.facility_id = f.facility_id) AS capabilities
       FROM facilities f
       ORDER BY f.name`,
    )
    res.json({
      caveat: 'Approximate sample pins. Not a downloaded dataset and not a live capacity feed.',
      facilities: rows.map((row) => ({
        name: row.name,
        address: row.address,
        provenance: row.provenance,
        sourceCheckedAt: row.source_checked_at,
        lat: Number(row.lat),
        lng: Number(row.lng),
        capabilities: row.capabilities || [],
      })),
    })
  }))

  app.get('/api/dashboard/readiness', requireUser, requireRole('admin'), asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT zone_code, zone_name, lat, lng, skill_code, skill_name, eligible_count
       FROM zone_skill_readiness
       ORDER BY zone_name, skill_name`,
    )
    const zones = new Map()
    for (const row of rows) {
      if (!zones.has(row.zone_code)) {
        zones.set(row.zone_code, {
          code: row.zone_code,
          name: row.zone_name,
          lat: Number(row.lat),
          lng: Number(row.lng),
          skills: [],
        })
      }
      zones.get(row.zone_code).skills.push({
        code: row.skill_code,
        name: row.skill_name,
        eligibleCount: Number(row.eligible_count),
      })
    }
    res.json({
      generatedAt: new Date().toISOString(),
      freshness: `Availability must have been confirmed within ${FRESHNESS_HOURS} hours.`,
      lowCoverageThreshold: 1,
      simulated: true,
      zones: [...zones.values()],
    })
  }))

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const body = registerSchema.parse(req.body)
    const zone = await query(`SELECT zone_id FROM zones WHERE zone_code = $1`, [body.zoneCode.toUpperCase()])
    const skill = await query(`SELECT skill_id FROM skills WHERE skill_code = $1`, [body.skillCode])
    if (!zone[0] || !skill[0]) throw new HttpError(400, 'Zone or skill was not recognised.', 'bad_reference')
    const passwordHash = bcrypt.hashSync(body.password, 10)
    try {
      const user = await query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'responder') RETURNING user_id, email, role`,
        [body.email.toLowerCase(), passwordHash],
      )
      const responder = await query(
        `INSERT INTO responders (
           user_id, base_zone_id, display_name, responder_status, base_location,
           synthetic, availability_fixture, availability_updated_at
         )
         SELECT $1, zone_id, $2, 'pending', center, false, 'fresh', now()
         FROM zones WHERE zone_id = $3
         RETURNING responder_id`,
        [user[0].user_id, body.displayName, zone[0].zone_id],
      )
      await query(
        `INSERT INTO responder_skills (responder_id, skill_id) VALUES ($1, $2)`,
        [responder[0].responder_id, skill[0].skill_id],
      )
      await query(
        `INSERT INTO certifications (
           responder_id, skill_id, issuer_label, verified_status, valid_from, valid_until, cert_fixture
         ) VALUES ($1, $2, 'Self-submitted prototype record', 'pending', now(), now() + interval '365 days', 'pending')`,
        [responder[0].responder_id, skill[0].skill_id],
      )
      await query(
        `INSERT INTO shifts (responder_id, start_at, end_at, availability_status, last_confirmed_at)
         VALUES ($1, now() - interval '5 minutes', now() + interval '8 hours', 'available', now())`,
        [responder[0].responder_id],
      )
      res.status(201).json({
        token: signToken(user[0]),
        user: { email: user[0].email, role: user[0].role, displayName: body.displayName },
        message: 'Account created. A certification stays pending until an administrator reviews it.',
      })
    } catch (error) {
      if (error.code === '23505') throw new HttpError(409, 'That email is already registered.', 'duplicate_email')
      throw error
    }
  }))

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const rows = await query(
      `SELECT user_id, email, password_hash, role, account_status FROM users WHERE email = $1`,
      [body.email.toLowerCase()],
    )
    const user = rows[0]
    if (!user || user.account_status !== 'active' || !bcrypt.compareSync(body.password, user.password_hash)) {
      throw new HttpError(401, 'Email or password is not valid.', 'unauthorized')
    }
    const responder = user.role === 'responder' ? await responderForUser(user.user_id) : null
    res.json({
      token: signToken(user),
      user: {
        email: user.email,
        role: user.role,
        displayName: responder?.display_name || 'Admin',
      },
    })
  }))

  app.post('/api/incidents', asyncRoute(async (req, res) => {
    rateLimit(req)
    const body = incidentSchema.parse(req.body)
    const token = crypto.randomBytes(9).toString('base64url')
    const point = `SRID=4326;POINT(${body.lng} ${body.lat})`
    const rows = await query(
      `INSERT INTO incidents (
         public_token, zone_id, incident_type, reporter_role, location, location_precision,
         affected_count, access_note, status, synthetic
       ) VALUES (
         $1,
         (SELECT zone_id FROM zones WHERE ST_Contains(boundary, ST_GeomFromEWKT($2)) LIMIT 1),
         $3, $4, ST_GeomFromEWKT($2), $5, $6, $7, 'pending', false
       )
       RETURNING public_token, status, created_at`,
      [
        token,
        point,
        body.incidentType,
        body.reporterRole,
        body.locationPrecision || 'map_pin',
        body.affectedCount ?? null,
        body.accessNote || null,
      ],
    )
    res.status(201).json({
      ...rows[0],
      publicToken: rows[0].public_token,
      simulated: true,
      message: 'Report stored in the prototype only. This does not contact a responder or emergency services. Call 112 if you need help.',
    })
  }))

  app.get('/api/incidents/status/:token', asyncRoute(async (req, res) => {
    const status = await publicIncidentStatus(req.params.token)
    if (!status) throw new HttpError(404, 'No report matches that reference.', 'not_found')
    res.json(status)
  }))

  app.get('/api/responders/me', requireUser, requireRole('responder'), asyncRoute(async (req, res) => {
    const responder = await responderForUser(req.user.user_id)
    if (!responder) throw new HttpError(404, 'No responder profile is linked to this account.', 'not_found')
    const certs = await query(
      `SELECT c.certification_id, s.skill_name, s.skill_code, c.verified_status, c.valid_until, c.issuer_label
       FROM certifications c
       JOIN skills s ON s.skill_id = c.skill_id
       WHERE c.responder_id = $1
       ORDER BY s.skill_name`,
      [responder.responder_id],
    )
    const offers = await query(
      `SELECT a.assignment_id, a.status, a.assigned_at, a.policy_version, i.incident_type, i.created_at
       FROM assignments a
       JOIN incidents i ON i.incident_id = a.incident_id
       WHERE a.responder_id = $1
       ORDER BY a.assigned_at DESC`,
      [responder.responder_id],
    )
    res.json({
      responder: {
        displayName: responder.display_name,
        status: responder.responder_status,
        zoneName: responder.zone_name,
        zoneCode: responder.zone_code,
        availabilityFixture: responder.availability_fixture,
        availabilityUpdatedAt: responder.availability_updated_at,
      },
      certifications: certs,
      offers,
    })
  }))

  app.patch('/api/responders/me/availability', requireUser, requireRole('responder'), asyncRoute(async (req, res) => {
    const body = availabilitySchema.parse(req.body)
    const responder = await responderForUser(req.user.user_id)
    if (!responder) throw new HttpError(404, 'No responder profile is linked to this account.', 'not_found')
    const fixture = body.available ? 'fresh' : 'off_shift'
    await query(
      `UPDATE responders
       SET availability_updated_at = now(), availability_fixture = $2
       WHERE responder_id = $1`,
      [responder.responder_id, fixture],
    )
    const updated = await query(
      `UPDATE shifts
       SET availability_status = 'available',
           start_at = CASE WHEN $2::boolean THEN now() - interval '5 minutes' ELSE now() - interval '2 hours' END,
           end_at = CASE WHEN $2::boolean THEN now() + interval '8 hours' ELSE now() - interval '1 minute' END,
           last_confirmed_at = CASE WHEN $2::boolean THEN now() ELSE now() - interval '10 hours' END
       WHERE responder_id = $1
       RETURNING shift_id`,
      [responder.responder_id, body.available],
    )
    if (!updated.length && body.available) {
      await query(
        `INSERT INTO shifts (responder_id, start_at, end_at, availability_status, last_confirmed_at)
         VALUES ($1, now() - interval '5 minutes', now() + interval '8 hours', 'available', now())`,
        [responder.responder_id],
      )
    }
    res.json({
      available: body.available,
      message: body.available
        ? 'Availability confirmed just now. It expires under the 4-hour rule unless you confirm again.'
        : 'You are marked unavailable for new simulated offers.',
    })
  }))

  app.post('/api/responders/me/certifications', requireUser, requireRole('responder'), asyncRoute(async (req, res) => {
    const body = certificationSchema.parse(req.body)
    const responder = await responderForUser(req.user.user_id)
    if (!responder) throw new HttpError(404, 'No responder profile is linked to this account.', 'not_found')
    const skill = await query(`SELECT skill_id FROM skills WHERE skill_code = $1`, [body.skillCode])
    if (!skill[0]) throw new HttpError(400, 'Unknown skill.', 'bad_reference')
    await query(
      `INSERT INTO responder_skills (responder_id, skill_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [responder.responder_id, skill[0].skill_id],
    )
    const created = await query(
      `INSERT INTO certifications (
         responder_id, skill_id, issuer_label, verified_status, valid_from, valid_until, cert_fixture
       ) VALUES ($1, $2, $3, 'pending', now(), now() + interval '365 days', 'pending')
       RETURNING certification_id, verified_status`,
      [responder.responder_id, skill[0].skill_id, body.issuerLabel],
    )
    res.status(201).json({
      certificationId: created[0].certification_id,
      verifiedStatus: 'pending',
      message: 'Submitted for review. A self-entered record is not treated as verified.',
    })
  }))

  app.post('/api/assignments/:id/respond', requireUser, requireRole('responder'), asyncRoute(async (req, res) => {
    const body = respondSchema.parse(req.body)
    const responder = await responderForUser(req.user.user_id)
    if (!responder) throw new HttpError(404, 'No responder profile is linked to this account.', 'not_found')
    const rows = await query(
      `SELECT assignment_id, incident_id, status
       FROM assignments
       WHERE assignment_id = $1 AND responder_id = $2`,
      [req.params.id, responder.responder_id],
    )
    const assignment = rows[0]
    if (!assignment) throw new HttpError(404, 'That offer is not assigned to you.', 'not_found')
    const allowed = ASSIGNMENT_TRANSITIONS[assignment.status] || []
    if (!allowed.includes(body.status)) {
      throw new HttpError(409, `Cannot move an offer from ${assignment.status} to ${body.status}.`, 'bad_transition')
    }
    await query(
      `UPDATE assignments
       SET status = $2,
           accepted_at = CASE WHEN $2 = 'accepted' THEN now() ELSE accepted_at END,
           ended_at = CASE WHEN $2 IN ('declined', 'cancelled', 'completed') THEN now() ELSE ended_at END,
           outcome = $2
       WHERE assignment_id = $1`,
      [assignment.assignment_id, body.status],
    )
    await query(
      `INSERT INTO assignment_events (assignment_id, event_type, actor_id, note)
       VALUES ($1, $2, $3, 'Simulated status update.')`,
      [assignment.assignment_id, body.status, req.user.user_id],
    )
    if (['declined', 'cancelled', 'completed'].includes(body.status)) {
      await query(
        `UPDATE incidents
         SET status = 'pending'
         WHERE incident_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM assignments
             WHERE incident_id = $1
               AND status IN ('offered', 'accepted', 'en_route', 'arrived')
           )`,
        [assignment.incident_id],
      )
    }
    res.json({
      status: body.status,
      simulated: true,
      message: 'Status stored in the prototype. This is not a live dispatch update.',
    })
  }))

  app.get('/api/admin/certifications', requireUser, requireRole('admin'), asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT c.certification_id, c.verified_status, c.issuer_label, c.valid_until, c.cert_fixture,
              r.display_name, r.responder_status, s.skill_name, s.skill_code
       FROM certifications c
       JOIN responders r ON r.responder_id = c.responder_id
       JOIN skills s ON s.skill_id = c.skill_id
       WHERE c.verified_status = 'pending'
       ORDER BY r.display_name`,
    )
    res.json({ certifications: rows })
  }))

  app.patch('/api/admin/certifications/:id', requireUser, requireRole('admin'), asyncRoute(async (req, res) => {
    const body = reviewSchema.parse(req.body)
    const fixture = body.verifiedStatus === 'verified' ? 'valid' : body.verifiedStatus
    const rows = await query(
      `UPDATE certifications
       SET verified_status = $2,
           cert_fixture = $3,
           reviewed_by = $4,
           reviewed_at = now(),
           valid_from = now() - interval '1 day',
           valid_until = CASE
             WHEN $2 = 'expired' THEN now() - interval '1 day'
             ELSE now() + interval '365 days'
           END
       WHERE certification_id = $1
       RETURNING certification_id, responder_id, verified_status`,
      [req.params.id, body.verifiedStatus, fixture, req.user.user_id],
    )
    if (!rows[0]) throw new HttpError(404, 'Certification not found.', 'not_found')
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'review_certification', 'certification', $2, $3::jsonb)`,
      [req.user.user_id, rows[0].certification_id, JSON.stringify({ verifiedStatus: body.verifiedStatus })],
    )
    res.json({ certification: rows[0], message: 'Review recorded. The responder is not verified by self-submission.' })
  }))

  app.get('/api/admin/responders', requireUser, requireRole('admin'), asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT r.responder_id, r.display_name, r.responder_status, z.zone_name, r.synthetic
       FROM responders r
       JOIN zones z ON z.zone_id = r.base_zone_id
       WHERE r.responder_status = 'pending'
       ORDER BY r.display_name`,
    )
    res.json({ responders: rows })
  }))

  app.patch('/api/admin/responders/:id', requireUser, requireRole('admin'), asyncRoute(async (req, res) => {
    const status = req.body?.responderStatus
    if (!['approved', 'rejected', 'inactive'].includes(status)) {
      throw new HttpError(400, 'Responder status is not valid.', 'validation_error')
    }
    const rows = await query(
      `UPDATE responders SET responder_status = $2 WHERE responder_id = $1
       RETURNING responder_id, display_name, responder_status`,
      [req.params.id, status],
    )
    if (!rows[0]) throw new HttpError(404, 'Responder not found.', 'not_found')
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'review_responder', 'responder', $2, $3::jsonb)`,
      [req.user.user_id, rows[0].responder_id, JSON.stringify({ responderStatus: status })],
    )
    res.json({ responder: rows[0] })
  }))

  app.get('/api/admin/incidents', requireUser, requireRole('admin'), asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT i.incident_id, i.public_token, i.incident_type, i.status, i.scenario_code,
              i.synthetic, i.reporter_role, i.created_at,
              ST_Y(i.location) AS lat, ST_X(i.location) AS lng
       FROM incidents i
       ORDER BY i.created_at DESC
       LIMIT 50`,
    )
    res.json({
      incidents: rows.map((row) => ({
        ...row,
        lat: Number(row.lat),
        lng: Number(row.lng),
      })),
    })
  }))

  app.post('/api/admin/incidents/:id/allocate', requireUser, requireRole('admin'), asyncRoute(async (req, res) => {
    const body = allocateSchema.parse(req.body)
    const decision = await allocateIncident(req.params.id, body.policy, { actorId: req.user.user_id })
    res.json({
      ...decision,
      simulated: true,
      message: decision.selected
        ? 'A simulated offer was stored. This did not contact a real person.'
        : 'No eligible responder was found. The 112 fallback still applies.',
    })
  }))

  app.post('/api/experiments/compare', requireUser, requireRole('admin'), asyncRoute(async (req, res) => {
    const body = scenarioSchema.parse(req.body)
    const result = await compareScenario(body.scenario)
    res.json(result)
  }))
}
