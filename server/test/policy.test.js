import assert from 'node:assert/strict'
import test from 'node:test'
import { coverageLoss, pickCoverageAware, pickNearest, scoreCandidate } from '../src/policy.js'

test('coverage loss is total when a zone would be left empty', () => {
  assert.equal(coverageLoss(1), 1)
  assert.equal(coverageLoss(0), 1)
  assert.equal(coverageLoss(4), 0.25)
})

test('nearest eligible ignores coverage and picks the closer responder', () => {
  const chosen = pickNearest([
    { responderId: 'b', distanceM: 5000, score: 0.2 },
    { responderId: 'a', distanceM: 400, score: 0.9 },
  ])
  assert.equal(chosen.responderId, 'a')
})

test('coverage-aware can pick a farther responder with a lower score', () => {
  const near = { responderId: 'gt', distanceM: 500, zoneEligible: 1 }
  const far = { responderId: 'my', distanceM: 5800, zoneEligible: 4 }
  const scored = [near, far].map((candidate) => ({
    ...candidate,
    ...scoreCandidate(candidate.distanceM, candidate.zoneEligible),
  }))
  assert.ok(scored[1].score < scored[0].score)
  assert.equal(pickCoverageAware(scored).responderId, 'my')
})

test('equal scores break ties by distance', () => {
  const chosen = pickCoverageAware([
    { responderId: 'b', distanceM: 3000, score: 0.4 },
    { responderId: 'a', distanceM: 1000, score: 0.4 },
  ])
  assert.equal(chosen.responderId, 'a')
})
