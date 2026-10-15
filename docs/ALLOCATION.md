# Allocation rules

Both policies share one hard filter. Coverage score is not allowed to override it.

A responder is eligible for an incident when all of the following are true at the incident’s `created_at` time:

1. `responder_status` is `approved`.
2. They hold the skill required by the incident category.
3. That skill’s certification is `verified`, and the incident time is inside `valid_from` and `valid_until`.
4. They have a shift with `availability_status = available` covering the incident time.
5. That shift’s `last_confirmed_at` is within 4 hours before the incident time.
6. They have no assignment in `offered`, `accepted`, `en_route`, or `arrived`.
7. Straight-line distance from `base_location` to the incident is at most 8,000 metres.

Distance is `ST_Distance` between two `geography` points. It is a straight-line proxy. It is not a road travel time and not an ambulance ETA.

## Zone coverage

For the incident’s skill, count responders based in each zone who pass rules 1–6. Rule 7 is not part of coverage. Coverage answers “who is still ready for this zone?”, not “who can reach this pin?”.

```
coverage_loss = 1                if zone_eligible_count <= 1
coverage_loss = 1 / zone_count   otherwise
```

A zone with 0 or 1 eligible responder is treated as low coverage.

## Policies

**Nearest eligible** (`civicare-nearest-v1`): among eligible responders, smallest distance. Ties break on `responder_id` so the same seed repeats.

**Coverage-aware** (`civicare-coverage-v1`):

```
normalized_travel = distance_m / 8000
score = 0.45 * normalized_travel + 0.55 * coverage_loss
```

Lower score wins. Ties break on distance, then `responder_id`.

`0.45` and `0.55` are configuration values for this prototype. They are not medically validated weights. The experiment page reports when the two policies agree and when they diverge.

## Transactions

Live allocation locks the incident row, re-reads eligibility, inserts the assignment, and writes the decision log in one transaction. A partial unique index on active assignments is the backstop if two transactions try to take the same responder.

Experiment comparison runs the same function and then rolls the transaction back, so the comparison does not change live assignments. Metrics are saved after the rollback in `experiment_runs` and `experiment_results`.

## Worked example the seed is built to show

Sparse scenario, medical incident at the George Town project-zone centre:

- GT-01 is the only eligible basic-life-support responder in George Town, and is close.
- Four eligible Mylapore responders are farther, still inside 8 km.
- Nearest eligible selects GT-01.
- Coverage-aware pays extra distance to avoid leaving George Town with nobody, and selects a Mylapore responder.

If a future seed change breaks that story, `npm run check` fails.
