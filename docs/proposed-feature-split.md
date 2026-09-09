# Asset Calendar Proposed Feature Split

**Status:** Proposal
**Last updated:** 2026-09-07
**Source:** [Product requirements](./product-requirements.md)

## 1. Purpose

This document proposes an implementation sequence for the Asset Calendar MVP.
It defines features rather than individual development tasks. Each feature is a
meaningful, demonstrable increment that can later be decomposed into small
agent-ready tasks.

The sequence deliberately establishes deployment immediately after the
application foundation. This makes it possible to deploy an early application
shell to the VPS and validate the production architecture before most product
features are implemented.

## 2. Planning principles

- Features are ordered by technical and product dependency.
- A feature should not start until the contracts supplied by its dependencies
  are stable.
- Frontend restrictions are never treated as authorization. PocketBase must
  independently enforce tenant, role, ownership, and protected-field rules.
- PocketBase schema changes are delivered as version-controlled migrations.
- PocketBase hooks are used for validation involving multiple records, trusted
  server-derived values, old and new record state, or role-aware responses.
- TanStack Router is the routing authority.
- TanStack Query is the PocketBase-backed server-state authority.
- Deployment is established early and hardened progressively.
- Production data is never stored inside a release directory and is never used
  by local development, CI, or agent environments.

## 3. PocketBase terminology

- **Collection:** PocketBase's equivalent of a database table. It defines
  fields, relationships, validation, and indexes.
- **Auth collection:** A collection with PocketBase authentication and session
  capabilities.
- **Migration:** Version-controlled code that creates or changes PocketBase
  schema consistently across environments.
- **Collection rule:** An authorization expression that controls whether a
  request may list, view, create, update, or delete records.
- **Hook:** Server-side code that runs during a request or record lifecycle.
  Hooks cover rules that cannot safely be expressed as collection rules.
- **Server-authoritative validation:** Validation performed by PocketBase even
  when the React application has already validated the same input.
- **Projection:** A response containing only fields the caller is authorized to
  receive. This is important for rates and private maintenance information.
- **Historical snapshot:** A value copied onto a booking at creation so later
  changes to related records do not rewrite invoicing history.

## 4. Dependency overview

```text
F01 Application foundation and isolated runtime
 └─> F02 Initial VPS deployment and continuous delivery
      └─> F03 Tenant isolation, authentication, and password lifecycle
           ├─> F04 Organizational-unit administration
           │    └─> F06 Tenant user administration
           └─> F05 Resource administration
                └─> F07 Calendar navigation and resource selection

F04 + F05 + F06 + F07
 └─> F08 Regular booking creation and visibility
      ├─> F09 Booking editing and deletion
      └─> F10 Administrative, training, and maintenance bookings

F07 + F08 + F09 + F10
 └─> F11 Mobile and accessible booking experience

F08 + F09 + F10
 └─> F12 Invoicing exports

F01-F12
 └─> F13 Production hardening and complete system validation
```

Deployment work begins in F02. F13 does not introduce deployment for the first
time; it verifies and hardens the deployment path already used throughout
development.

## 5. Proposed features

### F01 - Application foundation and isolated runtime

**Can start:** Immediately

**Depends on:** None

**Blocks:** All other features

#### Description

Establish the shared frontend, PocketBase, and test foundations. The result is
a reproducible development environment rather than a manually configured local
application.

The frontend uses the existing pinned Vite+ 0.3.0, Node.js 24.20.0, and npm
11.19.0 toolchain. It adds Tailwind CSS, shadcn/ui, TanStack Router, TanStack
Query, and the PocketBase JavaScript SDK. F01 configures shadcn/ui but does not
generate unused components. It provides:

- File-based routing with a generated, committed typed route tree.
- A single QueryClient with conservative query retries, no automatic mutation
  retries, no initial refetch-on-window-focus behavior, and query-specific stale
  times.
- Typed query-key factories grouped by domain.
- A hand-written API layer that owns PocketBase calls and TanStack Query
  options and mutations. React components do not call the PocketBase SDK
  directly.
- A small application-error contract that classifies validation, unauthorized,
  not-found, conflict, network, and server failures while retaining the
  original cause for diagnostics.
- A minimal index route that checks PocketBase once on load and displays
  `Connected`, `Checking`, or a clear connection failure with a manual retry.

F01 does not create speculative shared loading, empty, error, unauthorized, or
not-found components. Those components are introduced by the first product
features that exercise them. It also does not integrate the Ilamy calendar,
which remains part of F07.

