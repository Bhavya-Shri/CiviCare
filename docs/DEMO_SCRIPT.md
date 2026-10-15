# CiviCare demo script

1. State the question. Nearest eligible ignores whether that person is the last cover for their zone. CiviCare tests a second rule that can pick someone slightly farther when that preserves scarce cover. Say clearly that geolocation itself is not the claim.
2. Show `docs/ERD.md` and run two queries from `database/demo_queries.sql`: eligible responders, and low-coverage zones.
3. From the landing page, call out the 112 action. Submit a guest report. Show the status page refusing to promise arrival.
4. Open Experiments → Expired certification. Show the closer responder excluded.
5. Run Sparse zone coverage twice in the comparison (both policies are in one result). Walk through distance, zone count, and score.
6. Run Simultaneous incidents. Show two assignment ids and two responder ids.
7. Open Readiness. Point at a zone with eligible count 0 or 1 and say the threshold is a modelling choice.
8. Close with limits: synthetic responders, straight-line distance, no operational partner, results are not city performance.

Suggested sentence if coverage-aware looks better on one scenario: “On this seeded scenario it preserved a thin zone by adding distance. That is not a clinical result, and the normal scenario is included because the policies often agree.”
