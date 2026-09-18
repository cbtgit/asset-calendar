# Asset Calendar Product Requirements

**Status:** Normative MVP requirements
**Last updated:** 2026-09-15

The non-secret operator boundary for the existing production tenant is defined
in the [production bootstrap contract](./production-bootstrap-contract.md).

The current `create-booking-type` branch implements the administrator
catalog for listing, creating, and editing tenant-owned booking types. It does
not seed prefilled booking-type records and does not yet provide a
booking-type archival workflow. The requirements below describe the intended
MVP behavior beyond this branch.

## 1. Product summary

Asset Calendar is a multi-tenant resource booking system. Users select a
resource and reserve a time period in a calendar. Tenant administrators manage
resources, users, groups, bookings, and invoicing exports.

The MVP is intended for deployment on a small VPS and must provide strict
tenant isolation while remaining simple to operate and develop locally.

## 2. Goals

The MVP must:

- Let authenticated users view and book resources.
- Provide desktop day, week, and month calendar views.
- Provide a focused mobile daily calendar view.
- Prevent overlapping bookings for the same resource.
- Allow regular users to manage only their own bookings, subject to the
  24-hour rule.
- Give administrators full booking and tenant administration capabilities.
- Support regular, training, and maintenance booking types.
- Provide administrator-only CSV and Excel exports for invoicing.
- Isolate users and data by tenant, with the tenant resolved from the
  subdomain.
- Run as a lightweight React/Vite+ SPA and PocketBase deployment behind the
  existing host-level Nginx installation.

## 3. Non-goals for the MVP

The following are explicitly deferred:

- Recurring bookings.
- Booking approval workflows.
- Email notifications for booking creation, changes, or reminders.
- Public registration or self-service tenant creation.
- Cross-tenant user membership.
- Resource-specific permissions or group-based resource restrictions.
- Resource capacity greater than one concurrent booking.
- Audit logging.
- VAT or other tax calculations.
- In-app backup and restore requirements.
- Offline operation.
- Drag-and-drop creation, movement, or resizing of calendar events.
- Native mobile applications.

User invitation email is required even though general booking notifications are
not part of the MVP.

## 4. Users and permissions

### 4.1 Tenant membership

- Each user belongs to exactly one tenant.
- Each tenant is identified by a unique subdomain.
- A request's tenant is derived from its trusted host/subdomain, not from a
  client-supplied tenant ID.
- User email addresses are globally unique across all tenants in the MVP.
- Every tenant-owned record must contain a tenant reference.
- A user authenticated for one tenant must not be able to read or modify
  another tenant's data.
- Initial tenant, group, and first-administrator provisioning is
  outside the MVP product workflow. For production, the operator manually
  provisions exactly one tenant for `nejsumlab.frontend-freelance.dk`, one
  group, and one active administrator in PocketBase. There is no
  tenant onboarding or self-service provisioning UI in F03. The stable lookup
  rules and migration-preservation behavior are defined in the [production
  bootstrap contract](./production-bootstrap-contract.md).

### 4.2 User roles

Each user has one role within their tenant:

- **Regular user**
  - View bookings in the tenant.
  - Create regular bookings.
  - Edit and permanently delete their own bookings when the existing and
    proposed start times are at least 24 hours in the future.
  - Cannot edit or delete another user's booking.
  - Cannot create administrator-selected booking types, including
    non-billable types.
  - Must not see prices in booking views or forms.
- **Administrator**
  - View, create, and edit any booking.
  - Permanently delete any booking regardless of its current start time.
  - Create regular and administrator-selected typed bookings.
  - Choose any active tenant user as the booker for an administrator-selected
    booking, including a non-billable booking.
  - Manage resources, groups, and users.
  - Export booking data as CSV or Excel.
  - May view booking type in booking details and administration forms.
  - May view and edit resource rates in the resource administration form.
  - May manage booking-type names, surcharges, and the non-billable capability,
    and edit the tenant locale.