Frontend code is organized primarily by technical layer: `routes/`,
`components/`, `hooks/`, `api/`, `types/`, and `lib/`. Tests are colocated with
the files they cover. The `api/` layer owns server-state access; `hooks/` is for
reusable React behavior that is not server state. Route files remain thin.

The runtime pins PocketBase 0.40.3. A committed manifest records checksums for
macOS and Linux on x64 and arm64. Shared scripts download the exact archive,
verify its checksum, and cache the verified binary outside Git. All F01
PocketBase processes bind only to loopback; non-loopback bind addresses are
rejected.

Custom project tasks use Vite+'s `vp run` interface. The runtime provides a
PocketBase-only task and a combined frontend-and-PocketBase development task.
Startup ensures the binary is present and verified, applies migrations, waits
for the health endpoint, and fails clearly if the configured port is occupied.
Interactive development defaults to `127.0.0.1:8090`, with an explicit
environment override. Vite+ proxies PocketBase's native `/api/` and `/_/` paths
so browser code uses the application origin rather than an environment-specific
backend origin.

Each worktree stores persistent development data in its own ignored
`.local/pocketbase/data/` directory. Tests use fresh operating-system temporary
directories and dynamically allocated ports per worker. Verified binaries use
the user's platform cache. Scripts resolve and validate these locations rather
than accepting arbitrary data paths. An explicit worktree-scoped reset task
shows the resolved directory and requires confirmation; non-interactive use
also requires an explicit force flag. Normal startup never deletes local data.

PocketBase discovers production-bound migrations and hooks from the conventional
repository-root `pb_migrations/` and `pb_hooks/` directories. Integration-only
fixtures remain under `tests/fixtures/` and must not enter the production build
or normal development database. F01 workflows require no PocketBase superuser
credentials. A committed `.env.example` documents only safe, non-secret
configuration, and startup validates configured values.

F01 evaluates `pocketbase-typegen` against PocketBase 0.40.3, TypeScript 7, and
the selected PocketBase JavaScript SDK. The compatibility check uses a
representative migration-built isolated database and must verify supported
field, auth, relation, create, and update types as well as deterministic output.
The generator is adopted only if it works unmodified. If adopted, generated
types are committed, never edited manually, and regenerated in CI to detect
drift. If the check fails, F01 uses hand-written compile-time types and records
the deferred generator decision; F01 does not fork or patch the generator.
Runtime response validation is not introduced in this feature.

The existing Vite+ test runner covers unit and React component tests and starts
the real pinned PocketBase binary for integration tests. A rendered integration
harness under the Router and QueryClient providers uses an integration-only
collection to perform a typed query and mutation, observes the cache-backed UI
update, and verifies the stored record. The harness and fixture code are
excluded from the production module graph. Browser end-to-end tests remain
deferred.

F01 adds non-deployment CI for pull requests and `main`. CI uses locked
dependencies, verifies PocketBase 0.40.3, and runs formatting, linting, type
checking, unit/component tests, the isolated PocketBase integration test, and a
production frontend build. The executable CI matrix runs on Linux x64; the
platform resolver and checksum manifest still cover the supported macOS/Linux
x64/arm64 installer targets. Deployment remains part of F02.

#### PocketBase meaning and rationale

PocketBase stores schema and data in its runtime environment. Manually creating
collections through the administration UI would cause environments to drift.
Migrations are required so a clean checkout, CI, and production can construct
the same schema.

Pinning PocketBase is required because migration, hook, rule, and SDK behavior
may vary by version. Isolated data directories prevent tests and development
tools from reading or altering production data.

#### Completion outcome

A clean checkout can use the documented `vp` commands to start the minimal SPA
and an isolated, migration-ready PocketBase 0.40.3 instance. The index route
reports backend health through the typed API and TanStack Query boundaries. The
rendered integration harness proves a typed query and mutation against a real
ephemeral PocketBase instance without shipping fixture behavior in production.
The complete non-deployment CI pipeline passes on Linux x64, generated types
are current if the compatibility gate adopted `pocketbase-typegen`, and local,
test, agent, and future production data paths cannot overlap through the F01
scripts.

---

### F02 - Initial VPS deployment and continuous delivery

**Can start:** When F01 produces a static build and pinned PocketBase runtime

**Depends on:** F01

**Blocks:** F03 because production tenant resolution depends on the real proxy
and host model

