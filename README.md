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

Copy `.env.example` to `.env` for explicit local authentication defaults. The
launcher also supplies the same safe local defaults when `.env` is absent.
Change `POCKETBASE_PORT` and `ASSET_CALENDAR_POCKETBASE_URL` together when
another local port is needed. `POCKETBASE_HOST` must remain a loopback address.
The equivalent command-line overrides are
`vp run pocketbase -- --host 127.0.0.1 --port 8091`.

Local and CI use `ASSET_CALENDAR_MAIL_TRANSPORT=capture` or `test`; they never
send invitation mail over the network. Capture and test messages stay in the
server-side sink. Invitation links are configured for 30 days
(`ASSET_CALENDAR_INVITATION_LIFETIME_HOURS=720`) and authenticated sessions for
one workday (`ASSET_CALENDAR_SESSION_LIFETIME_HOURS=24`). PocketBase refuses to
start when the authentication configuration is malformed or incomplete.

### Invitation and first-time password setup

Invitations use the server-side `POST /api/invitations` and
`POST /api/invitations/setup` routes. Each invitation stores only a SHA-256
hash of a cryptographically random credential in the private
`user_invitations` collection. The credential is bound to the invited user's
tenant, expires after exactly 720 hours, and is marked used after PocketBase
accepts the submitted password. Password changes go through PocketBase's
normal auth-record validation; no additional composition rules are applied.
The setup route returns PocketBase's normal auth response so the user is signed
in immediately.

The invitation endpoint returns only a generic result. The server builds the
plain-text and HTML message and sends it through SMTP2GO in production; local
and CI transports do not contact a mail provider.

### Tenant host conventions

Tenant context is resolved server-side from the normalized request host. Client
tenant IDs, route parameters, browser storage, and frontend state are not used.
The configured tenant host list must contain exactly one subdomain under the
configured root domain.

- Production: `nejsumlab.frontend-freelance.dk` under
  `frontend-freelance.dk`.
- Local development: `<tenant>.localhost` (for example,
  `tenant.localhost:5173`); local ports are stripped after validation.
- CI/integration tests: use an explicitly configured test host such as
  `tenant.test` or set the request `Host` value directly.

The production host is supplied through `ASSET_CALENDAR_ROOT_DOMAIN` and
`ASSET_CALENDAR_TENANT_HOSTS`; neither value is hard-coded in frontend code.
`X-Forwarded-Host` is ignored unless the request comes from an address listed in
`ASSET_CALENDAR_TRUSTED_PROXY_IPS`. The dedicated sender host
`mail.frontend-freelance.dk` is SMTP infrastructure, not a tenant host.

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

PocketBase typegen compatibility is checked against an isolated migration
fixture without using credentials:

```sh
vp run types:compatibility
```

The compatibility check intentionally records the current auth-create failure
in `pocketbase-typegen`; application types are therefore hand-written in
`src/types/pocketbase-types.ts` until the generator supports PocketBase 0.40.3.

The Vite development server keeps its default loopback host. Use `vp preview`
to preview a production build locally.

## Production deployment

F02 deploys from pushes to `main` through `.github/workflows/ci.yml`. The
workflow runs the checks and build, creates a release containing only `dist`,
`pb_migrations`, `pb_hooks`, and the checksum-verified Linux PocketBase binary,
then waits for approval from the GitHub `production` environment.

The VPS keeps releases under `/opt/asset-calendar/releases` and production
data under `/opt/asset-calendar/shared/pb_data`. PocketBase runs as the
`assetcalendar` service account on `127.0.0.1:8090`; Nginx serves the SPA and
proxies `/api/`. The public PocketBase administration UI at `/_/` is blocked.
The [production bootstrap contract](docs/production-bootstrap-contract.md)
defines the manual tenant, organizational-unit, and administrator prerequisite
for the existing host `nejsumlab.frontend-freelance.dk`.

### One-time VPS installation

After copying the files in `deploy/` to the VPS, install them as root:

```sh
sudo install -o root -g root -m 0755 deploy/asset-calendar-activate.sh /usr/local/sbin/asset-calendar-activate
sudo install -o root -g root -m 0644 deploy/asset-calendar.service /etc/systemd/system/asset-calendar.service
sudo install -o root -g root -m 0440 deploy/asset-calendar.sudoers /etc/sudoers.d/asset-calendar
sudo visudo -cf /etc/sudoers.d/asset-calendar
sudo systemctl daemon-reload
sudo systemctl enable asset-calendar
```

Create `/etc/asset-calendar/auth.env` separately on the VPS. It must be owned by
`root:assetcalendar` with mode `0640`, must not be committed or placed in a
release directory, and must contain the production values for
`ASSET_CALENDAR_ENV=production`, `ASSET_CALENDAR_ROOT_DOMAIN`,
`ASSET_CALENDAR_TENANT_HOSTS` (comma-separated),
`ASSET_CALENDAR_POCKETBASE_URL`, `ASSET_CALENDAR_INVITATION_URL`,
`ASSET_CALENDAR_INVITATION_LIFETIME_HOURS=720`,
`ASSET_CALENDAR_SESSION_LIFETIME_HOURS=24`, and
`ASSET_CALENDAR_MAIL_TRANSPORT=smtp2go`. It must also contain the SMTP2GO
host, port, username, password, and sender variables named
`ASSET_CALENDAR_SMTP2GO_HOST`, `ASSET_CALENDAR_SMTP2GO_PORT`,
`ASSET_CALENDAR_SMTP2GO_USERNAME`, `ASSET_CALENDAR_SMTP2GO_PASSWORD`, and
`ASSET_CALENDAR_SMTP2GO_FROM`. PocketBase validates this file before becoming
healthy and fails closed without logging secret values.

The production release contains only `dist`, `pb_migrations`, `pb_hooks`, the
checksum-verified Linux PocketBase binary, and release metadata. The activation
script validates those inputs, applies `pb_migrations` to
`/opt/asset-calendar/shared/pb_data`, and only then switches
`/opt/asset-calendar/current` and starts the systemd service. If activation or
the loopback health check fails, it restores the previous release symlink and
restarts the previous service. This protects the running release, but does not
reverse a database migration; database rollback requires the operator's backup
and recovery procedure.

### Production bootstrap and mail prerequisite

The operator manually provisions one tenant with subdomain `nejsumlab`, one
organizational unit for that tenant, and one active administrator before
production onboarding is ready. F03 never guesses or duplicates these records
and does not provide tenant onboarding. Migrations preserve existing records;
missing or ambiguous relations are not auto-selected. See the
[production bootstrap contract](docs/production-bootstrap-contract.md) for the
stable lookup keys and readiness rules.

SMTP2GO account approval, sender-domain SPF/DKIM and DMARC DNS, protected VPS
configuration, and an operator-controlled invitation smoke test are manual
prerequisites. The completed [F03-T00 issue #30](https://github.com/cbtgit/asset-calendar/issues/30)
tracks that work. Do not copy SMTP credentials or production delivery data into
this repository. `mail.frontend-freelance.dk` is the SMTP sender host, not a
tenant host.

Nginx must be able to traverse the release path while PocketBase data remains
private:

```sh
sudo chmod 0755 /opt/asset-calendar/releases
```

Install the Nginx file only after a first release exists:

```sh
sudo install -o root -g root -m 0644 deploy/nejsumlab.frontend-freelance.dk.nginx /etc/nginx/sites-available/nejsumlab.frontend-freelance.dk
sudo nginx -t
sudo systemctl reload nginx
```

The deploy account can administer PocketBase through an SSH tunnel without
publishing `/_/`:

```sh
ssh -L 8090:127.0.0.1:8090 assetdeploy@nejsumlab.frontend-freelance.dk
```

Then open `http://127.0.0.1:8090/_/` locally. Do not expose port `8090` in the
VPS firewall.

## Copilot cloud-agent setup

The `copilot-setup-steps` workflow installs the pinned Node.js version,
configures Vite+, caches dependencies, and runs `vp install`. The same `vp`
commands documented above are then available to the cloud agent.
