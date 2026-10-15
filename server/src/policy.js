import { ALPHA, BETA, LOW_COVERAGE_THRESHOLD, MAX_DISTANCE_M } from './constants.js'

export function coverageLoss(zoneEligibleCount) {
  if (zoneEligibleCount <= 1) return 1
  return 1 / zoneEligibleCount
}

export function scoreCandidate(distanceM, zoneEligibleCount, alpha = ALPHA, beta = BETA) {
  const normalizedTravel = distanceM / MAX_DISTANCE_M
  const loss = coverageLoss(zoneEligibleCount)
  return {
    normalizedTravel,
    coverageLoss: loss,
    alpha,
    beta,
    score: alpha * normalizedTravel + beta * loss,
  }
}

export function pickNearest(eligible) {
  return [...eligible].sort((a, b) => a.distanceM - b.distanceM || a.responderId.localeCompare(b.responderId))[0] || null
}

export function pickCoverageAware(eligible) {
  return [...eligible].sort((a, b) => {
    const scoreDiff = a.score - b.score
    if (scoreDiff !== 0) return scoreDiff
    const distanceDiff = a.distanceM - b.distanceM
    if (distanceDiff !== 0) return distanceDiff
    return a.responderId.localeCompare(b.responderId)
  })[0] || null
}

export function isLowCoverage(count) {
  return count <= LOW_COVERAGE_THRESHOLD
}

export function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

export function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
