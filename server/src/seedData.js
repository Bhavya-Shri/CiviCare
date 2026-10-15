import bcrypt from 'bcryptjs'
import { INCIDENT_TYPES, SKILLS, ZONES, pointWkt, squareWkt } from './constants.js'
import { query, resetDatabase, schemaReady, applySchema } from './db.js'

const RESPONDER_PASSWORD = 'Responder#1'
const ADMIN_PASSWORD = 'CiviCare#Admin1'

const ROSTER = [
  { id: 'GT-01', zone: 'GT', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0915, lng: 80.2765 },
  { id: 'GT-02', zone: 'GT', status: 'approved', fixture: 'fresh', cert: 'expired', skills: ['basic_life_support'], lat: 13.0884, lng: 80.2792 },
  { id: 'GT-03', zone: 'GT', status: 'approved', fixture: 'fresh', cert: 'pending', skills: ['basic_life_support'], lat: 13.0865, lng: 80.277 },
  { id: 'GT-04', zone: 'GT', status: 'approved', fixture: 'stale', cert: 'valid', skills: ['basic_life_support'], lat: 13.0892, lng: 80.281 },
  { id: 'GT-05', zone: 'GT', status: 'inactive', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0855, lng: 80.276 },
  { id: 'GT-06', zone: 'GT', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['scene_support'], lat: 13.0902, lng: 80.2825 },
  { id: 'MY-01', zone: 'MY', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0365, lng: 80.269 },
  { id: 'MY-02', zone: 'MY', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0322, lng: 80.2655 },
  { id: 'MY-03', zone: 'MY', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.031, lng: 80.271 },
  { id: 'MY-04', zone: 'MY', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0355, lng: 80.264 },
  { id: 'MY-05', zone: 'MY', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['trauma_care'], lat: 13.0298, lng: 80.2688 },
  { id: 'MY-06', zone: 'MY', status: 'pending', fixture: 'fresh', cert: 'pending', skills: ['basic_life_support'], lat: 13.034, lng: 80.2725 },
  { id: 'TN-01', zone: 'TN', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0435, lng: 80.233 },
  { id: 'TN-02', zone: 'TN', status: 'approved', fixture: 'fresh', cert: 'expired', skills: ['basic_life_support'], lat: 13.04, lng: 80.236 },
  { id: 'TN-03', zone: 'TN', status: 'approved', fixture: 'off_shift', cert: 'valid', skills: ['basic_life_support'], lat: 13.045, lng: 80.231 },
  { id: 'TN-04', zone: 'TN', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['community_care'], lat: 13.039, lng: 80.2375 },
  { id: 'TN-05', zone: 'TN', status: 'approved', fixture: 'stale', cert: 'valid', skills: ['trauma_care'], lat: 13.0422, lng: 80.23 },
  { id: 'TN-06', zone: 'TN', status: 'rejected', fixture: 'none', cert: 'rejected', skills: ['first_aid'], lat: 13.038, lng: 80.232 },
  { id: 'AN-01', zone: 'AN', status: 'approved', fixture: 'fresh', cert: 'expired', skills: ['basic_life_support'], lat: 13.085, lng: 80.2101 },
  { id: 'AN-02', zone: 'AN', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.092, lng: 80.214 },
  { id: 'AN-03', zone: 'AN', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['scene_support'], lat: 13.08, lng: 80.206 },
  { id: 'AN-04', zone: 'AN', status: 'approved', fixture: 'off_shift', cert: 'valid', skills: ['basic_life_support'], lat: 13.088, lng: 80.205 },
  { id: 'AN-05', zone: 'AN', status: 'approved', fixture: 'fresh', cert: 'pending', skills: ['trauma_care'], lat: 13.083, lng: 80.216 },
  { id: 'AN-06', zone: 'AN', status: 'inactive', fixture: 'fresh', cert: 'valid', skills: ['community_care'], lat: 13.09, lng: 80.208 },
  { id: 'AD-01', zone: 'AD', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.004, lng: 80.258 },
  { id: 'AD-02', zone: 'AD', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.9985, lng: 80.254 },
  { id: 'AD-03', zone: 'AD', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.996, lng: 80.26 },
  { id: 'AD-04', zone: 'AD', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.0065, lng: 80.251 },
  { id: 'AD-05', zone: 'AD', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['trauma_care'], lat: 13.0, lng: 80.262 },
  { id: 'AD-06', zone: 'AD', status: 'approved', fixture: 'stale', cert: 'valid', skills: ['basic_life_support'], lat: 13.002, lng: 80.2575 },
  { id: 'VL-01', zone: 'VL', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.983, lng: 80.219 },
  { id: 'VL-02', zone: 'VL', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.978, lng: 80.214 },
  { id: 'VL-03', zone: 'VL', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.986, lng: 80.222 },
  { id: 'VL-04', zone: 'VL', status: 'approved', fixture: 'fresh', cert: 'expired', skills: ['basic_life_support'], lat: 12.98, lng: 80.216 },
  { id: 'VL-05', zone: 'VL', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['scene_support'], lat: 12.976, lng: 80.221 },
  { id: 'VL-06', zone: 'VL', status: 'pending', fixture: 'fresh', cert: 'pending', skills: ['first_aid'], lat: 12.984, lng: 80.212 },
  { id: 'AM-01', zone: 'AM', status: 'approved', fixture: 'stale', cert: 'valid', skills: ['basic_life_support'], lat: 13.1143, lng: 80.1548 },
  { id: 'AM-02', zone: 'AM', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.12, lng: 80.16 },
  { id: 'AM-03', zone: 'AM', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['community_care'], lat: 13.11, lng: 80.15 },
  { id: 'AM-04', zone: 'AM', status: 'approved', fixture: 'off_shift', cert: 'valid', skills: ['trauma_care'], lat: 13.118, lng: 80.148 },
  { id: 'AM-05', zone: 'AM', status: 'inactive', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 13.112, lng: 80.158 },
  { id: 'AM-06', zone: 'AM', status: 'approved', fixture: 'fresh', cert: 'rejected', skills: ['basic_life_support'], lat: 13.116, lng: 80.152 },
  { id: 'TM-01', zone: 'TM', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.927, lng: 80.102 },
  { id: 'TM-02', zone: 'TM', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['basic_life_support'], lat: 12.922, lng: 80.097 },
  { id: 'TM-03', zone: 'TM', status: 'approved', fixture: 'fresh', cert: 'valid', skills: ['trauma_care'], lat: 12.93, lng: 80.104 },
  { id: 'TM-04', zone: 'TM', status: 'approved', fixture: 'stale', cert: 'valid', skills: ['scene_support'], lat: 12.919, lng: 80.099 },
  { id: 'TM-05', zone: 'TM', status: 'approved', fixture: 'fresh', cert: 'pending', skills: ['community_care'], lat: 12.926, lng: 80.093 },
  { id: 'TM-06', zone: 'TM', status: 'approved', fixture: 'off_shift', cert: 'valid', skills: ['first_aid'], lat: 12.932, lng: 80.107 },
]