#### Description

Establish a minimal production deployment early. The initial release may only
serve the application shell, but the same deployment path will carry every
later feature.

The feature includes:

- A production Vite build.
- A dedicated VPS service and deployment user.
- Versioned release directories.
- A persistent PocketBase data directory outside releases.
- A pinned PocketBase binary managed by `systemd`.
- PocketBase bound to a local-only interface.
- Nginx static-file serving and SPA fallback for TanStack Router.
- Nginx proxying for PocketBase.
- HTTPS and tenant-subdomain handling.
- A GitHub Actions workflow triggered after changes reach `main`.
- Build and test execution before upload.
- SSH host verification and restricted deployment credentials.
- Atomic switching of a `current` release symlink.
- PocketBase restart and basic health checks.
- Retention of at least one previous release.
- Manual production-environment approval during the initial rollout period.

#### PocketBase meaning and rationale

PocketBase data must live in a shared persistent directory such as
`/opt/asset-calendar/shared/pb_data`. Replacing a release must never replace the
database.

PocketBase must listen only on localhost. Nginx remains the public boundary for
TLS, host validation, static assets, and API proxying. PocketBase rules and
hooks still enforce authorization because Nginx cannot replace application
security.

Deploying early validates the real host and proxy assumptions used by tenant
resolution. It also reveals systemd, Nginx, certificate, path, permission, and
SPA-routing problems before the application becomes large.

#### Completion outcome

Merging approved changes to `main` builds and deploys the current application
to the VPS. Nginx serves the SPA, PocketBase responds through the proxy, its
direct port is not public, and a failed health check marks deployment as
failed.

#### Missing decisions

- VPS operating system and version.
- Domain and wildcard-certificate arrangement.
- Service and deployment usernames.
- Installation, release, data, and log paths.
- SSH secret-management approach.
- Whether builds occur only in CI or may also occur on the VPS.
- Initial health-check URL.
- Release-retention count.
- Whether the PocketBase administration UI is reachable in production.

---

### F03 - Tenant isolation, authentication, and password lifecycle

**Can start:** After the migration foundation and production host model exist

**Depends on:** F01 and F02

**Blocks:** F04, F05, F06, F07, F08, and F12

#### Description

Implement tenant-aware authentication and first-time password setup. Tenant
identity comes from the trusted host or subdomain and cannot be selected by
request parameters or body fields.

The production tenant, initial organizational unit, and initial administrator
already exist and are outside the application workflow. F03 includes sign-in,
sign-out, inactive-user rejection, invitation email delivery, one-time password
setup, SMTP configuration, and public and protected routes.

Invitation links are valid for 30 days and can be used once. Normal authenticated
sessions last one workday and survive page reloads. The MVP has no public
registration, public password recovery, email verification, MFA, OAuth, custom
roles, or token-revocation system. Passwords use PocketBase's built-in
validator without additional application-specific composition rules.

For the MVP's soft deactivation policy, a deactivated user cannot sign in or
start new protected actions, but an already-issued token is not revoked and an
existing browser session is not forcibly signed out before normal expiry.

#### PocketBase data and backend behavior

Migrations create:

- A tenant collection with a unique subdomain.
- A user auth collection with tenant, name, role, organizational unit, active
  status, and first-time password setup state.

Collection rules restrict every user operation to the authenticated user's
tenant and prevent regular users from changing protected fields.

Server hooks or trusted request middleware:

1. Derive the tenant from trusted host information.
2. Reject unknown tenant hosts.
3. Compare the authenticated user's tenant with the resolved tenant.
4. Ignore or reject client-supplied tenant overrides.
5. Recheck active status for protected operations.

Production invitation delivery uses Brevo's authenticated SMTP relay. Local
development and CI use a mail capture or test sink. SMTP credentials remain in
protected VPS/PocketBase configuration and never enter the SPA.

#### Why backend enforcement is needed

React route guards improve navigation but are not a security boundary. A user
can call PocketBase directly with their authentication token. PocketBase must
reject cross-tenant and inactive-user requests even when the SPA is bypassed.

SMTP credentials remain server-side. Invitation responses must not disclose
whether an email address exists.

#### Completion outcome

A user authenticates only through the correct tenant host, cannot access
another tenant, and completes password setup through their invitation before
normal application access. The existing tenant administrator can create a user
and the user can receive and complete the invitation flow.

#### Missing decisions

