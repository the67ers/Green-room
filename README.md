# Greenroom tournament brackets

A green HTML/JavaScript bracket manager with server-enforced viewer and admin roles, backed by Sites D1 storage. The existing Site keeps its project identity and access policy.

## Features

- Classic, two-sided, four-region, and round-robin tournaments for up to 100 players (four regions requires four players).
- Elimination brackets handle byes, winner advancement, corrections, undo, and champions.
- Round robin schedules each pairing once, supports chess draws, and calculates standings and shared titles.
- Viewers can inspect brackets, search players, filter rounds, and change display modes. Admins enter a server-configured password to create tournaments, import backups, and edit results.
- Admin sessions use expiring HttpOnly cookies. Every write checks the session and request origin. Password attempts are rate-limited.
- One shared current tournament is saved in D1. Viewers refresh automatically every five seconds while the page is visible. Revision checks prevent competing admins from overwriting each other.
- Legacy browser tournaments can be explicitly restored by an admin using Export → Restore previous browser tournament.

## Structure

`frontend/index.html` contains the original HTML/CSS/JS app. `app/route.ts` serves it. API routes live in `app/api/`; `lib/tournament.js` shares the bracket engine with the server. Database tables and immutable migrations live in `db/` and `drizzle/`.

Configure `ADMIN_PASSWORD` as a Sites secret. For local preview only, place a test value in ignored `.dev.vars`. Never commit a real password.

Use the Sites skill for dependency installation, managed preview, builds, and deployment. Apply migrations to the local preview database as described in the starter tooling. Hosted migrations run during publication.

## Checks

```sh
node tests/engine.test.cjs
node tests/api.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The engine checks all supported player counts. API tests use an isolated Miniflare/D1 environment, never the hosted Site. They verify auth, shared persistence, write protection, conflicts, sign-out, and rate limits.

The hosted app requires its server for shared storage and admin protection. JSON tournament backups remain downloadable; a standalone HTML download does not include the server.

## Vercel

`vercel.json` selects Other (not Next.js), builds the HTML into `vercel-dist`, and deploys the two standalone API functions in `api/`. The original Sites build remains available separately.

The Vercel functions use the existing Sites tournament backend. Production requires `GREENROOM_BACKEND_URL` and `GREENROOM_BACKEND_TOKEN` configured as sensitive server-only Vercel environment variables. Never commit these values or expose them to the browser. A deployment without these variables loads the interface but its API returns 503 until configured.

Run `node scripts/build-vercel.mjs` and `node tests/vercel.test.mjs` to check the Vercel adapter.

## Account management

Signed-in admins can open Accounts to create viewer or admin logins, change roles, enable/disable accounts, reset passwords, and delete accounts. Usernames are case-insensitive and unique. Passwords are stored as salted PBKDF2-SHA256 hashes, not plaintext. Resets, role changes, disabling, and deletion revoke the account's sessions. The original environment-configured admin account remains protected; other admins cannot change their own account from this screen.

The Vercel `api/accounts.js` gateway forwards requests to the existing backend, which authorizes every operation. Account records, hashes, salts, and sessions are never included in the public source repository. Accounts are separate from bracket entrants: making a login does not add a player to a tournament.
