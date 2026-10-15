import { z } from 'zod'
import { INCIDENT_TYPES } from './constants.js'

const incidentTypes = /** @type {[string, ...string[]]} */ (Object.keys(INCIDENT_TYPES))

export const incidentSchema = z.object({
  reporterRole: z.enum(['self', 'bystander']),
  incidentType: z.enum(incidentTypes),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  locationPrecision: z.enum(['device', 'map_pin', 'manual']).optional(),
  affectedCount: z.number().int().min(0).max(999).nullable().optional(),
  accessNote: z.string().trim().max(280).nullable().optional(),
})

export const registerSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(80),
  displayName: z.string().trim().min(2).max(40),
  zoneCode: z.string().trim().min(2).max(8),
  skillCode: z.string().trim().min(2).max(40),
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(80),
})

export const availabilitySchema = z.object({
  available: z.boolean(),
})

export const certificationSchema = z.object({
  skillCode: z.string().trim().min(2).max(40),
  issuerLabel: z.string().trim().min(2).max(120),
})

export const reviewSchema = z.object({
  verifiedStatus: z.enum(['verified', 'rejected', 'expired']),
})

export const allocateSchema = z.object({
  policy: z.enum(['nearest_eligible', 'coverage_aware']),
})

export const respondSchema = z.object({
  status: z.enum(['accepted', 'declined', 'en_route', 'arrived', 'completed', 'cancelled']),
})

export const scenarioSchema = z.object({
  scenario: z.enum([
    'normal',
    'sparse_coverage',
    'expired_certification',
    'stale_availability',
    'simultaneous',
    'no_eligible',
  ]),
})