Administrators may demote or deactivate themselves through the normal mutation
path. A tenant may temporarily have zero active administrators; PocketBase
operator access is the documented recovery path.

### 4.3 User lifecycle and authentication

- Sign-in uses email address and password.
- There is no public registration or public password-recovery flow in the MVP.
- Password reset for users who have already completed setup is deferred.
- Administrators create users, and the system sends each new user an invitation
  email through SMTP2GO.
- The invitation email contains a one-time link, valid for 30 days, where the
  user creates their password before accessing the rest of the application.
- Passwords use PocketBase's built-in validator. The application does not add
  custom length or character-composition requirements.
- After successful password setup, the user is signed in immediately.
- There is no email verification requirement in the MVP.
- A normal authenticated session lasts one workday and is persisted across page
  reloads.
- Deactivating a user prevents sign-in and new protected actions but preserves
  the user and their booking history.
- Deactivating a user does not revoke an already-issued token or forcibly sign
  out an existing browser session. No custom token-revocation system is part of
  the MVP.
- A deactivated user's existing bookings remain unchanged and continue to block
  their resources unless an administrator edits or deletes an eligible booking.
- A deactivated user cannot be selected as the booker for a new booking.
- User display names are based on first name and last name.
- A user must belong to exactly one group.

SMTP2GO credentials remain server-side in protected VPS/PocketBase
configuration. The SPA never sends email or receives SMTP credentials. Local
development and CI use a mail capture or test sink rather than sending real
messages.

## 5. Booking requirements

the booker.

### 5.1 Booking types

Booking types are tenant-owned records used for administrator-selected
bookings. Each booking type has an administrator-configurable name, surcharge,
and `nonbillable` capability flag. The flag defaults to `false`, so booking
types are billable unless explicitly configured otherwise. Regular bookings do
not reference a booking type.

The intended MVP supports training, maintenance, and custom booking types, but
the current branch does not seed prefilled records. These labels describe
administrator workflow conventions; billing behavior is controlled by the
`nonbillable` flag rather than by a booking type's name. A non-billable type
has no billable surcharge or effective rate, while a billable type uses its
configured surcharge. Both kinds block the selected resource and otherwise
follow the same booking workflow.

No booking type may be deleted. In the intended MVP, booking types may be
archived permanently; archived types cannot be used for new bookings but
remain available for historical records. The current branch has no archive
action yet.

Regular users do not see a booking type field or the booking-type catalog. Their
bookings store a null booking type, a zero booking-type surcharge, and no
booking-type name snapshot. Administrators may select an active booking type
permitted for the workflow and must still select an active user for the booking.
Regular users cannot change booking type after creation. Administrators may
change it while editing, with snapshots and rate fields recalculated using the
same trusted calculation as booking creation.

### 5.2 Time and availability

- Time selection uses 15-minute increments.
- Bookings must have a positive duration; the practical minimum is 15 minutes.
- There is no configurable maximum duration.
- Bookings may span midnight.
- New bookings may start in the past, present, or future. No business-hours or
  future-start eligibility check is applied.
- Bookings are immediately confirmed after successful validation.
- A resource supports one booking at a time.
- Overlapping bookings are rejected, including overlaps with maintenance
  bookings.
- Booking intervals are end-exclusive. For example, a booking ending at 11:00
  may be followed by one starting at 11:00.
- No availability-hours schedule is required. Active resources are available
  24/7 unless booked or archived.
- The backend must perform the final conflict check when creating or updating a
  booking. Atomic protection against simultaneous conflicting requests is not
  required for the MVP.

For a regular user's edit, both the current booking start and the proposed new
start must be at least the tenant's configured booking lock window in the
future. The setting is a whole number of hours and defaults to 24 hours.
Administrators are not subject to the booking lock restriction. Administrators may change the booked-for user
and booking type, but the resource remains fixed. Any administrator-selected
replacement user must be active and belong to the tenant. When an
administrator changes the booked-for user or booking type, the server
recalculates the affected snapshots and rate fields using the same trusted
calculation as booking creation.

