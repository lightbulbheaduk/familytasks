# Daymark

Daymark is a local-first progressive web app for organizing family tasks and celebrating progress. It is a static site: there is no server, database, account provider, or synchronization service.

## What works today

- **Setup and profiles:** Create one parent profile with a password of at least four characters. The parent can create child profiles with PINs of at least four characters, customize profile initials and colors, delete a child, and switch between profiles or the family board. Deleting a child also deletes their assigned tasks and activity history.
- **Task management:** The parent can create and delete ad hoc tasks, recurring tasks, task groups, and recurring task groups, assigning them to a child. Group items share a target and earliest-start time and can have different minimum durations.
- **Schedules and timing:** Recurrence can be daily or weekly, with an interval and selected weekdays for weekly schedules. Tasks cannot be started before their earliest-start time or recurring target calendar day. Minimum durations are enforced before completion.
- **Task board:** The family dashboard shows available outstanding tasks in child columns. The **All tasks** tab includes completed tasks and assignees in the family view. Unstarted tasks scheduled more than an hour away are hidden until they enter that window; a disabled Start button and countdown appear while waiting.
- **Task actions:** A child can start and complete only their assigned tasks. From the family board or parent view, the parent can record a task action by entering that child's PIN without switching profiles.
- **Progress:** Each task completion awards 20 points and 2 coins. Recurring tasks retain completion history and advance to their next occurrence; a recurring group advances together after all its items are complete.
- **Stats:** Each child has a Stats view showing wins and points in the last seven days, active days, a current streak, all-time wins, and a seven-day activity chart. The family board and parent view show stats for all children. Older task completion records are used to populate history where possible.
- **Local-first PWA:** State is stored in browser `localStorage`; the service worker caches the app shell for offline use. The responsive interface is designed to work on tablets in portrait orientation.

There are no preloaded profiles, tasks, or rewards on a fresh install.

## First use

1. Open the app and create the parent profile.
2. On **People**, add a profile for each child and choose a PIN.
3. Use **Add task** to create and assign tasks, groups, or schedules.
4. Choose a child in the profile menu and enter their PIN to check in. They can start and complete their assigned tasks.
5. Return to the family board from the profile menu to see children's tasks together, or open **Stats** to review progress.

## Current limitations

- **Rewards are not implemented yet.** The Rewards tab is a placeholder: there is no reward editor, points/coins cannot be spent, and the Redeem control only adds a reward to a wishlist toast. The Settings control is also a placeholder.
- There is no multi-device sync, server-side account, parent recovery flow, or secure authentication. Credentials use a small deterministic local hash; anyone with access to the browser profile or developer tools can inspect or remove local data.
- Stats are based on task completions recorded by this app. They are motivational summaries, not a measure of a child's overall behaviour. Existing completed timestamps and recurring-task histories provide best-effort history for older data.

## Local data and privacy

All app state is stored in `localStorage` under `daymark-state-v2`; the app does not send it to a server. New task completions are retained on the child profile so deleting a task does not erase its past wins. Existing task records are used to backfill history where available.

To reset the app, remove the `daymark-state-v2` entry from browser storage and reload. This permanently deletes the profiles, tasks, progress, and rewards stored in that browser.

## Development and tests

The project has no runtime dependencies. Node.js 20 or newer is recommended.

```sh
npm test
npm run check
```

`npm test` runs the domain tests in `tests/core.test.js` with Node's built-in test runner. They cover:

- Fresh state, parent setup validation, password hashing, and profile authentication.
- Parent-only child/task management and assigned-child task permissions.
- Task creation and deletion, child deletion with assigned-task cleanup, and retained completion history.
- Earliest-start and recurring-day start boundaries, minimum completion durations, and task availability.
- Task-group timing, per-item minimums, daily/weekly recurrence, intervals, and recurring-group advancement.
- Completion points/coins and stats calculations, including legacy history and weekly activity.

`npm run check` syntax-checks `core.js`, `app.js`, and `sw.js`. GitHub Actions runs both commands on pushes and pull requests.

There are no automated browser/UI, accessibility, install, or offline smoke tests yet. Before a v0.1 release, manually verify first-run setup, parent and child check-in, family-board actions with a child PIN, task timing/countdowns, task and child deletion, stats in family and child views, and the app at tablet portrait size. Also test a fresh install and offline reload in a browser; clear or unregister the service worker when checking cache updates.

To serve the app locally:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages deployment

The app is compatible with GitHub Pages. `.github/workflows/deploy.yml` runs tests and syntax checks, then publishes the repository root on pushes to `main`. In repository settings, choose **Pages → Build and deployment → Source → GitHub Actions**. Keep asset URLs relative so the app also works from a repository subpath.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | App shell, navigation, and modal host |
| `styles.css` | Responsive visual design |
| `core.js` | Dependency-free state, permissions, task rules, and stats |
| `app.js` | Rendering, forms, interactions, and local persistence |
| `manifest.webmanifest` | PWA install metadata |
| `sw.js` | Offline app-shell cache |
| `tests/core.test.js` | Domain and permission tests |
| `.github/workflows/test.yml` | Continuous integration |
| `.github/workflows/deploy.yml` | GitHub Pages deployment |

This is a local prototype, not a multi-device family account system. Any future server-backed version needs a new authentication and synchronization design rather than reusing the local credential approach.