const SCENARIO_INCIDENTS = [
  { code: 'sparse_coverage', lat: 13.0878, lng: 80.2785 },
  { code: 'normal', lat: 13.0038, lng: 80.2578 },
  { code: 'expired_cert', lat: 13.085, lng: 80.2101 },
  { code: 'stale_availability', lat: 13.1143, lng: 80.1548 },
  { code: 'simultaneous_a', lat: 12.9828, lng: 80.2188 },
  { code: 'simultaneous_b', lat: 12.9795, lng: 80.2165 },
  { code: 'out_of_area', lat: 10.5, lng: 78.5 },
]

const FACILITIES = [
  ['Rajiv Gandhi Government General Hospital', 'Park Town, Chennai (approximate)', 13.082, 80.276],
  ['Government Stanley Medical College Hospital', 'Washermanpet area, Chennai (approximate)', 13.106, 80.287],
  ['Government Kilpauk Medical College Hospital', 'Kilpauk, Chennai (approximate)', 13.078, 80.242],
  ['Government Royapettah Hospital', 'Royapettah, Chennai (approximate)', 13.054, 80.264],
  ['Government Peripheral Hospital, Anna Nagar', 'Anna Nagar, Chennai (approximate, identity not verified)', 13.087, 80.21],
  ['Tambaram Government Hospital sample pin', 'Tambaram, Chennai (approximate, identity not verified)', 12.925, 80.114],
]

function emailFor(displayName) {
  return `${displayName.toLowerCase().replace('-', '')}@civicare.demo`
}

const STATUS_FOR_CERT = {
  valid: 'verified',
  expired: 'expired',
  pending: 'pending',
  rejected: 'rejected',
}