### 5.3 Pricing

- Each tenant has one currency selected from the initial allowlist: `DKK`,
  `EUR`, `USD`, or `GBP`. Currency is configured when the tenant is
  provisioned and is immutable for the tenant lifetime. A tenant never mixes
  currencies and the application performs no foreign-exchange conversion.
- Each tenant has a BCP 47 display locale. The existing tenant defaults to
  `da-DK`; administrators may edit the locale at any time. The current tenant
  locale controls monetary display and money input parsing.
- Each active resource has one non-negative base hourly rate stored as an exact
  integer number of currency minor units.
- Each active billable booking type has one non-negative surcharge stored as an
  exact integer number of currency minor units. The effective hourly rate is
  the resource base rate plus the selected booking-type surcharge.
- A non-billable booking type has a zero surcharge and zero effective hourly
  rate, regardless of any client-submitted value. Non-billable bookings still
  participate in resource conflict checks and use the normal booking ownership
  and visibility rules.
- User-facing rate fields display the tenant currency using `Intl.NumberFormat`.
  Input accepts only the current tenant locale's unambiguous decimal and
  grouping syntax; malformed, mixed-separator, negative, fractional-minor,
  and unsafe values are rejected rather than guessed.
- Billable amounts are prorated by actual duration. A 15-minute booking uses
  0.25 of the effective hourly rate.
- Each booking stores the resource base-rate, booking-type surcharge, and
  effective-rate snapshots in integer minor units. The calculated billable
  amount is derived during export and is not stored on the booking.
- Rate snapshots remain unchanged for the lifetime of the booking, even if the
  resource or booking-type configuration changes or an administrator edits the
  booking.
- Exported amounts are calculated from the booking's final duration and stored
  effective-rate snapshot, then rounded to the tenant currency's supported
  number of fractional digits using exact decimal half-up arithmetic.
- Duration and billing calculations use actual elapsed time between the stored
  UTC instants, including across daylight-saving transitions.
- A booking configured with a non-billable type has no billable rate or amount.
  Its stored rate components are zero or absent according to the booking
  schema contract.
- Prices must never appear in calendar views, booking details, or regular-user
  forms.
- Resource base rates and booking-type surcharges are visible only in
  administrator administration surfaces and administrator exports.

### 5.4 Ownership and historical snapshots

A booking stores both:

- `booked_for_user` - the user whose booking it is and whose ownership
  determines regular-user edit/delete permission.
- `created_by_user` - the user who created the record.

For stable historical exports, the booking also stores:

- The booker's display-name snapshot.
- The booker's group snapshot.
- The booker's email snapshot.
- The resource-name snapshot.
- The optional booking-type name snapshot.
- The resource base-rate snapshot in integer minor units.
- The booking-type surcharge snapshot in integer minor units.
- The effective hourly-rate snapshot in integer minor units.

Currency is not duplicated on each booking because tenant currency is
immutable. The tenant currency is included in administrator export metadata
and applies to every exported row.

If an administrator creates a training booking for a regular user, ownership
follows the selected user. That user may edit or delete it before the 24-hour
cutoff, but cannot change its booking type.

### 5.5 Deletion

- Deletion is permanent in the MVP.
- There is no cancellation state.
- A regular user can permanently delete only their own eligible booking.
- An administrator can permanently delete any booking regardless of its
  current start time.
- Administrators may edit any booking without time restrictions, including
  changing the dates and times of started or completed bookings. The resource
  remains fixed, while the booked-for user and booking type may be changed.
  Changing either one recalculates the affected snapshots and rate fields
  using the same trusted calculation as booking creation.
- Deleted bookings are not included in exports.

## 6. Calendar and user experience

### 6.1 Cross-feature responsive experience

Mobile and narrow-screen behavior is part of the feature that introduces each
workflow. It is not a later port of a desktop-only implementation. Every UI
feature must define and accept its desktop and narrow-screen layout,
interaction, loading, empty, error, validation, and destructive-action states
before that feature is complete.

