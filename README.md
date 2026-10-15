# CiviCare

Community Emergency Readiness & Response.  
Prepared communities. Coordinated care.

CiviCare is an academic database prototype for Chennai. It stores responder eligibility in PostgreSQL and compares two simulated allocation rules: nearest eligible, and a coverage-aware score. It does not replace **112**, dispatch ambulances, or contact real responders.

The blueprint for this work used the working title RESPOND. The product name in this repository is CiviCare.

## Run

```powershell
npm install
npm run dev
```

Open http://localhost:5173

The first start creates an embedded PostgreSQL + PostGIS database in `server/.pglite` and loads synthetic data. No separate database install is required.

| Command | Purpose |
| --- | --- |
| `npm run setup` | Recreate the database and seed it |
| `npm run check` | Reset the seed and assert the allocation scenarios |
| `npm test` | Scoring unit tests |
| `npm run build` | Build the client |

Steps, frozen decisions, and the demo order are in [EXECUTION_STEPS.md](EXECUTION_STEPS.md). Implementation changes are logged in [AUDIT.md](AUDIT.md).

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@civicare.demo` | `CiviCare#Admin1` |
| Responder | `gt01@civicare.demo` | `Responder#1` |

All responder passwords in the seed are `Responder#1`. These are fictional prototype accounts.

## Optional PostgreSQL server

`docker compose up -d` starts PostGIS. Copy `.env.example` to `.env` and set:

```
DATABASE_URL=postgres://civicare:civicare@localhost:5432/civicare
```

Then `npm run setup`.

## Safety

If this is an emergency, call 112. Do not file a real incident here. Facility pins are approximate samples and are not a live capacity feed. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
