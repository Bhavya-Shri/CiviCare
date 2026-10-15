-- CiviCare demonstration queries
-- Run against a CiviCare database after seed.
-- Distance is a straight-line proxy, not an arrival time.

-- 1. Eligible basic-life-support responders right now.
SELECT zone_name, display_name, verified_status, last_confirmed_at, has_active_assignment
FROM current_responder_eligibility
WHERE skill_code = 'basic_life_support'
  AND responder_status = 'approved'
  AND verified_status = 'verified'
  AND valid_until >= now()
  AND availability_status = 'available'
  AND last_confirmed_at >= now() - interval '4 hours'
  AND has_active_assignment = false
ORDER BY zone_name, display_name;

-- 2. Low-coverage zones for basic life support (threshold: fewer than 2).
SELECT zone_name, skill_code, eligible_count
FROM zone_skill_readiness
WHERE skill_code = 'basic_life_support'
  AND eligible_count <= 1
ORDER BY eligible_count, zone_name;

-- 3. Incident counts by category and status.
SELECT incident_type, status, COUNT(*) AS incidents
FROM incidents
GROUP BY incident_type, status
ORDER BY incident_type, status;

-- 4. Incidents with no eligible result recorded.
SELECT i.public_token, i.incident_type, i.scenario_code, i.created_at
FROM incidents i
WHERE i.status = 'no_eligible'
ORDER BY i.created_at DESC;

-- 5. Why a decision was made (latest log per incident).
SELECT i.scenario_code,
       d.policy_version,
       d.reason_code,
       r.display_name AS selected_responder,
       d.score_details,
       d.created_at
FROM allocation_decision_logs d
JOIN incidents i ON i.incident_id = d.incident_id
LEFT JOIN responders r ON r.responder_id = d.selected_responder_id
ORDER BY d.created_at DESC
LIMIT 20;

-- 6. Assignment outcomes from append-only events.
SELECT event_type, COUNT(*) AS events
FROM assignment_events
GROUP BY event_type
ORDER BY events DESC;

-- 7. Straight-line distance from each approved responder to a George Town pin.
-- Replace the coordinates if you want another pin. Longitude first in ST_MakePoint.
SELECT r.display_name,
       z.zone_name,
       round(ST_Distance(
         r.base_location::geography,
         ST_SetSRID(ST_MakePoint(80.2785, 13.0878), 4326)::geography
       )::numeric, 0) AS distance_m
FROM responders r
JOIN zones z ON z.zone_id = r.base_zone_id
WHERE r.responder_status = 'approved'
ORDER BY distance_m
LIMIT 15;

-- 8. Show that the partial unique index blocks a second active assignment.
-- This statement is expected to fail if the responder already has an active row.
-- INSERT INTO assignments (incident_id, responder_id, policy_version, status)
-- VALUES ('<incident uuid>', '<responder uuid>', 'manual-check', 'offered');

-- 9. Index support for the spatial lookup. Read the plan, do not treat cost as ETA.
EXPLAIN
SELECT r.display_name
FROM responders r
WHERE ST_DWithin(
  r.base_location::geography,
  ST_SetSRID(ST_MakePoint(80.2785, 13.0878), 4326)::geography,
  8000
);
