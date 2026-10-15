# CiviCare development audit

This file is the build log. Each implementation pass gets a dated entry that says what changed and why.

It is separate from the database table `audit_logs`, which records runtime actions inside the prototype (certification reviews, allocations, assignment updates).

Product name: **CiviCare** — Community Emergency Readiness & Response. Tagline: Prepared communities. Coordinated care. The blueprint working title RESPOND is not used in the product.

Repository: https://github.com/Bhavya-Shri/CiviCare.git

## 2026-10-15 — Pass 1, project start

- Read `RESPOND_Project_Blueprint.docx` and renamed the product to CiviCare.
- Workspace `DBMS_Project` was empty. No PostgreSQL install and no Docker on this machine.
- Chose embedded PostgreSQL + PostGIS (PGlite) as the default database so the prototype can run locally, with `DATABASE_URL` and `docker-compose.yml` kept for a full PostGIS server.
- Wrote `EXECUTION_STEPS.md` with the run steps and the decisions that the blueprint had left open.

## 2026-10-15 — Pass 3, verification

- `npm test` passed the scoring tests.
- `npm run check` passed. Sparse coverage selects GT-01 for nearest eligible and a Mylapore responder for coverage-aware. Expired, stale, simultaneous, and no-eligible scenarios match the frozen rules.
- Browser pass: guest report from “I need help” stored reference `ir8K0bKQXKtS` with a pending status and a 112 fallback. Admin sign-in opens the desk. Facilities list renders. The sparse experiment shows nearest GT-01 at 0.46 km and coverage-aware MY-01 at 5.77 km, with zero constraint violations.
- Fixed a sign-in race that saved the session after the admin page’s first request, which flashed “Sign in is required”.
- Experiment comparisons now clear offers only inside a transaction that rolls back, so a live assignment does not hide the seeded comparison. Confirmed GT-01’s accepted offer was still present after the experiment.
- API and client are running locally: http://localhost:5173 and http://localhost:4000 (embedded PostgreSQL + PostGIS).

## 2026-10-15 — Pass 4, repository

- Initial commit contains the schema, API, client, execution steps, and this audit.
- Remote: https://github.com/Bhavya-Shri/CiviCare.git


- Added the relational schema, views, constraints, GiST indexes, and the partial unique index that blocks two active assignments for one responder.
- Added the synthetic Chennai seed (8 project zones, 48 fictional responder ids, facilities labelled as approximate samples).
- Added the Express API: guest incident reports, JWT auth, responder availability, admin certification review, transactional allocation, readiness, and rolled-back experiment comparisons.
- Added the React client: landing page with Call 112, incident report, status, facility map, responder home, admin tools, readiness, and experiments.
- Scoring rule used in code: `score = 0.45 * (distance_m / 8000) + 0.55 * coverage_loss`, lower score preferred. Documented in `docs/ALLOCATION.md`.
