# CiviCare requirements freeze

CiviCare (Community Emergency Readiness & Response) is a Chennai-focused academic prototype. Tagline: Prepared communities. Coordinated care.

The blueprint called this idea RESPOND. The implemented product name is CiviCare.

## Problem

A nearby-person list is not the same as readiness. A responder may be unverified, expired, off shift, already assigned, or the only person covering a thin zone. CiviCare stores those constraints in PostgreSQL and compares two allocation policies on identical synthetic scenarios.

## Users

| Role | Can do | Cannot do |
| --- | --- | --- |
| Guest | Call 112, submit a minimal report, read that report’s status with a token, view the facility directory | See responder contacts or exact assignment internals |
| Responder | Register, submit certifications as pending, confirm availability, accept or decline an offer assigned to them | Verify their own certificate or allocate incidents |
| Admin | Review certifications, allocate a pending incident, read readiness and experiments | Be treated as a clinical dispatcher |

Role is read from the database on each request. The client cannot set it.

## In scope

Guest report, responder and admin accounts, skills and certifications, shifts, simulated assignment states, PostGIS distance, nearest-eligible and coverage-aware policies, decision logs, readiness view, experiment comparison, synthetic seed, facility directory with provenance labels.

## Out of scope

Replacing 112, diagnosis, treatment advice, live bed counts, real dispatch, real patient data, Socket.IO, and any claim that a map pin means a facility can accept someone now.

## Assignment states

`offered → accepted | declined | cancelled`

`accepted → en_route | cancelled`

`en_route → arrived | cancelled`

`arrived → completed | cancelled`

`en_route`, `arrived`, and `completed` are simulated labels. The interface must say so.

## Incident statuses

`pending → assigned | no_eligible`

`assigned` or `no_eligible → closed` only through a later admin close, which this version does not expose. Declining an offer returns the incident to `pending` so another allocation can be tried.

## Safety wording that must stay visible

CiviCare is an academic prototype. If this is an emergency, call 112. Do not wait for a community match. A stored report is not a dispatch.