The authenticated application uses a shared responsive shell. Public sign-in,
password setup, and unavailable routes remain outside it. The shell owns
product identity, primary navigation, current-user actions, sign-out, and page
landmarks. Feature routes own their data layout, forms, actions, and
feature-specific responsive behavior. The shell must not consume or duplicate
the calendar's resource-list pane.

Across viewport sizes:

- Content must remain usable without horizontal scrolling.
- Navigation, controls, forms, dialogs, and confirmation actions must remain
  reachable by keyboard and touch.
- Labels, validation messages, pending states, and errors must remain
  programmatically associated with their controls.
- Focus must be visible, placed predictably, and restored after a temporary
  surface closes when the workflow requires it.
- Role, tenant, ownership, privacy, and server-authoritative validation rules
  must be identical on desktop and narrow screens.
- Feature acceptance must include at least one supported narrow viewport; F11
  validates cross-feature consistency but does not introduce mobile behavior
  for the first time.

### 6.2 Desktop calendar layout

The desktop booking screen has:

- A resource list in the left pane.
- A larger calendar pane for the selected resource.
- Calendar navigation for previous, current, and next periods.
- Day, week, and month views.

If the tenant has exactly one active resource, it is selected automatically. If
there are multiple resources, no resource is selected automatically and the
user must choose one.

The desktop week view starts on Monday and uses 24-hour time formatting.

### 6.3 Mobile calendar layout

Mobile uses:

- Daily view only.
- A compact resource selector above the calendar.
- No slide-in resource drawer.
- A full-screen create/edit form.

If there is exactly one active resource, it is selected automatically. With
multiple resources, the user must select one.

### 6.4 Creating bookings

Bookings are created through a reusable form. On desktop, the form is shown in
the right-hand content pane rather than in a modal or full-window view; the
resource pane remains available on the left. On mobile, the form is full-screen.

- Clicking an empty day/week time slot opens the form with the selected
  resource and start time pre-filled.
- Clicking a day in month view opens the form with the date pre-filled; the
  user then chooses the start and end time.
- The resource is implicit from the selected resource pane/selector and is not
  shown as a form field.
- Regular users see date and time fields only; booking type is hidden and
  defaults to regular.
- Administrators see the booking type field and may select the active user the
  booking is for. This user selection remains required for non-billable types.
- Non-billable types use the same user assignment, ownership, and presentation
  rules as other booking types for now.
- The form does not show prices.

### 6.5 Viewing, editing, and deleting bookings

Selecting an existing booking opens a detail view before any destructive
action. The same desktop right-pane and mobile full-screen form behavior is
used for editing.

Regular users see:

- Booker's display name.
- Booking start and end time.
- Edit/delete actions only when the 24-hour rule permits them.
- Non-billable bookings currently appear like other bookings. Maintenance-
  specific generic unavailable rendering and administrator-identity hiding are
  separate follow-up behavior.

Administrators may additionally see booking type and may edit or delete any
booking. Administrators may change the booked-for user and booking type while
editing, but may not change the resource. Prices remain hidden in booking
details.

The resource remains fixed while editing. Moving a booking to another resource
is not supported in the MVP.

Deletion requires an explicit confirmation for every user type, including
regular users and administrators. Administrator deletion is unrestricted by
the booking's current start time. Regular deletion still requires ownership
and a current start at least the tenant's configured booking lock window in the future.

### 6.6 Calendar implementation

The frontend will use the Ilamy React calendar component with:

- Month, week, and day views on desktop.
- Day view on mobile.
- 15-minute slot duration.
- Tenant/application timezone.
- Custom event rendering and event forms.
- Cell and event click handlers.
- Drag-and-drop disabled.

The calendar is a view and interaction surface, not the source of truth.
Booking creation and updates must be validated by the backend.

## 7. Administration

Administrators have access to an administration area for:

- Resources.
  - Create, edit, and archive resources.
  - Configure one base hourly rate per resource.
  - Resource names must be unique within a tenant.
  - Archiving is immediate and permanent; resources cannot be unarchived.
  - Archived resources cannot receive new bookings but remain visible for
    existing and future bookings.