None for the F03 MVP contract. Implementation details may be chosen in sympathy
with the existing PocketBase and frontend patterns.

#### Manual production prerequisite

This is an operator task, not an application feature:

- Create and approve the Brevo account.
- Verify a dedicated sender domain such as `mail.frontend-freelance.dk`.
- Publish Brevo's SPF and DKIM DNS records.
- Publish a DMARC record for the sender domain.
- Store SMTP credentials only in protected VPS/PocketBase configuration.
- Send a smoke-test invitation to an operator-controlled address.

The VPS does not run an inbound SMTP service and does not expose an SMTP relay.

#### Agent-ready task sequence

The following tasks keep F03 small enough for separate agent assignments:

1. **F03-T01 - Authentication configuration contract**
   Define safe environment-variable names and validation for the application
   root domain, tenant hosts, PocketBase URL, Brevo settings, invitation URL,
   and the 30-day invitation and one-workday session durations. Update the
   example environment and deployment documentation without adding secrets.

2. **F03-T02 - Tenant host resolution**
   Resolve the tenant from the trusted host, reject root and unknown tenant
   hosts generically, and ignore or reject client-supplied tenant IDs. Cover
   production, local, and test host conventions.

3. **F03-T03 - Tenant and user schema migration**
   Create or reconcile the migration-backed tenant and auth-user schema,
   including tenant, name, globally unique email, role, active state,
   organizational unit, and password-setup state. Preserve the existing
   production tenant and administrator rather than creating duplicates.

4. **F03-T04 - PocketBase authentication enforcement**
   Add collection rules and hooks or trusted middleware for same-tenant access,
   role protection, inactive-user rejection, server-derived tenant assignment,
   and protected-field handling. Do not add token revocation.

5. **F03-T05 - Invitation and password setup**
   Implement the server-side one-time invitation flow with a 30-day lifetime.
   Reject expired and reused links, prevent sign-in before setup, sign the user
   in after successful setup, and rely on PocketBase's built-in password
   validator. Do not add custom password composition rules.

6. **F03-T06 - Brevo mail integration**
   Configure production PocketBase email delivery through Brevo. Provide a
   local capture/log sink and deterministic CI test sink. Keep all credentials
   server-side and return generic invitation responses.

7. **F03-T07 - Plain authentication UI**
   Add the plain sign-in and password-setup routes, sign-out action, protected
   route redirect, and clear generic handling for invalid credentials, invalid
   setup links, inactive users, and unknown tenant hosts. Do not add branding,
   tenant selection, or a password-strength meter.

8. **F03-T08 - PocketBase session integration**
   Persist the PocketBase auth state across reloads, refresh valid state during
   startup, clear it on sign-out, and handle authorization failures by clearing
   local state and returning to sign-in. Configure the one-workday session
   lifetime without a custom session table.

9. **F03-T09 - Focused authentication tests**
   Test host resolution, cross-tenant access, sign-in, inactive users,
   invitation expiry and one-time use, built-in password validation, route
   guards, session persistence, sign-out, and mail-sink behavior.

10. **F03-T10 - Documentation and deployment reconciliation**
    Record the Brevo DNS/VPS prerequisite, existing tenant provisioning
    boundary, environment conventions, and F03 acceptance criteria in the
    project documentation.

---

### F04 - Organizational-unit administration

**Can start:** When tenant-scoped administrator authorization is stable

**Depends on:** F03

**Blocks:** F06 and organizational-unit booking snapshots in F08

#### Description

Allow administrators to list, create, rename, and delete organizational units
within their tenant. Every user belongs to exactly one unit.

The frontend provides typed administration routes, accessible forms, and
TanStack Query operations with consistent invalidation.

#### PocketBase data and backend behavior

A migration creates the organizational-unit collection with a required,
immutable tenant relationship, name, timestamps, and tenant-scoped unique-name
index.

Collection rules limit writes to same-tenant administrators. Before deletion, a
server hook queries users assigned to the unit and rejects deletion when any
remain.

#### Why the backend check is needed

A disabled delete button can be bypassed with a direct API request. The state
may also change between a frontend availability check and deletion. PocketBase
must make the final decision immediately before deleting the unit.

Bookings later store the unit name as a snapshot. Renaming or deleting an
unused unit therefore does not rewrite historical exports.

#### Completion outcome

Administrators can manage same-tenant units, while assigned and cross-tenant
units remain protected.

#### Missing decisions