export async function refreshSyntheticClocks() {
  await query(
    `UPDATE certifications c
     SET verified_status = CASE c.cert_fixture
           WHEN 'valid' THEN 'verified'
           WHEN 'expired' THEN 'expired'
           WHEN 'pending' THEN 'pending'
           WHEN 'rejected' THEN 'rejected'
           ELSE c.verified_status
         END,
         valid_from = CASE
           WHEN c.cert_fixture = 'expired' THEN now() - interval '400 days'
           ELSE now() - interval '30 days'
         END,
         valid_until = CASE
           WHEN c.cert_fixture = 'expired' THEN now() - interval '10 days'
           ELSE now() + interval '365 days'
         END
     FROM responders r
     WHERE r.responder_id = c.responder_id
       AND r.synthetic = true
       AND c.cert_fixture <> 'pending'`,
  )
  await query(
    `UPDATE shifts sh
     SET start_at = CASE
           WHEN r.availability_fixture = 'off_shift' THEN now() - interval '10 hours'
           ELSE now() - interval '2 hours'
         END,
         end_at = CASE
           WHEN r.availability_fixture = 'off_shift' THEN now() - interval '1 hour'
           ELSE now() + interval '14 hours'
         END,
         availability_status = 'available',
         last_confirmed_at = CASE
           WHEN r.availability_fixture = 'fresh' THEN now() - interval '20 minutes'
           ELSE now() - interval '10 hours'
         END
     FROM responders r
     WHERE r.responder_id = sh.responder_id
       AND r.synthetic = true`,
  )
  await query(
    `UPDATE responders
     SET availability_updated_at = now()
     WHERE synthetic = true`,
  )
  await query(
    `UPDATE incidents
     SET created_at = now()
     WHERE synthetic = true
       AND scenario_code IS NOT NULL`,
  )
}

