# Daymark

Daymark is a local-first progressive web app for managing family tasks, tracking completion, and rewarding progress. It is a static site: there is no server, database, account provider, or network API.

## Features

- First-run parent profile setup with a locally stored password hash.
- Parent-created child profiles with quick PIN check-in.
- Family-board view when no profile is checked in.
- Parent-only task and child-account creation.
- Ad hoc, recurring, and task-group task types.
- Start and complete timestamps for assigned tasks.
- Minimum-duration tasks, such as brushing teeth for two minutes.
- Local points, coins, streaks, quests, rewards, and avatar fields ready for future customization.
- Responsive layout and an offline service worker.

## First run

1. Open the app.
2. Create the parent profile and choose a password of at least four characters.
3. Use **People** to create child profiles and assign each child a four-character-or-longer PIN.
4. Use **Add task** to create tasks and assign them to a child.
5. A child selects their profile and enters their PIN to start and complete assigned tasks.
6. Use the profile menu to return to the family board or check in as another profile.

There are intentionally no preloaded profiles, tasks, or rewards. A fresh browser storage namespace starts with the parent setup screen.

## Local data and privacy

All application state is stored in `localStorage` under `daymark-state-v2`. The app does not send data anywhere. Credentials are stored as a small deterministic hash suitable for this local prototype, not as a replacement for server-grade password security. Anyone with access to the browser profile or its developer tools can inspect or remove the data.

To reset the app, remove the `daymark-state-v2` entry from browser storage and reload. This deletes all locally stored profiles, tasks, progress, and rewards.

## Development

The project has no runtime dependencies. Node.js 20 or newer is recommended.

```sh
npm test
npm run check
```

`npm test` runs the domain test suite with Node's built-in test runner. `npm run check` validates the JavaScript syntax for the app, domain core, and service worker.

To serve the PWA locally, use any static server. For example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Test coverage

The tests in `tests/core.test.js` cover:

- Empty first-run state.
- Parent setup validation and password hashing.
- Successful and failed authentication.
- Child account creation and zero starting progress.
- Child PIN authentication.
- Parent-only task creation.
- Assigned-profile-only task start and completion.
- Rewarding points and coins on completion.
- Minimum-duration enforcement.

GitHub Actions runs both `npm test` and `npm run check` for every push and pull request using `.github/workflows/test.yml`.

## GitHub Pages deployment

The app is compatible with GitHub Pages because it is a static site. `.github/workflows/deploy.yml` runs the test and syntax checks, then publishes the repository root with the official Pages actions on every push to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. When serving from a project subpath, the relative asset URLs in `index.html` and `sw.js` continue to work.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | App shell and modal host |
| `styles.css` | Responsive visual design |
| `core.js` | Dependency-free state and permission rules |
| `app.js` | DOM rendering and user interactions |
| `manifest.webmanifest` | Install metadata |
| `sw.js` | Offline app-shell cache |
| `tests/core.test.js` | Domain and permission tests |
| `.github/workflows/test.yml` | Continuous integration |
| `.github/workflows/deploy.yml` | GitHub Pages deployment |

## Current scope

This is a solid local prototype rather than a multi-device family account system. Recurrence scheduling, editable reward catalogs, group child-task composition, and avatar unlocks are represented in the UI model but need further domain work before they are production-complete. A future server-backed version would need a real authentication and synchronization design rather than reusing the local credential approach.
# familytasks
Family tasks
