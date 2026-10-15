export const MAX_DISTANCE_M = 8000
export const FRESHNESS_HOURS = 4
export const ALPHA = 0.45
export const BETA = 0.55
export const LOW_COVERAGE_THRESHOLD = 1
export const SEED_VERSION = 'civicare-seed-v1'
export const ACTIVE_ASSIGNMENT_STATUSES = ['offered', 'accepted', 'en_route', 'arrived']

export const POLICIES = {
  nearest_eligible: 'civicare-nearest-v1',
  coverage_aware: 'civicare-coverage-v1',
}

export const INCIDENT_TYPES = {
  medical: {
    label: 'Medical emergency',
    skill: 'basic_life_support',
  },
  injury: {
    label: 'Injury',
    skill: 'trauma_care',
  },
  collapse_or_unresponsive: {
    label: 'Collapse or unresponsive',
    skill: 'basic_life_support',
  },
  public_assist: {
    label: 'Public assist',
    skill: 'scene_support',
  },
  welfare_check: {
    label: 'Welfare check',
    skill: 'community_care',
  },
}

export const SKILLS = [
  ['basic_life_support', 'Basic life support', 'Prototype skill for simulated medical and collapse reports. Not a licence to treat.'],
  ['first_aid', 'First aid', 'Prototype skill. Not shown as treatment advice.'],
  ['trauma_care', 'Trauma care', 'Prototype skill linked to injury reports.'],
  ['scene_support', 'Scene support', 'Prototype skill for non-clinical public assist reports.'],
  ['community_care', 'Community care', 'Prototype skill linked to welfare-check reports.'],
]

export const ZONES = [
  { code: 'GT', name: 'George Town', lat: 13.0878, lng: 80.2785 },
  { code: 'TN', name: 'T Nagar', lat: 13.0418, lng: 80.2341 },
  { code: 'MY', name: 'Mylapore', lat: 13.0339, lng: 80.2676 },
  { code: 'AN', name: 'Anna Nagar', lat: 13.085, lng: 80.2101 },
  { code: 'AD', name: 'Adyar', lat: 13.0012, lng: 80.2565 },
  { code: 'VL', name: 'Velachery', lat: 12.9815, lng: 80.218 },
  { code: 'AM', name: 'Ambattur', lat: 13.1143, lng: 80.1548 },
  { code: 'TM', name: 'Tambaram', lat: 12.9249, lng: 80.1 },
]

export const SCENARIOS = {
  normal: {
    label: 'Normal distribution',
    summary: 'Several eligible responders share Adyar. Both policies should be able to assign, and they often pick the same person.',
    codes: ['normal'],
  },
  sparse_coverage: {
    label: 'Sparse zone coverage',
    summary: 'The closest eligible person is the only cover for George Town. Coverage-aware may choose a farther Mylapore responder.',
    codes: ['sparse_coverage'],
  },
  expired_certification: {
    label: 'Expired certification',
    summary: 'The closest responder’s credential is expired and must be excluded.',
    codes: ['expired_cert'],
  },
  stale_availability: {
    label: 'Stale availability',
    summary: 'The closest confirmation is older than 4 hours and must be excluded.',
    codes: ['stale_availability'],
  },
  simultaneous: {
    label: 'Simultaneous incidents',
    summary: 'Two medical incidents are close together. They must not take the same responder.',
    codes: ['simultaneous_a', 'simultaneous_b'],
  },
  no_eligible: {
    label: 'No eligible responder',
    summary: 'The pin is outside the 8 km bound of every seeded responder.',
    codes: ['out_of_area'],
  },
}

export const ASSIGNMENT_TRANSITIONS = {
  offered: ['accepted', 'declined', 'cancelled'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  declined: [],
  completed: [],
  cancelled: [],
}

export function squareWkt(lat, lng, km = 2.4) {
  const dLat = km / 111
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180))
  const ring = [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ]
  return `SRID=4326;POLYGON((${ring.map(([x, y]) => `${x} ${y}`).join(',')}))`
}

export function pointWkt(lat, lng) {
  return `SRID=4326;POINT(${lng} ${lat})`
}
