# Asset Calendar

Asset Calendar is a React and TypeScript app built with Vite+.

## Requirements

- Node.js `24.20.0` (the version in `.node-version`)
- npm `11.19.0` (bundled with that Node.js release)

## Local development

Install Vite+ with the official installer, then install the project
dependencies:

```sh
curl -fsSL https://vite.plus | bash
vp install
```

Start the development server:

```sh
vp dev
```

PocketBase is managed separately so the frontend can be started and tested
without any credentials:

```sh
vp run pocketbase
```

This downloads and checksum-verifies PocketBase `0.40.3` into the user's cache,
stores development data in `.local/pocketbase/data/`, applies `pb_migrations/`,
and waits for the loopback health endpoint. To run both processes together, use
`vp run dev:all`.

Configuration is optional. Copy `.env.example` to `.env` and change only
`POCKETBASE_PORT` when another local port is needed. `POCKETBASE_HOST` must
remain a loopback address. The equivalent command-line overrides are
`vp run pocketbase -- --host 127.0.0.1 --port 8091`.

To reset only the current worktree's development data, use the interactive task:

```sh
vp run pocketbase:reset
```

Non-interactive reset requires `--force`:

```sh
vp run pocketbase:reset -- --force
```

Run the quality checks, tests, or production build:

```sh
vp check
vp test
vp build
```

Run the complete non-deployment CI-equivalent check locally:

```sh
vp run ci
```

This runs formatting, linting, type checking, unit and React component tests,
the isolated PocketBase integration tests, and the production build. The
integration harness creates temporary data and loopback ports; it does not use
PocketBase credentials or development data.

PocketBase typegen compatibility is checked against an isolated migration
fixture without using credentials:

```sh
vp run types:compatibility
```

The compatibility check intentionally records the current auth-create failure
in `pocketbase-typegen`; application types are therefore hand-written in
`src/types/pocketbase-types.ts` until the generator supports PocketBase 0.40.3.

If a PocketBase checksum fails, remove the cached PocketBase directory and retry (Linux: `~/.cache/asset-calendar/pocketbase/0.40.3/`, macOS: `~/Library/Caches/asset-calendar/pocketbase/0.40.3/`, or `$XDG_CACHE_HOME/asset-calendar/pocketbase/0.40.3/` if set). A checksum
mismatch is never bypassed, including for cached archives.

The Vite development server keeps its default loopback host. Use `vp preview`
to preview a production build locally.

## Copilot cloud-agent setup

The `copilot-setup-steps` workflow installs the pinned Node.js version,
configures Vite+, caches dependencies, and runs `vp install`. The same `vp`
commands documented above are then available to the cloud agent.