- Case and whitespace normalization for names.
- Minimum and maximum name lengths.
- Whether the manually created initial unit may be deleted once unused.
- Whether regular users can read units directly or only through safe
  projections.

---

### F05 - Resource administration and permanent archival

**Can start:** When tenant-scoped administrator authorization is stable

**Depends on:** F03

**Blocks:** F07 and F08

#### Description

Allow administrators to maintain tenant resources, regular rates, training
rates, and permanent archival state.

The frontend provides resource administration, rate fields, archive
confirmation, active-resource selection data, and TanStack Query invalidation.
Regular users never receive rates.

#### PocketBase data and backend behavior

A migration creates a tenant-owned resource collection with name, regular rate,
training rate, archival state, timestamps, and a tenant-scoped unique-name
index.

Backend rules and hooks enforce:

- Same-tenant administrator writes.
- Required non-negative DKK rates with no more than two decimal places.
- Permanent one-way archival.
- Rejection of new bookings for archived resources.
- Protection of rate fields from regular users.

#### Why a safe resource response is needed

Hiding rates in React is insufficient if raw PocketBase records still contain
them. Regular-user resource requests must return a projection without rate
fields, or direct access to rate-bearing records must be denied and replaced
with a safe custom endpoint or view.

Archival is used instead of deletion because bookings retain resource
relationships. A resource-name snapshot protects historical exports from later
renames.

#### Completion outcome

Administrators can manage resources and rates. Archived resources reject new
bookings, existing bookings remain usable, and regular users cannot retrieve
rates.

#### Missing decisions

- Exact decimal storage strategy and maximum rate.
- Resource-name normalization and length.
- Whether a resource with future bookings may be archived.
- Where archived resources remain visible.
- Whether archived resources may still be renamed.

---

### F06 - Tenant user administration and administrator protection

**Can start:** When authentication and organizational units are stable

**Depends on:** F03 and F04

**Blocks:** F08 and F10

#### Description

Allow administrators to create and manage tenant users while retaining booking
history and always preserving at least one active administrator.

The feature includes user listing, creation, unit assignment, role changes,
deactivation, invitation email delivery, password setup, and active-user
selection data.

#### PocketBase data and backend behavior

The auth collection requires a tenant, organizational unit, normalized globally
unique email, role, active status, and password-setup state.

A creation hook derives the tenant server-side, verifies the selected unit is
in that tenant, normalizes the email, and sends the invitation email with a
one-time password-setup link.

Before demotion or deactivation, a hook counts the other active administrators
in the tenant and rejects the operation if none remain.

Deactivation preserves the user and bookings but excludes that user from new
booking selectors and booking creation.

#### Why hooks are needed

Last-administrator protection depends on multiple records and current database
state. UI controls cannot safely enforce it, especially under concurrent or
direct requests. Tenant assignment must also come from trusted server context
rather than a submitted tenant ID.

#### Completion outcome

Administrators can manage same-tenant users without privilege escalation,
cross-tenant assignment, historical deletion, or loss of the final active
administrator.

#### Missing decisions

- Whether email addresses can be changed.
- Whether deactivation is reversible.
- Whether inactive users may still be edited.
- Name and email normalization rules.
- Whether an administrator may deactivate themselves when another active
  administrator exists.
- Exact behavior of existing sessions after deactivation.

---

### F07 - Calendar navigation and safe resource selection

**Can start:** When authentication and safe resource queries are stable

**Depends on:** F03 and F05

**Blocks:** F08 and F11

#### Description

Provide the main calendar surface with desktop day, week, and month views,
resource selection, period navigation, 15-minute slots, Monday-first weeks,
24-hour time, and typed URL-backed date, view, and resource state.

The Ilamy calendar is a view and interaction surface, not a source of truth.
Drag-and-drop remains disabled.

#### PocketBase and backend behavior

The frontend needs role-safe endpoints for active resources and visible
bookings. Queries are scoped by resolved tenant, selected resource, and visible
time interval.

Responses must omit rates, foreign-tenant data, and private maintenance fields
before they reach the browser. This may require a custom PocketBase route or
safe projection rather than unrestricted raw collection access.

#### Why server-side response shaping is needed

Data hidden by a React component remains visible in browser developer tools.
PocketBase must never send unauthorized rate or maintenance identity fields to
regular users.

Time-range filtering reduces unnecessary transfer and prevents loading all
tenant bookings when only one resource and period are visible.

#### Completion outcome

