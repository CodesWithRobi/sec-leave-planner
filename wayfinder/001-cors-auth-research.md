# Ticket: CORS & Auth Flow Research ✅ RESOLVED

## Question

How does learner.saveetha.in handle authentication and CORS? Can our GitHub Pages app fetch data directly, or do we need a proxy/backend?

## Answer

**Direct fetch is impossible.** The portal uses:
- OAuth 2.0 + PKCE (Authorization Code flow with code_challenge)
- HttpOnly session cookies (14-day expiry)
- Zero CORS headers — actively blocks cross-origin with `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`

**Chosen approach: Improve the bookmarklet.** It runs inside the authenticated page context, sidestepping all CORS/auth issues. No proxy, no credentials stored, no infrastructure needed.

### Alternatives rejected
- Cloudflare Worker proxy: Would need to forward session cookies (security risk), 10ms CPU limit too tight for OAuth chains
- Browser extension: Works but requires users to install it
- allorigins.win: Unreliable, can't handle auth flows
