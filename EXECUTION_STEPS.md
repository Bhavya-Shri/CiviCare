# CiviCare — steps to execute

**CiviCare**  
Community Emergency Readiness & Response  
Prepared communities. Coordinated care.

The source blueprint used the working title RESPOND (Community First Responder Readiness and Coordination System). This repository uses **CiviCare** everywhere in the product, schema comments, API, and interface. The research question is unchanged: compare a nearest-eligible responder rule with a coverage-aware rule on the same simulated scenarios.

CiviCare is an academic database prototype. It does not dispatch ambulances, contact real responders, or replace India’s emergency number **112**.

## How to run the prototype

Requirements: Node.js 20 or newer. PostgreSQL does not need to be installed separately. The default database is embedded PostgreSQL with PostGIS (PGlite), stored in `server/.pglite`.

```powershell
cd c:\Users\mail2_tdwzs1y\Desktop\bhavya_cursor\DBMS_Project
npm install
npm run dev
```

Then open http://localhost:5173

The first launch creates the schema and loads the synthetic Chennai seed. Later launches refresh synthetic shift clocks so the 4-hour availability rule still has both fresh and stale examples.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run setup` | Drop and recreate the embedded database, then seed it |
| `npm run check` | Run the allocation assertions against the seeded database |
| `npm test` | Run scoring unit tests (no database) |
| `npm run build` | Build the client. The API serves `client/dist` if that folder exists |

Demo sign-in (synthetic accounts only):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@civicare.demo` | `CiviCare#Admin1` |
| Responder | `gt01@civicare.demo` | `Responder#1` |

Optional full PostgreSQL instead of the embedded database:

1. Start PostGIS with Docker: `docker compose up -d` (Docker is not installed on the current machine; this file is ready for a machine that has it).
2. Copy `.env.example` to `.env` and set `DATABASE_URL=postgres://civicare:civicare@localhost:5432/civicare`.
3. Run `npm run setup` and `npm run dev`.

## Frozen decisions

These were open in the blueprint. They are now fixed so the schema and algorithm match.

| Decision | Choice |
| --- | --- |
| Geography | Eight **project zones** around Chennai neighbourhoods. They are not official ward boundaries. |
| Incident categories | `medical`, `injury`, `collapse_or_unresponsive`, `public_assist`, `welfare_check` |
| Skill rule | medical and collapse → `basic_life_support`; injury → `trauma_care`; public assist → `scene_support`; welfare check → `community_care` |
| Availability freshness | `last_confirmed_at` within 4 hours of the incident time |
| Active assignment | At most one assignment in `offered`, `accepted`, `en_route`, or `arrived` |
| Travel | Straight-line PostGIS distance in metres. Hard bound **8 km**. This is a distance proxy, not an arrival time. |
| Coverage | Count of responders in the candidate’s base zone who pass every hard rule except the travel bound |
| Underserved zone | Eligible count for that skill is 0 or 1 |
| Score | `0.45 * (distance / 8000) + 0.55 * coverage_loss`. Lower score wins. `coverage_loss` is `1` when the zone count is 1, otherwise `1 / count`. |
| Weights | Experiment settings, not clinical guidance |
| Guest status | Unguessable public token. No account required. |
| Facilities | Six approximate sample pins typed for the prototype. Not imported from a downloaded dataset. No live capacity. |
| Real-time sockets | Out of scope. The status page polls. |

## What was built

| Blueprint phase | Status | Where to look |
| --- | --- | --- |
| 0 Requirements | Done | `docs/REQUIREMENTS.md`, `docs/ERD.md` |
| 1 Data model | Done | `database/schema.sql`, `database/demo_queries.sql` |
| 2 Synthetic data | Done | `server/src/seed.js` — 8 zones, 48 responders, deterministic layout |
| 3 Backend | Done | `server/src` — Express, Zod, JWT, health check |
| 4 User flows | Done | Landing, guest report, status, responder, admin verification |
| 5 Nearest-eligible allocation | Done | Transaction, row lock, partial unique index, decision log |
| 6 Coverage-aware policy | Done | Same eligibility filter, documented score, experiment comparison |
| 7 Geography / facilities | Done for the prototype sample | Leaflet + OpenStreetMap, provenance labels |
| 8 Evaluation | Done for seeded scenarios | Readiness and experiment pages, `npm run check` |
| 9 Report and viva | Not code | Use `docs/DEMO_SCRIPT.md` and `database/demo_queries.sql` |

## Demo path (about 10 minutes)

1. Open the landing page. Call 112 stays visible. Read the prototype limitation.
2. Submit **I need help** with a Chennai map pin and category **Medical emergency**. Save the reference. The status page must not claim that anyone was dispatched.
3. Sign in as admin. Open the incident and run **Nearest eligible**, then reset the database if you want a clean second run (`npm run setup`). For a side-by-side comparison that does not change live rows, use the Experiments page instead.
4. Open **Experiments**, run **Sparse zone coverage**. Nearest eligible should choose the only George Town responder. Coverage-aware should choose a Mylapore responder and show a higher distance with a lower coverage penalty.
5. Run **Expired certification** and **Stale availability**. The closest person is listed with an exclusion reason and is not selected.
6. Run **Simultaneous incidents**. Two offers must name two different responders.
7. Run **No eligible responder**. The result must say nobody qualified, and the 112 fallback stays on screen.
8. Sign in as `gt01@civicare.demo` after a committed allocation to that responder, and accept or decline the simulated offer.
9. In pgAdmin, DBeaver, or `psql`, run `database/demo_queries.sql` if you are connected to a full PostgreSQL server. On the embedded database, the same rules are what `npm run check` exercises.

## Safety rules while executing

- Do not enter a real emergency into this app. Call 112.
- Do not present simulated status text as a live dispatch.
- Do not add real names, phone numbers, or patient histories to the seed or screenshots.
- Do not commit `.env`, `server/.pglite`, or tokens.
- Facility pins are approximate. Do not add emergency-capability tags unless a source was actually checked and recorded in `docs/DATA_SOURCES.md`.

## Change tracking

Every implementation pass is recorded in `AUDIT.md`. Runtime admin actions (certification review, allocation, assignment updates) are also stored in the `audit_logs` table.

## Still open after this build

- Download and inspect a real Chennai facility dataset before citing it. The catalogue link in the blueprint was not treated as used.
- Replace the straight-line proxy with a documented routing source only if the licence allows it.
- Literature review (including GoodSAM and official 112 material) belongs in the written report, with dated citations.
- Optional later work: Socket.IO, cloud deployment, larger seeds (300–500 responders) for the written evaluation tables.
