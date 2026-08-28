# Wayfinder: Frictionless Attendance Import

## Destination

Replace the manual bookmarklet+paste flow with a login dialog. User enters register number + password once → app fetches attendance data automatically → stored in localStorage for future visits.

## Notes

- learner.saveetha.in auth is cookie-based (session cookies)
- Bookmarklet works because it runs on the same origin (learner.saveetha.in)
- Our app is deployed to GitHub Pages (different origin) → CORS blocks direct fetch
- The slot API is: `GET /academics/calculate-my-attendance/slots/?term_id=8`
- The attendance page is: `GET /academics/calculate-my-attendance/?term_id=8&slot_id=X&action=calculate`
- Sessions are extracted by parsing an HTML table from the attendance page

## Decisions so far

1. **CORS & Auth Flow** (ticket 001): ✅ RESOLVED via Playwright. Portal uses OAuth 2.0 + PKCE with HttpOnly session cookies. Anti-CORS headers (`X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`). API works perfectly from within page context — 7 slots, HTML tables parse cleanly.

2. **Chosen approach**: Improve the bookmarklet. The bookmarklet runs inside the authenticated page, sidestepping all CORS/auth issues. Key improvement: auto-copy to clipboard via `navigator.clipboard.writeText()` + textarea fallback, no popup. **Not** a login dialog — CORS makes that impossible from GitHub Pages.

3. **Why not a login dialog?** To fetch data from learner.saveetha.in, you need session cookies. The portal uses OAuth 2.0 + PKCE — you can't just send username/password. Even if you could, CORS blocks the request from a different origin. A backend proxy would work but adds complexity and security risks (storing credentials, session forwarding) for a personal tool.

## Tickets

1. ~~[CORS & Auth Flow Research](wayfinder/001-cors-auth-research.md)~~ ✅ — OAuth 2.0 + PKCE, no CORS, bookmarklet is the way
2. [Improved Bookmarklet — Auto-Copy](wayfinder/002-auto-copy-bookmarklet.md) — Silent clipboard copy, no textarea popup, success toast
3. ~~[Login Dialog Prototype](wayfinder/002-login-dialog-prototype.md)~~ ❌ — Superseded by ticket 002 (CORS makes login dialog impossible)
4. ~~[Auto-Fetch Implementation](wayfinder/003-auto-fetch-implementation.md)~~ ❌ — Superseded by ticket 002 (bookmarklet already does this)
5. ~~[Session Persistence & Refresh](wayfinder/004-session-persistence.md)~~ ❌ — Superseded by ticket 002 (localStorage already persists data)

## Not yet specified

- How to solve CORS: proxy vs backend vs extension
- How to store credentials securely (localStorage vs sessionStorage vs encrypted)
- Session refresh strategy (auto-refetch on login, periodic, manual)
- Error handling for wrong credentials, network failures, portal changes

## Out of scope

- Building a full backend service (prefer edge functions or proxy)
- Supporting multiple universities (only Saveetha)
- Real-time sync (periodic manual refresh is fine)
