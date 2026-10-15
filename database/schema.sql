-- CiviCare relational schema
-- Community Emergency Readiness & Response
-- PostgreSQL + PostGIS. Academic prototype, not an emergency service.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('responder', 'admin')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organisations (
  organisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organisation_type TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('prototype_only', 'unverified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE zones (
  zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_code TEXT NOT NULL UNIQUE,
  zone_name TEXT NOT NULL,
  boundary geometry(Polygon, 4326) NOT NULL,
  center geometry(Point, 4326) NOT NULL,
  population_estimate INTEGER,
  zone_source TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE skills (
  skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_code TEXT NOT NULL UNIQUE,
  skill_name TEXT NOT NULL,
  permitted_scope TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE responders (
  responder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users (user_id),
  organisation_id UUID REFERENCES organisations (organisation_id),
  base_zone_id UUID NOT NULL REFERENCES zones (zone_id),
  display_name TEXT NOT NULL,
  responder_status TEXT NOT NULL CHECK (responder_status IN ('pending', 'approved', 'inactive', 'rejected')),
  base_location geometry(Point, 4326) NOT NULL,
  availability_updated_at TIMESTAMPTZ,
  contact_preference TEXT NOT NULL DEFAULT 'in_app',
  synthetic BOOLEAN NOT NULL DEFAULT true,
  availability_fixture TEXT NOT NULL DEFAULT 'fresh'
    CHECK (availability_fixture IN ('fresh', 'stale', 'off_shift', 'none'))
);

CREATE TABLE responder_skills (
  responder_id UUID NOT NULL REFERENCES responders (responder_id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills (skill_id),
  PRIMARY KEY (responder_id, skill_id)
);

CREATE TABLE certifications (
  certification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id UUID NOT NULL REFERENCES responders (responder_id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills (skill_id),
  issuer_label TEXT NOT NULL,
  verified_status TEXT NOT NULL CHECK (verified_status IN ('pending', 'verified', 'rejected', 'expired')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  reviewed_by UUID REFERENCES users (user_id),
  reviewed_at TIMESTAMPTZ,
  cert_fixture TEXT NOT NULL DEFAULT 'valid'
    CHECK (cert_fixture IN ('valid', 'expired', 'pending', 'rejected')),
  CHECK (valid_from < valid_until)
);

CREATE TABLE shifts (
  shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id UUID NOT NULL REFERENCES responders (responder_id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  availability_status TEXT NOT NULL CHECK (availability_status IN ('available', 'unavailable')),
  last_confirmed_at TIMESTAMPTZ NOT NULL,
  CHECK (start_at < end_at)
);

CREATE TABLE facilities (
  facility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location geometry(Point, 4326) NOT NULL,
  contact TEXT,
  source_url TEXT,
  source_checked_at TIMESTAMPTZ,
  provenance TEXT NOT NULL
);

CREATE TABLE facility_capabilities (
  facility_id UUID NOT NULL REFERENCES facilities (facility_id) ON DELETE CASCADE,
  capability_code TEXT NOT NULL,
  source_note TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (facility_id, capability_code)
);

CREATE TABLE incidents (
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token TEXT NOT NULL UNIQUE,
  zone_id UUID REFERENCES zones (zone_id),
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'medical', 'injury', 'collapse_or_unresponsive', 'public_assist', 'welfare_check'
  )),
  priority_label TEXT NOT NULL DEFAULT 'simulated'
    CHECK (priority_label IN ('simulated')),
  reporter_role TEXT NOT NULL CHECK (reporter_role IN ('self', 'bystander')),
  location geometry(Point, 4326) NOT NULL,
  location_precision TEXT NOT NULL CHECK (location_precision IN ('device', 'map_pin', 'manual', 'synthetic')),
  affected_count INTEGER CHECK (affected_count IS NULL OR affected_count >= 0),
  access_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'no_eligible', 'closed')),
  scenario_code TEXT,
  synthetic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents (incident_id),
  responder_id UUID NOT NULL REFERENCES responders (responder_id),
  policy_version TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN (
    'offered', 'accepted', 'declined', 'en_route', 'arrived', 'completed', 'cancelled'
  )),
  outcome TEXT
);

CREATE UNIQUE INDEX assignments_one_active_responder
  ON assignments (responder_id)
  WHERE status IN ('offered', 'accepted', 'en_route', 'arrived');

CREATE TABLE incident_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents (incident_id),
  event_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES users (user_id),
  note TEXT
);

CREATE TABLE assignment_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments (assignment_id),
  event_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES users (user_id),
  note TEXT
);

