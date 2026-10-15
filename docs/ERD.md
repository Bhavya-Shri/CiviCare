# CiviCare entity relationships

```mermaid
erDiagram
  users ||--o| responders : "optional login"
  organisations ||--o{ responders : affiliates
  zones ||--o{ responders : "base zone"
  responders ||--o{ responder_skills : has
  skills ||--o{ responder_skills : catalog
  responders ||--o{ certifications : holds
  skills ||--o{ certifications : "for skill"
  users ||--o{ certifications : reviews
  responders ||--o{ shifts : works
  zones ||--o{ incidents : "optional zone"
  incidents ||--o{ assignments : attempts
  responders ||--o{ assignments : "offered to"
  incidents ||--o{ incident_events : history
  assignments ||--o{ assignment_events : history
  incidents ||--o{ allocation_decision_logs : explains
  zones ||--o{ readiness_snapshots : "optional snapshot"
  experiment_runs ||--o{ experiment_results : metrics
  facilities ||--o{ facility_capabilities : lists
```

Guest reports have no `users` row. They are identified by `incidents.public_token`.

`responder_skills` is the catalogue link. Eligibility uses `certifications`, not the bridge table alone. A skill without a verified, in-date certification does not make a responder eligible.