- Booking types.
  - View existing booking types. The current branch does not provide seeded
    regular, training, or maintenance records.
  - Create and edit booking types, including their name, surcharge, and
    non-billable capability.
  - Configure the training name and surcharge when the type is billable.
  - Create and edit custom billable or non-billable booking types. Permanent
    archival is part of the intended MVP but is not implemented in the current
    branch.
  - View archived types for administration and historical records; archived
    types cannot be used for new bookings.
  - Regular and maintenance semantics are protected, and no type can be
    deleted.
- Tenant settings.
  - View the tenant currency and edit the tenant display locale.
  - Currency is limited to `DKK`, `EUR`, `USD`, or `GBP` when provisioned and
    cannot be changed afterward.
- Groups.
  - Create and edit a name. Names are trimmed, must contain non-whitespace
    content, and may be at most 200 characters.
  - Group names must be unique within a tenant, case-insensitively after
    trimming and lowercasing for comparison.
  - Assign every user to exactly one group.
  - Prevent deletion while users are assigned.
  - The administrator directory uses the tenant-scoped `/api/groups`
    projection, which includes member counts. The projection is unavailable to
    regular users.
- Users.
  - Create regular and administrator users.
  - Assign a group.
  - Send an invitation email so the user can create a password.
  - Change role, activate, deactivate, and resend invitations for users.
- Exports.
  - Select a start date/time and end date/time.
  - Export CSV or Excel (`.xlsx`).

Administrators use the regular booking area to create, edit, and permanently
delete eligible future bookings. The administration area does not contain a
separate booking management screen. From the regular booking area,
administrators can create bookings for active users and select a billable or
non-billable booking type.

The administration area uses the shared authenticated shell and is responsive
from the first administration feature. Groups administration
must provide a readable single-column or stacked list and a full-width or
full-screen create/edit surface on narrow screens. Resource and user
administration must define equivalent narrow-screen list, form, confirmation,
loading, empty, and error states when those features are delivered. No admin
workflow may require horizontal scrolling or a separate mobile authorization
path.

## 8. Invoicing exports

Exports are administrator-only and must be generated with server-side
authorization and tenant scoping.

The selected interval uses the application timezone, with an inclusive start
and exclusive end. Include bookings whose start time is greater than or equal
to the selected start and less than the selected end. Exclude non-billable and
permanently deleted bookings.

Each exported booking row contains:

- Tenant
- Group snapshot
- Booker display-name snapshot
- Booker email snapshot
- Resource-name snapshot
- Booking type
- Start time
- End time
- Duration
- Resource base-rate snapshot
- Booking-type surcharge snapshot
- Effective hourly-rate snapshot
- Currency code
- Amount in the tenant currency calculated from the final duration and
  effective hourly-rate snapshot

No VAT or other tax calculations are included.

## 9. Domain model

The MVP data model should include at least:

### Tenant

- ID
- Name
- Subdomain

### User

- PocketBase auth identity
- Tenant ID
- First name
- Last name
- Email
- Role: regular or administrator
- Group ID
- Active/deactivated status
- Invitation and password-setup state required to complete first-time access

### Group

- ID
- Tenant ID
- Name

### Resource

- ID
- Tenant ID
- Name
- Base hourly rate in integer currency minor units
- Active/archived status

### Booking type

- ID
- Tenant ID
- Display name
- Surcharge in integer currency minor units
- Active/archived status

### Booking

- ID
- Tenant ID
- Resource ID
- Booked-for user ID
- Created-by user ID
- Booking type
- Start timestamp
- End timestamp
- Resource base-rate snapshot in integer currency minor units
- Booking-type surcharge snapshot in integer currency minor units
- Effective hourly-rate snapshot in integer currency minor units
- Booker display-name snapshot
- Group snapshot
- Booker email snapshot
- Resource-name snapshot
- Created and updated timestamps

