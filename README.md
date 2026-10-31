# Odoo Subscription Management — One-day GitHub Contribution Portal

Target repository: `Hem1234567/Odoo_Subscription_Management`

Session date: **31 October 2026**. Scheduled preparation: **3:00 PM IST**. Finalization: **4:55 PM IST**.

## Contributor and package assignment

| GitHub account | ZIP package(s) | Branch |
|---|---|---|
| `VIKAS-KUMAR-10` | Frontend Part 1 — core/shared foundation; Frontend Part 2 — screens/components | `auto/frontend` (both submissions push to this one branch) |
| `Sanjana-2306` | Backend | `auto/backend` |
| `Hem1234567` | COBOL, database, infrastructure, docs, scripts, tests and root config | `auto/cobol-database` |

The two frontend ZIPs contain disjoint paths and both are submitted by VIKAS-KUMAR-10 to the same branch. They are separately downloadable and separately uploadable.

## Important current-state facts

This is a prepared portal package, **not a live deployment**. No GitHub App, OAuth app, hosting service, Redis instance, repository secrets, or Actions workflows have been configured by this ZIP. The target repository currently has its own README; this portal does not overwrite it. The source packages are read from `Hem1234567/odoo-demo` (`SOURCE_REF=main`).

## One-time setup required before 3:00 PM

1. Create a GitHub App and install it only on `Odoo_Subscription_Management`. Permissions: Contents read/write, Pull requests read/write, Checks read, Metadata read. Enable user authorization.
2. Create a GitHub OAuth client and set callback URL to `https://YOUR-PORTAL-DOMAIN/auth/github/callback`.
3. Deploy this Node.js portal on HTTPS with a persistent Redis service. Fill `.env` with the App ID, private key, installation ID, OAuth client ID/secret, HTTPS BASE_URL, SESSION_SECRET and REDIS_URL. Never commit `.env`.
4. Copy `.github/workflows/contribution-ci.yml` and `.github/workflows/contribution-session.yml` into the target repo and push to `main`.
5. Add repository Actions secrets `CONTRIBUTION_APP_ID` and `CONTRIBUTION_APP_PRIVATE_KEY`.
6. Ensure Actions are enabled and `main` is the default branch.
7. Confirm source repo access and the three GitHub usernames. The portal allowlist is exact.

## How the one-day flow works

- 3:00 PM IST: scheduled workflow creates `auto/frontend`, `auto/backend`, `auto/cobol-database` from `main`.
- Contributors sign in once, download their assigned ZIP(s), modify the code, and upload each completed ZIP.
- The bot validates every ZIP path and rejects files outside the assigned package, path traversal and secret files. It commits to the assigned branch and opens/updates a PR.
- 4:55 PM IST: the finalizer combines all three contributor branches into a temporary integration branch, verifies both frontend package areas plus backend and COBOL files exist, installs dependencies, runs the complete build and tests, then opens one integration PR to `main`. Only if that PR's required checks pass does the bot merge it. If any pre-merge step fails or conflicts occur, `main` is not changed.
- A `main` push triggers full build and test. This validates the integrated result after merge.

GitHub scheduled workflows can be delayed under load. Therefore the 3:00 PM and 4:55 PM schedule times are targets, not guaranteed exact execution times. Contributors must submit before finalization begins.

## Run portal

```bash
cp .env.example .env
# Complete every secret and URL in .env
npm install
npm start
```

For production, HTTPS and Redis-backed sessions are required. OAuth login is only needed initially per contributor session; the portal session remains valid for up to 30 days unless the user logs out, clears browser data, the session expires, or authorization is revoked.

## Safety

- Bot commits are attributed to the GitHub App, not impersonated contributors.
- Branches are isolated; the bot never pushes directly to `main`.
- The finalizer builds and tests a temporary combined integration branch before opening a single PR. It never pushes contribution commits directly to `main`.
- The finalizer uses one integration PR rather than merging contributor branches sequentially. A failed integration build or conflict leaves `main` unchanged.
- Do not expose GitHub App private keys or OAuth client secrets.
- The CI build assumes the root project package.json and all source folders have been migrated into the destination repository by the contribution PRs.