Users can select a resource, navigate calendar periods, refresh or share the
current URL state, and view only permitted booking information.

#### Missing decisions

- Default desktop view and initial date.
- Desktop/mobile breakpoint.
- Exact event content and visual treatment.
- Training-booking visibility for regular users.
- Archived-resource selection behavior.
- Whether visible-range queries return bookings intersecting the interval.
  Intersection semantics are recommended for correct rendering.

---

### F08 - Regular booking creation, snapshots, and visibility

**Can start:** When units, resources, users, and the calendar are stable

**Depends on:** F04, F05, F06, and F07

**Blocks:** F09, F10, F11, and F12

#### Description

Allow regular users to create future regular bookings and allow tenant users to
view the permitted booking details.

The frontend provides a reusable booking form opened from day/week slots or a
month date. The selected resource is implicit, regular type is automatic, and
prices are absent.

#### PocketBase data and backend behavior

A booking migration creates tenant, resource, booked-for user, created-by user,
type, UTC start and end, rate snapshot, booker snapshots, resource-name
snapshot, and timestamps.

A creation hook:

1. Resolves the authenticated user and tenant.
2. Derives tenant, ownership, type, and creator values server-side.
3. Rejects cross-tenant or archived relationships.
4. Validates future start, positive duration, and 15-minute boundaries.
5. Checks overlap on the same resource using end-exclusive intervals.
6. Loads the applicable trusted resource rate.
7. Copies booker, unit, email, resource, and rate snapshots.
8. Rejects client attempts to supply protected values.

Overlap is detected when:

```text
existing.start < proposed.end
AND existing.end > proposed.start
```

#### Why hooks and snapshots are needed

A user can bypass form validation and submit another tenant's resource, a
privileged type, or a manipulated rate. The server must derive protected values
from authenticated identity and trusted records.

Snapshots prevent later name, unit, email, resource, or rate changes from
rewriting historical invoicing data.

The MVP accepts a narrow race between simultaneous overlap checks because
database-level serialization is explicitly out of scope.

#### Completion outcome

A regular user can create a valid future booking. PocketBase independently
enforces time, tenant, ownership, resource, conflict, and snapshot rules.

#### Missing decisions

- Grace and precision for the future-start check.
- Default month-view start and end times.
- Maximum practical booking duration.
- Exact rate-snapshot representation.
- Exact booking information shown on events versus details.
- Whether the non-atomic overlap race is explicitly accepted.

---

### F09 - Booking editing and permanent deletion

**Can start:** When regular booking creation and details work

**Depends on:** F08

**Blocks:** F11, F12, and F13

#### Description

Allow eligible regular users and administrators to edit or permanently delete
bookings while preserving immutable history and role-specific time rules.

The frontend provides booking details, a reusable edit form, role-aware
actions, explicit delete confirmation, and TanStack Query invalidation.

#### PocketBase and backend behavior

Update hooks load the stored booking and compare old and proposed state.

For regular users, PocketBase verifies ownership and requires both current and
proposed starts to be at least 24 hours in the future.

For administrators, PocketBase permits time editing without that restriction.
All edits revalidate interval boundaries and overlap.

Tenant, resource, type, creator, and historical snapshots remain protected.
Deletion hooks enforce ownership and the 24-hour rule for regular users, and
future-current-start eligibility for administrators.

#### Why old and new state are both required

The regular-user rule depends on the existing start as well as the proposed
start. A submitted payload alone cannot prove eligibility. Snapshot and
immutable-field protection also requires comparison with the stored record.

Delete confirmation prevents accidents but is not authorization. Direct API
deletion must still be rejected by PocketBase when ineligible.

#### Completion outcome

Users can edit or delete only when permitted, and crafted requests cannot alter
ownership, tenant, resource, type, snapshots, or protected history.

#### Missing decisions

- Whether `booked_for_user` is immutable after creation.
- Whether an administrator may move a completed booking into the future.
- Whether an administrator may move a future booking into the past.
- Whether inactive users retain mutation rights through existing sessions.
- Behavior when eligibility changes while an edit form is open.

---

### F10 - Administrative, training, and maintenance bookings

**Can start:** When user selection and regular booking creation work

**Depends on:** F06 and F08

**Blocks:** F11, F12, and F13

#### Description

Extend booking creation for administrators. Administrators can create regular
or training bookings for an active user and maintenance blocks for a resource.

