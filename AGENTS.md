## Cursor Cloud specific instructions

### Overview

Excalidraw is a Yarn workspaces monorepo with a client-side SPA (no local backend). The only service to run is the Vite dev server.

### Services

| Service | Command | Port | Notes |
| --- | --- | --- | --- |
| Vite dev server | `yarn start` (or `cd excalidraw-app && VITE_APP_ENABLE_ESLINT=false vite --host 0.0.0.0 --no-open`) | 3001 | The `yarn start` script runs `yarn && vite` from excalidraw-app, which re-runs install then starts Vite. Use `--no-open` to skip browser auto-open in headless environments. |

### Key commands

See `CLAUDE.md` and root `package.json` scripts. Summary:

- **Lint:** `yarn test:code`
- **Typecheck:** `yarn test:typecheck`
- **Tests:** `yarn test:update` (runs vitest with snapshot updates, non-watch mode)
- **Auto-fix:** `yarn fix`

### Gotchas

- The Vite dev server defaults to port 3001 (set via `VITE_APP_PORT` env or fallback `3000` in `excalidraw-app/vite.config.mts`). In this environment it consistently binds to **3001**.
- The `vite-plugin-checker` runs ESLint in-process during dev. To speed up dev server startup, pass `VITE_APP_ENABLE_ESLINT=false` as an env variable when starting the server; lint separately with `yarn test:code`.
- Firebase config warnings (`Error JSON parsing firebase config`) in test output are expected — the dev Firebase project config is not required for local development or tests.
- The pre-commit hook in `.husky/pre-commit` is commented out (no-op).