All relationships must be checked for same-tenant consistency. PocketBase
collection rules and server-side logic must enforce this; client-side tenant
filters are not sufficient.

## 10. Timezone and date handling

To keep the MVP simple:

- Use one application-wide timezone configured on the server, with
  `Europe/Copenhagen` as the initial default.
- Store instants in UTC in the database.
- Convert to the application timezone for calendar display, validation, the
  24-hour rule, and exports.
- Use 24-hour display and Monday as the first day of the week.
- A future enhancement may add a configurable timezone per tenant.

## 11. Technical direction

### Frontend

- React
- TypeScript
- Vite+
- TanStack Router for type-safe SPA routing, protected routes, and
  URL-backed navigation state.
- TanStack Query for PocketBase-backed server state, queries, mutations,
  cache invalidation, and request loading/error states.
- Tailwind CSS
- shadcn/ui components
- Ilamy calendar
- PocketBase JavaScript SDK
- Responsive SPA served as static files

The frontend includes one shared authenticated application shell for all
protected destinations. The shell provides the route outlet, primary
navigation, current-user actions, and responsive landmarks; calendar,
administration, booking, and export routes own their feature-specific layouts.

TanStack Router is the application's routing authority. Route definitions must
provide typed parameters and search state, enforce authentication before
protected content renders, and support direct navigation and browser history.

TanStack Query is the application's server-state authority. PocketBase reads
and writes used by the UI must be exposed through consistently keyed queries
and mutations. Successful mutations must invalidate or update all affected
queries so calendar and administration views remain consistent. Local UI state
such as an open panel or an unsaved form value must remain component state
rather than being placed in the query cache.

### Backend

- PocketBase for authentication, persistence, and API access.
- PocketBase migrations and hooks where server-side validation is required.
- Tenant and role enforcement in backend rules/hooks, not only in React.
- SMTP2GO configured through protected environment variables for user invitation
  email. Sender-domain DNS authentication and VPS secret setup are manual
  production prerequisites.

### Production

The existing host-level Nginx installation remains the only public reverse
proxy:

```text
Nginx
  -> static React/Vite+ application
  -> PocketBase on localhost
```

PocketBase must listen on a local-only interface/port and must not be exposed
directly to the Internet. PocketBase runs as a pinned binary managed by
`systemd`.

The release contains `dist`, `pb_migrations`, `pb_hooks`, and the
checksum-verified PocketBase runtime. Deployment applies migrations to the
persistent PocketBase data directory outside the release before starting the
service. Failed activation or health checks restore the previous release
symlink and restart the previous service; database migrations are not
automatically reversed.

Production authentication configuration is supplied through protected VPS
configuration, not `.env.example`, frontend code, release directories, or
issue text. SMTP2GO account approval, sender-domain DNS, protected VPS
configuration, and an operator-controlled invitation smoke test are manual
prerequisites. Local and CI mail use capture/test sinks and never send real
email. See the [production bootstrap contract](./production-bootstrap-contract.md).

The initial production deployment will not require Docker. This fits the
existing Nginx setup and the 1 GB RAM / 25 GB disk VPS.

### Development and CI

Local development, GitHub Actions CI, and Copilot cloud-agent workspaces use a
pinned PocketBase binary launched by shared project scripts. Each environment
uses isolated data:

- Local development data.
- Ephemeral CI data.
- Ephemeral cloud-agent data.
- Separate persistent production data.

Development and CI must never connect to production PocketBase data.

## 12. Non-functional requirements

- Support current Chrome, Edge, Firefox, and Safari on desktop and mobile.
- Aim for WCAG 2.2 AA for core workflows.
- Treat responsive behavior as a per-feature acceptance requirement rather than
  a final adaptation phase.
- Use accessible keyboard navigation, focus management, labels, validation
  messages, and sufficient color contrast.
- Surface API and validation errors clearly; do not silently ignore failed
  operations.
- Keep booking conflict validation server-authoritative.
- Do not expose prices to unauthorized users.
- Do not expose tenant data across subdomains.
- Design for an initial scale of approximately 100 users, 50 resources, and
  10,000 bookings per tenant.

