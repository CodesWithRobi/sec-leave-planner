# Ticket: Session Persistence & Refresh

## Question

How to store credentials and session data? When to re-fetch?

## Scope

- Store register number in localStorage (not password — that's a security risk)
- Store fetched attendance data with timestamp
- On app load: check if data exists and how old it is
- If data > 24 hours old, prompt "Your data is X hours old. Refresh?"
- Manual refresh button in Settings
- Never store passwords in plaintext — use session tokens if possible

## Depends on

- Auto-fetch implementation (ticket 003)

## Resolution

_Pending_