CREATE TABLE readiness_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zones (zone_id),
  skill_code TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eligible_count INTEGER NOT NULL,
  coverage_score NUMERIC,
  policy_version TEXT
);

CREATE TABLE allocation_decision_logs (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents (incident_id),
  policy_version TEXT NOT NULL,
  candidate_summary JSONB NOT NULL,
  selected_responder_id UUID REFERENCES responders (responder_id),
  reason_code TEXT NOT NULL,
  score_details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE experiment_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL,
  seed TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  parameters JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE experiment_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES experiment_runs (run_id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  zone_id UUID REFERENCES zones (zone_id)
);

CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users (user_id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX responders_zone_status_idx ON responders (base_zone_id, responder_status);
CREATE INDEX certifications_responder_skill_idx ON certifications (responder_id, skill_id, verified_status);
CREATE INDEX shifts_responder_window_idx ON shifts (responder_id, start_at, end_at);
CREATE INDEX incidents_status_created_idx ON incidents (status, created_at);
CREATE INDEX incidents_scenario_idx ON incidents (scenario_code);
CREATE INDEX assignment_events_assignment_idx ON assignment_events (assignment_id, recorded_at);
CREATE INDEX incident_events_incident_idx ON incident_events (incident_id, recorded_at);
CREATE INDEX decision_logs_incident_idx ON allocation_decision_logs (incident_id, created_at);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, recorded_at);

CREATE INDEX zones_boundary_gix ON zones USING GIST (boundary);
CREATE INDEX zones_center_gix ON zones USING GIST (center);
CREATE INDEX responders_location_gix ON responders USING GIST (base_location);
CREATE INDEX incidents_location_gix ON incidents USING GIST (location);
CREATE INDEX facilities_location_gix ON facilities USING GIST (location);

-- Current area readiness. Uses now(), so it is the live dashboard view.
-- Allocation uses the incident timestamp instead. See docs/ALLOCATION.md.
CREATE VIEW zone_skill_readiness AS
SELECT
  z.zone_id,
  z.zone_code,
  z.zone_name,
  ST_Y(z.center) AS lat,
  ST_X(z.center) AS lng,
  s.skill_code,
  s.skill_name,
  (
    SELECT COUNT(*)::int
    FROM responders r
    WHERE r.base_zone_id = z.zone_id
      AND r.responder_status = 'approved'
      AND EXISTS (
        SELECT 1
        FROM certifications c
        WHERE c.responder_id = r.responder_id
          AND c.skill_id = s.skill_id
          AND c.verified_status = 'verified'
          AND c.valid_from <= now()
          AND c.valid_until >= now()
      )
      AND EXISTS (
        SELECT 1
        FROM shifts sh
        WHERE sh.responder_id = r.responder_id
          AND sh.availability_status = 'available'
          AND sh.start_at <= now()
          AND sh.end_at > now()
          AND sh.last_confirmed_at >= now() - interval '4 hours'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM assignments a
        WHERE a.responder_id = r.responder_id
          AND a.status IN ('offered', 'accepted', 'en_route', 'arrived')
      )
  ) AS eligible_count
FROM zones z
CROSS JOIN skills s;

CREATE VIEW current_responder_eligibility AS
SELECT
  r.responder_id,
  r.display_name,
  r.responder_status,
  z.zone_code,
  z.zone_name,
  s.skill_code,
  c.verified_status,
  c.valid_until,
  sh.availability_status,
  sh.last_confirmed_at,
  EXISTS (
    SELECT 1
    FROM assignments a
    WHERE a.responder_id = r.responder_id
      AND a.status IN ('offered', 'accepted', 'en_route', 'arrived')
  ) AS has_active_assignment
FROM responders r
JOIN zones z ON z.zone_id = r.base_zone_id
LEFT JOIN certifications c ON c.responder_id = r.responder_id
LEFT JOIN skills s ON s.skill_id = c.skill_id
LEFT JOIN shifts sh ON sh.responder_id = r.responder_id
  AND sh.start_at <= now()
  AND sh.end_at > now();