## 13. Testing requirements

Automated tests must cover:

- Booking creation and future-start validation.
- 15-minute boundary validation for start and end times for all user roles.
- Prorated export amount calculation and decimal half-up rounding.
- End-exclusive overlap detection.
- Regular-user ownership and 24-hour rules.
- Administrator permissions.
- Administrator-selected billable and non-billable booking-type permissions.
- Non-billable booking types produce zero surcharge and zero effective rate and
  remain ordinary user-assigned bookings.
- Resource archive behavior.
- User deactivation, reactivation, and active-user selection.
- Group deletion protection.
- Rate, booker name, booker email, resource name, and group
  snapshots.
- CSV and Excel export filtering and contents.
- Tenant isolation for reads, writes, and exports.
- Shared authenticated-shell navigation and role-aware destination visibility.
- Narrow-screen layout and interaction for each feature as it is delivered,
  including admin lists/forms, calendar selection, booking forms, and export
  controls.

Add a small end-to-end smoke test covering sign-in, resource selection, booking
creation, and booking visibility on a supported desktop and narrow viewport.

## 14. MVP acceptance criteria

The MVP is ready when:

1. A user can sign in on the correct tenant subdomain.
2. A regular user can select a resource and create a future regular booking.
3. A second user can see that booking's time and booker but not its price.
4. An overlapping booking for the same resource is rejected.
5. A regular user can edit/delete their own eligible booking but is blocked
   inside the 24-hour window.
6. A regular user cannot edit/delete another user's booking.
7. An administrator can create, edit, and permanently delete any booking.
8. An administrator can create bookings with billable and non-billable types
   for active users.
9. Non-billable bookings block the resource but do not appear in invoicing
   exports.
10. Calendar behavior works in desktop day/week/month views and mobile daily
    view.
11. Mobile uses a compact resource selector and no drag-and-drop.
12. Administrators can manage resources, users, and groups.
13. Administrators can manage booking types and configure the tenant locale;
    the tenant currency is one of `DKK`, `EUR`, `USD`, or `GBP` and is
    immutable after provisioning.
14. Administrators can export the selected booking interval as CSV and Excel.
15. Exported rates and amounts use booking snapshots, actual elapsed duration,
    the tenant currency, and exact decimal half-up rounding for that currency.
16. Cross-tenant reads and writes are rejected by backend enforcement.
17. The application can be built as static files and served by the existing
    Nginx installation.
18. The existing production tenant is resolved from
    `nejsumlab.frontend-freelance.dk`; tenant identity is never client-selected.
19. Production readiness requires the manually provisioned tenant,
    group, and active administrator; F03 provides no tenant
    onboarding workflow.
20. Invitation links are one-time and valid for 30 days; authenticated
    sessions last one workday and survive reloads.
21. PocketBase's built-in password validator is used without additional
    composition rules, and roles are exactly `administrator` and `regular`.
22. Deactivation blocks sign-in and new protected actions while preserving the
    user, bookings, and already-issued tokens until normal expiry.
23. Production uses SMTP2GO through protected server configuration, while local
    development and CI use non-network capture/test sinks.
24. Every UI feature defines and satisfies its desktop and narrow-screen
    workflow, including loading, empty, error, validation, focus, and
    destructive-action states; no core workflow is deferred to a later mobile
    port.
25. Authenticated destinations use a shared responsive application shell with
    role-aware navigation and current-user actions, while feature routes retain
    ownership of their domain-specific layouts.

## 15. Future considerations

Potential post-MVP work includes:

- Scheduled PocketBase backups to external S3-compatible storage.
- Audit logs and retained cancellation records.
- Tenant-specific timezones.
- Recurring bookings.
- Email booking notifications and reminders.
- Approval workflows.
- Resource availability schedules and capacity.
- Group-based resource access.
- Cross-tenant memberships.
- Tenant provisioning and platform administration.
- Mobile applications.
