# Daymark Agent Guide

## Project overview

Daymark is a static, local-first progressive web app for family task management and rewards. It has no backend, API, database, build step, or runtime dependencies. Browser state is stored in `localStorage`.

The app is intentionally suitable for GitHub Pages. Keep asset URLs relative so it works from a repository subpath.

## Important files

- `index.html`: app shell, navigation, modal host, and script loading order.
- `styles.css`: responsive visual system and layout.
- `core.js`: dependency-free domain rules. It works in both the browser and Node because it exposes `window.DaymarkCore` and `module.exports`.
- `app.js`: DOM rendering, event handlers, forms, and persistence wiring. Keep business rules in `core.js` where practical.
- `manifest.webmanifest`: PWA install metadata.
- `sw.js`: cache-first app-shell service worker. Update `CACHE_NAME` when changing cached assets.
- `tests/core.test.js`: Node test suite for state, authentication, permissions, task timing, and rewards.
- `.github/workflows/test.yml`: CI checks for pushes and pull requests.
- `.github/workflows/deploy.yml`: GitHub Pages deployment from `main`.
- `README.md`: user and contributor documentation.

## Domain invariants

- A fresh install must contain no profiles, tasks, or rewards.
- The first-run parent setup creates exactly one parent profile and requires a password of at least four characters.
- Child profiles are created by the parent and use a PIN of at least four characters.
- Parent credentials use `passwordHash`; child credentials use `pinHash`.
- `activeProfile` is `null` for the family-board view and a profile ID for a checked-in profile.
- Only the parent may create child profiles or tasks.
- A child may start and complete only tasks assigned to that child.
- A task with `min` minutes cannot be completed before the elapsed duration.
- Completion awards the assigned profile 20 points and 2 coins.
- Do not add seed/demo data to the production initial state.

## State and privacy

The current storage key is `daymark-state-v2`. If the state shape changes incompatibly, use a new versioned key or add an explicit migration. Never silently overwrite user data.

Credentials are hashed with a small deterministic local hash for this prototype. This is not server-grade authentication. Do not describe it as secure against someone who can inspect browser storage or developer tools. A future server-backed version needs a new authentication and synchronization design.

## Development workflow

Use Node.js 20 or newer:

```sh
npm test
npm run check
python3 -m http.server 4173
```

Open `http://localhost:4173` for a browser smoke test. To test a fresh install, remove the `daymark-state-v2` entry from browser storage and reload. The service worker may also need to be updated or unregistered when testing cached asset changes.

Before finishing a change:

1. Put new domain behavior in `core.js` and add a focused test in `tests/core.test.js`.
2. Run `npm test` and `npm run check`.
3. Check the first-run setup, parent authentication, child authentication, logout/family-board view, and relevant task lifecycle in a browser when UI behavior changes.
4. Update `README.md` when user-visible behavior, setup, deployment, or limitations change.

## UI conventions

Preserve the existing Daymark visual language: calm green/sage surfaces, warm coral accents, Fraunces headings, DM Sans body text, restrained borders, compact cards, and responsive layouts. Do not replace the static app with a framework or add dependencies without a clear need.

Use the existing modal and toast patterns for short interactions. Keep parent-only controls hidden for standard profiles as well as rejected by the domain core. Empty states should be intentional and explain the next available action.

## Deployment

The deployment workflow runs tests and syntax checks before publishing the repository root with GitHub Pages actions. Repository settings must use **Pages -> Build and deployment -> GitHub Actions**. Do not add server-only assumptions, absolute asset paths, or environment secrets.