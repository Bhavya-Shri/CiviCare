import assert from 'node:assert/strict'
import { closeDb, initDb } from './db.js'
import { compareScenario } from './experiments.js'
import { seedDatabase } from './seedData.js'

function selectedName(result, policy) {
  return result.policies[policy].decisions[0]?.selected?.displayName || null
}

function excludedReasons(result, policy, displayName) {
  const candidates = result.policies[policy].decisions[0]?.candidates || []
  return candidates.find((candidate) => candidate.displayName === displayName)?.reasons || []
}

await initDb()
await seedDatabase({ reset: true })

const sparse = await compareScenario('sparse_coverage')
assert.equal(selectedName(sparse, 'nearest_eligible'), 'GT-01')
assert.ok(selectedName(sparse, 'coverage_aware').startsWith('MY-'))
assert.ok(
  sparse.policies.coverage_aware.decisions[0].selected.distanceM
    > sparse.policies.nearest_eligible.decisions[0].selected.distanceM,
)
assert.equal(sparse.policies.nearest_eligible.metrics.constraintViolations, 0)
assert.equal(sparse.policies.coverage_aware.metrics.constraintViolations, 0)

const normal = await compareScenario('normal')
assert.equal(selectedName(normal, 'nearest_eligible'), 'AD-01')
assert.equal(selectedName(normal, 'coverage_aware'), 'AD-01')

const expired = await compareScenario('expired_certification')
assert.equal(selectedName(expired, 'nearest_eligible'), 'AN-02')
assert.equal(selectedName(expired, 'coverage_aware'), 'AN-02')
assert.ok(excludedReasons(expired, 'nearest_eligible', 'AN-01').includes('certification_expired'))

const stale = await compareScenario('stale_availability')
assert.equal(selectedName(stale, 'nearest_eligible'), 'AM-02')
assert.ok(excludedReasons(stale, 'nearest_eligible', 'AM-01').includes('availability_stale'))

const simultaneous = await compareScenario('simultaneous')
for (const policy of ['nearest_eligible', 'coverage_aware']) {
  const names = simultaneous.policies[policy].decisions.map((decision) => decision.selected?.displayName)
  assert.equal(names.length, 2)
  assert.equal(new Set(names).size, 2)
  assert.ok(names.every((name) => ['VL-01', 'VL-02', 'VL-03'].includes(name)))
  assert.equal(simultaneous.policies[policy].metrics.constraintViolations, 0)
}

const none = await compareScenario('no_eligible')
assert.equal(selectedName(none, 'nearest_eligible'), null)
assert.equal(selectedName(none, 'coverage_aware'), null)
assert.equal(none.policies.nearest_eligible.metrics.noEligible, 1)

console.log('CiviCare allocation checks passed.')
await closeDb()