Training uses the resource's training rate. Maintenance has no rate, is not
billable, participates in conflicts, and appears to regular users only as a
generic unavailable interval.

#### PocketBase and backend behavior

The booking hook verifies administrator role and same-tenant relationships.
For regular and training bookings, it sets the selected active user as owner,
the administrator as creator, and selects the correct trusted resource rate.

For maintenance, it records the creating administrator as required by the PRD,
stores no rate, and includes the interval in overlap checks.

Regular-user responses must be sanitized so they do not contain maintenance
type or administrator identity. Administrators receive the permitted full
detail.

#### Why rate selection and privacy belong on the backend

The client selects a booking type, not a numeric rate. PocketBase loads the
resource and chooses the corresponding rate, preventing manipulated or stale
snapshots.

Changing an administrator name to "Unavailable" in React does not protect the
identity if the raw response contains it. Role-aware projection must happen
before the data reaches the browser.

#### Completion outcome

Administrators can create all booking types. Training uses the correct rate,
maintenance blocks the resource and remains non-billable, and regular users
cannot discover private maintenance information.

#### Missing decisions

- What regular users see for training bookings.
- Whether an assigned regular user may edit or delete a training booking. The
  current PRD implies that they may.
- Whether maintenance needs a title, reason, or description.
- Exact administrator maintenance details.
- Whether maintenance identity fields are immutable during editing.

---

### F11 - Mobile and accessible booking experience

**Can start:** When desktop calendar and booking workflows are stable

**Depends on:** F07, F08, F09, and F10

**Blocks:** F13

#### Description

Adapt the complete booking workflow to mobile and meet the agreed accessibility
standard.

Mobile provides daily view only, a compact resource selector, and full-screen
create, detail, edit, and delete experiences. Core workflows include keyboard
support, focus placement and restoration, programmatic labels, announced
validation errors, and sufficient contrast.

#### PocketBase and backend implications

Mobile uses the same PocketBase rules, hooks, and safe response projections as
desktop. Responsive UI must not create a second authorization path or weaker
validation behavior.

#### Completion outcome

Core booking workflows are usable on supported mobile devices and through
keyboard and assistive interaction without changing backend security behavior.

#### Missing decisions

- Responsive breakpoint and minimum supported viewport.
- Minimum touch-target size.
- Whether WCAG 2.2 AA is mandatory rather than aspirational.
- Supported assistive-technology test combinations.
- Whether mobile full-screen surfaces create browser-history entries.

---

### F12 - Server-generated invoicing exports

**Can start:** When snapshots, final-duration editing, and maintenance behavior
are stable

**Depends on:** F08, F09, and F10

**Blocks:** F13

#### Description

Allow administrators to export tenant billing data as CSV and Excel from one
shared, server-generated billing projection.

The frontend provides an administrator-only route, application-timezone start
and end fields, format selection, and an export mutation. The browser performs
no billing calculation.

#### PocketBase and backend behavior

An authenticated custom endpoint:

1. Resolves and authorizes the active tenant administrator.
2. Parses the selected interval in the application timezone.
3. Converts inclusive start and exclusive end to UTC.
4. Selects same-tenant bookings by the PRD's start-time filter.
5. Excludes maintenance.
6. Uses stored historical snapshots.
7. Calculates actual elapsed duration from UTC instants.
8. Multiplies duration by the exact stored rate snapshot.
9. Applies decimal half-up rounding to two DKK decimals.
10. Produces format-neutral rows.
11. Serializes the same rows as CSV or `.xlsx`.

#### Why export generation belongs on the backend

Client-side generation would require sending billing data to the browser and
would allow a modified client to change filtering or calculations. Server
generation keeps authorization, tenant scoping, timezone conversion, decimal
arithmetic, and format parity under one trusted implementation.

UTC duration is required around daylight-saving transitions because displayed
local-clock duration may not equal actual elapsed time.

#### Completion outcome

Administrators can download logically identical CSV and Excel exports with
correct tenant filtering, snapshots, duration, and DKK calculations.

#### Missing decisions

- CSV delimiter, quoting, encoding, and BOM behavior.
- Exact headers and column order.
- Timestamp and duration formats.
- Tenant column value.
- Excel cell types and formats.
- Empty-export behavior.
- Maximum interval and row count.
- Filename convention.
- Exact decimal storage and arithmetic implementation.

---

### F13 - Production hardening and complete system validation

**Can start:** Incrementally throughout development; completes after F01-F12

**Depends on:** F01-F12

