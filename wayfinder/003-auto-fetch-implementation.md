# Ticket: Auto-Fetch Implementation

## Question

How to implement the automatic data fetching from learner.saveetha.in?

## Scope

- Fetch slot list: `GET /academics/calculate-my-attendance/slots/?term_id=8`
- Fetch each slot's attendance page: `GET /academics/calculate-my-attendance/?term_id=8&slot_id=X&action=calculate`
- Parse HTML tables to extract sessions
- Compute hours from timing codes (CLS/SWH/MENTOR MEET)
- Build the same JSON structure as the bookmarklet
- Store in localStorage
- Handle errors gracefully

## Depends on

- CORS research (ticket 001)
- Login dialog design (ticket 002)

## Resolution

_Pending_