export async function seedDatabase({ reset = false } = {}) {
  if (reset) await resetDatabase()
  else if (!(await schemaReady())) await applySchema()

  const existing = await query(`SELECT COUNT(*)::int AS n FROM users`)
  if (Number(existing[0].n) > 0) {
    await refreshSyntheticClocks()
    return { seeded: false, refreshed: true }
  }

  const responderHash = bcrypt.hashSync(RESPONDER_PASSWORD, 10)
  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10)

  await query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
    ['admin@civicare.demo', adminHash],
  )
  const org = await query(
    `INSERT INTO organisations (name, organisation_type, verification_status)
     VALUES ('Prototype Civic Circle', 'synthetic_community_group', 'prototype_only')
     RETURNING organisation_id`,
  )
  const organisationId = org[0].organisation_id

  const zoneIds = {}
  for (const zone of ZONES) {
    const rows = await query(
      `INSERT INTO zones (zone_code, zone_name, boundary, center, zone_source, notes)
       VALUES ($1, $2, ST_GeomFromEWKT($3), ST_GeomFromEWKT($4), $5, $6)
       RETURNING zone_id`,
      [
        zone.code,
        zone.name,
        squareWkt(zone.lat, zone.lng),
        pointWkt(zone.lat, zone.lng),
        'project_defined_not_an_official_boundary',
        'Square drawn for the CiviCare prototype around a Chennai neighbourhood centre. Not a ward boundary.',
      ],
    )
    zoneIds[zone.code] = rows[0].zone_id
  }

  const skillIds = {}
  for (const [code, name, description] of SKILLS) {
    const rows = await query(
      `INSERT INTO skills (skill_code, skill_name, permitted_scope, description)
       VALUES ($1, $2, $3, $4)
       RETURNING skill_id`,
      [code, name, 'prototype_only', description],
    )
    skillIds[code] = rows[0].skill_id
  }

  const responderIds = {}
  for (const person of ROSTER) {
    const user = await query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'responder') RETURNING user_id`,
      [emailFor(person.id), responderHash],
    )
    const responder = await query(
      `INSERT INTO responders (
         user_id, organisation_id, base_zone_id, display_name, responder_status,
         base_location, contact_preference, synthetic, availability_fixture
       ) VALUES ($1, $2, $3, $4, $5, ST_GeomFromEWKT($6), 'in_app', true, $7)
       RETURNING responder_id`,
      [
        user[0].user_id,
        organisationId,
        zoneIds[person.zone],
        person.id,
        person.status,
        pointWkt(person.lat, person.lng),
        person.fixture,
      ],
    )
    const responderId = responder[0].responder_id
    responderIds[person.id] = responderId
    for (const skill of person.skills) {
      await query(
        `INSERT INTO responder_skills (responder_id, skill_id) VALUES ($1, $2)`,
        [responderId, skillIds[skill]],
      )
      await query(
        `INSERT INTO certifications (
           responder_id, skill_id, issuer_label, verified_status, valid_from, valid_until, cert_fixture
         ) VALUES (
           $1, $2, 'Synthetic prototype issuer', $3, now() - interval '30 days', now() + interval '365 days', $4
         )`,
        [responderId, skillIds[skill], STATUS_FOR_CERT[person.cert], person.cert],
      )
    }
    await query(
      `INSERT INTO shifts (responder_id, start_at, end_at, availability_status, last_confirmed_at)
       VALUES ($1, now() - interval '2 hours', now() + interval '14 hours', 'available', now())`,
      [responderId],
    )
  }

  for (const facility of FACILITIES) {
    const [name, address, lat, lng] = facility
    const row = await query(
      `INSERT INTO facilities (name, address, location, contact, source_url, source_checked_at, provenance)
       VALUES ($1, $2, ST_GeomFromEWKT($3), NULL, NULL, '2026-10-15', $4)
       RETURNING facility_id`,
      [
        name,
        address,
        pointWkt(lat, lng),
        'approximate_sample_not_from_a_downloaded_dataset',
      ],
    )
    await query(
      `INSERT INTO facility_capabilities (facility_id, capability_code, source_note, verified_at)
       VALUES ($1, 'listed_in_prototype_directory', $2, NULL)`,
      [row[0].facility_id, 'Directory presence only. No emergency capability was verified.'],
    )
  }

  for (const incident of SCENARIO_INCIDENTS) {
    await query(
      `INSERT INTO incidents (
         public_token, zone_id, incident_type, reporter_role, location, location_precision,
         status, scenario_code, synthetic, access_note
       ) VALUES (
         $1,
         (SELECT zone_id FROM zones WHERE ST_Contains(boundary, ST_GeomFromEWKT($2)) LIMIT 1),
         'medical', 'bystander', ST_GeomFromEWKT($2), 'synthetic', 'pending', $3, true,
         'Synthetic scenario. Not a real emergency.'
       )`,
      [`scenario-${incident.code}`, pointWkt(incident.lat, incident.lng), incident.code],
    )
  }

  const background = [
    ['medical', 13.04, 80.23, 'pending'],
    ['injury', 13.03, 80.26, 'pending'],
    ['welfare_check', 12.93, 80.11, 'closed'],
    ['public_assist', 13.11, 80.16, 'pending'],
  ]
  for (let index = 0; index < background.length; index += 1) {
    const [incidentType, lat, lng, status] = background[index]
    await query(
      `INSERT INTO incidents (
         public_token, zone_id, incident_type, reporter_role, location, location_precision,
         status, synthetic, access_note
       ) VALUES (
         $1,
         (SELECT zone_id FROM zones WHERE ST_Contains(boundary, ST_GeomFromEWKT($2)) LIMIT 1),
         $3, 'self', ST_GeomFromEWKT($2), 'synthetic', $4, true,
         'Synthetic background row for dashboard counts.'
       )`,
      [`sample-${index + 1}`, pointWkt(lat, lng), incidentType, status],
    )
  }

  const held = await query(
    `INSERT INTO incidents (
       public_token, zone_id, incident_type, reporter_role, location, location_precision, status, synthetic, access_note
     ) VALUES (
       'sample-held',
       (SELECT zone_id FROM zones WHERE zone_code = 'AD'),
       'medical', 'bystander', ST_GeomFromEWKT($1), 'synthetic', 'assigned', true,
       'Synthetic row used to show an already-assigned responder.'
     ) RETURNING incident_id`,
    [pointWkt(13.007, 80.2505)],
  )
  await query(
    `INSERT INTO assignments (incident_id, responder_id, policy_version, status)
     VALUES ($1, $2, 'seed-fixture', 'accepted')`,
    [held[0].incident_id, responderIds['AD-04']],
  )

  await refreshSyntheticClocks()
  return {
    seeded: true,
    responders: ROSTER.length,
    zones: ZONES.length,
    skills: Object.keys(INCIDENT_TYPES).length,
  }
}