**Blocks:** Unattended production release

#### Description

Harden the deployment established in F02 and prove that frontend behavior,
PocketBase enforcement, migrations, backup, rollback, and production
configuration operate together.

The feature includes:

- Direct PocketBase tests for tenant, role, ownership, relationship, and
  protected-field attacks.
- Booking boundary, overlap, snapshot, archive, deactivation, and
  last-administrator tests.
- Maintenance privacy tests against raw responses.
- Export authorization, timezone, DST, decimal, and parity tests.
- TanStack Router guard and URL-state tests.
- TanStack Query loading, mutation, failure, and invalidation tests.
- An end-to-end sign-in, resource-selection, booking-creation, and visibility
  smoke test.
- Deployment locking and concurrent-deployment protection.
- Pre-migration production backup.
- Migration failure handling.
- Release and data permission review.
- Health and smoke checks after deployment.
- Tested application rollback.
- Documented database recovery procedure.
- Log location and retention.
- Removal of temporary rollout allowances.
- A decision on retaining or removing manual GitHub environment approval.

#### PocketBase and backend rationale

UI tests exercise expected behavior but do not prove authorization. Backend
tests must deliberately submit malicious payloads, including foreign tenant
IDs, privileged booking types, altered snapshots, changed ownership, and
requests for private maintenance data.

Static-file rollback is achieved by switching the release symlink. Database
rollback is more difficult because a migration may change persistent schema or
data. Backward-compatible migrations, pre-deployment backups, and rehearsed
recovery are therefore required before unattended deployment.

#### Completion outcome

The complete MVP passes automated and direct-API security tests, deployment
failures are surfaced, production data is protected, and the application can
be deployed and recovered using documented procedures.

#### Missing decisions

- Backup destination and retention.
- Migration compatibility and rollback policy.
- Log retention and monitoring expectations.
- Health-check and alerting mechanism.
- Recovery-time and recovery-point expectations.
- Whether production deployment remains manually approved.

## 6. Recommended delivery phases

### Phase 1 - Deployable foundation

- F01 Application foundation and isolated runtime.
- F02 Initial VPS deployment and continuous delivery.

**Milestone:** An application shell is deployed to the VPS by merging approved
changes to `main`.

### Phase 2 - Secure tenant access

- F03 Tenant isolation, authentication, and password lifecycle.

**Milestone:** A tenant user can securely sign in through the correct
subdomain.

### Phase 3 - Tenant administration

- F04 Organizational-unit administration.
- F05 Resource administration and permanent archival.
- F06 Tenant user administration and administrator protection.

F04 and F05 may proceed in parallel after F03. F06 waits for F04.

**Milestone:** Administrators can configure the tenant data needed for booking.

### Phase 4 - Calendar and regular bookings

- F07 Calendar navigation and safe resource selection.
- F08 Regular booking creation, snapshots, and visibility.

**Milestone:** A regular user can select a resource and create a valid booking.

### Phase 5 - Complete booking permissions

- F09 Booking editing and permanent deletion.
- F10 Administrative, training, and maintenance bookings.

These may proceed in parallel after F08 if they share a stable booking backend
contract.

**Milestone:** All roles and booking types follow their required permissions.

### Phase 6 - Mobile and invoicing

- F11 Mobile and accessible booking experience.
- F12 Server-generated invoicing exports.

These may proceed in parallel once their dependencies are complete.

**Milestone:** Core workflows work on mobile and administrators can export
billing data.

### Phase 7 - Production hardening

- F13 Production hardening and complete system validation.

F13 validation should be added incrementally during every earlier feature, but
this phase closes the remaining deployment, recovery, and full-system gaps.

**Milestone:** The MVP is ready for normal production operation.

## 7. Decisions to resolve before task decomposition

The following decisions materially affect schema, hooks, authorization, or API
contracts and should be added to the product requirements before affected
features are decomposed into development tasks:

1. Whether deactivated users can be reactivated.
2. Whether `booked_for_user` is immutable after booking creation.
3. Whether administrators may reschedule completed bookings into the future or
   future bookings into the past.
4. How archived resources remain accessible for existing bookings.
5. What regular users can see and change for training bookings.
6. Whether maintenance bookings need a reason or description.
7. The safe resource and booking projection mechanism in PocketBase.
8. Exact-decimal storage and calculation for DKK.
9. The normative CSV and Excel contracts.
10. Production paths, users, certificates, backup, and recovery policy.
