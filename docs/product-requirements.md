# Asset Calendar Product Requirements

**Status:** Normative MVP requirements
**Last updated:** 2026-09-09

The non-secret operator boundary for the existing production tenant is defined
in the [production bootstrap contract](./production-bootstrap-contract.md).

## 1. Product summary

Asset Calendar is a multi-tenant resource booking system. Users select a
resource and reserve a time period in a calendar. Tenant administrators manage
resources, users, organizational units, bookings, and invoicing exports.

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
- Initial tenant, organizational-unit, and first-administrator provisioning is
  outside the MVP product workflow. For production, the operator manually
  provisions exactly one tenant for `nejsumlab.frontend-freelance.dk`, one
  organizational unit, and one active administrator in PocketBase. There is no
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
  - Cannot create training or maintenance bookings.
  - Must not see prices in booking views or forms.
- **Administrator**
  - View, create, and edit any booking.
  - Permanently delete a booking only while its current start time is in the
    future.
  - Create regular, training, and maintenance bookings.
  - Choose any active tenant user as the booker for a non-maintenance booking.
  - Manage resources, organizational units, and users.
  - Export booking data as CSV or Excel.
  - May view booking type in booking details and administration forms.
  - May view and edit resource rates in the resource administration form.

The system must always retain at least one active administrator per tenant.
Administrators cannot deactivate or demote the last active administrator.

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
- A user must belong to exactly one organizational unit.

SMTP2GO credentials remain server-side in protected VPS/PocketBase
configuration. The SPA never sends email or receives SMTP credentials. Local
development and CI use a mail capture or test sink rather than sending real
messages.

## 5. Booking requirements

### 5.1 Booking types

The MVP supports:

1. **Regular** - created by regular users or administrators.
2. **Training** - created only by administrators.
3. **Maintenance** - created only by administrators and used to block a
   resource.

Regular users do not see a booking type field. Their bookings are assigned the
regular type automatically.

Training bookings have a separate resource rate. Training is normally
intended to be more expensive, but the MVP does not enforce that the training
rate is greater than the regular rate.

Maintenance bookings are not billable and are excluded from invoicing
exports. For a maintenance booking, the creating administrator is recorded as
the booker.

### 5.2 Time and availability

- Time selection uses 15-minute increments.
- Bookings must have a positive duration; the practical minimum is 15 minutes.
- There is no configurable maximum duration.
- Bookings may span midnight.
- All new bookings must start in the future.
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
start must be at least 24 hours in the future. Administrators are not subject
to the 24-hour edit restriction. Administrator deletion follows the separate
future-start rule in section 5.5.

### 5.3 Pricing

- Currency is global for the application: DKK.
- Each active resource has:
  - A regular hourly rate.
  - A training hourly rate.
- Rates are required, non-negative, and limited to two decimal places.
- Billable amounts are prorated by actual duration. A 15-minute booking uses
  0.25 of the hourly rate.
- Each booking stores an hourly-rate snapshot. The calculated billable amount
  is derived during export and is not stored on the booking.
- The rate snapshot remains unchanged for the lifetime of the booking, even if
  the resource rate changes or an administrator edits the booking.
- Booking type cannot be changed after creation.
- Exported amounts are calculated from the booking's final duration and stored
  hourly-rate snapshot, then rounded to two decimal places using decimal
  half-up rounding.
- Duration and billing calculations use actual elapsed time between the stored
  UTC instants, including across daylight-saving transitions.
- Maintenance bookings have no billable rate or amount.
- Prices must never appear in calendar views, booking details, or regular-user
  forms.
- Resource rates are visible only in administrator resource forms and
  administrator exports.

### 5.4 Ownership and historical snapshots

A booking stores both:

- `booked_for_user` - the user whose booking it is and whose ownership
  determines regular-user edit/delete permission.
- `created_by_user` - the user who created the record.

For stable historical exports, the booking also stores:

- The booker's display-name snapshot.
- The booker's organizational-unit snapshot.
- The booker's email snapshot.
- The resource-name snapshot.
- The hourly-rate snapshot.

If an administrator creates a training booking for a regular user, ownership
follows the selected user. That user may edit or delete it before the 24-hour
cutoff, but cannot change its booking type.

### 5.5 Deletion

- Deletion is permanent in the MVP.
- There is no cancellation state.
- A regular user can permanently delete only their own eligible booking.
- An administrator can permanently delete a booking only while its current
  start time is in the future. Deletion eligibility follows the current start
  time if an administrator reschedules the booking.
- Administrators may edit any booking without time restrictions, including
  changing the dates and times of started or completed bookings.
- Deleted bookings are not included in exports.

## 6. Calendar and user experience

### 6.1 Desktop layout

The desktop booking screen has:

- A resource list in the left pane.
- A larger calendar pane for the selected resource.
- Calendar navigation for previous, current, and next periods.
- Day, week, and month views.

If the tenant has exactly one active resource, it is selected automatically. If
there are multiple resources, no resource is selected automatically and the
user must choose one.

The desktop week view starts on Monday and uses 24-hour time formatting.

### 6.2 Mobile layout

Mobile uses:

- Daily view only.
- A compact resource selector above the calendar.
- No slide-in resource drawer.
- A full-screen create/edit form.

If there is exactly one active resource, it is selected automatically. With
multiple resources, the user must select one.

### 6.3 Creating bookings

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
- Administrators see the booking type field and, for non-maintenance bookings,
  may select the active user the booking is for.
- Maintenance bookings use the creating administrator as the booker.
- The form does not show prices.

### 6.4 Viewing, editing, and deleting bookings

Selecting an existing booking opens a detail view before any destructive
action. The same desktop right-pane and mobile full-screen form behavior is
used for editing.

Regular users see:

- Booker's display name.
- Booking start and end time.
- Edit/delete actions only when the 24-hour rule permits them.
- Maintenance bookings appear only as generic unavailable blocks, without the
  booking type or administrator identity.

Administrators may additionally see booking type and may edit or delete any
booking. Prices remain hidden in booking details.

The resource remains fixed while editing. Moving a booking to another resource
is not supported in the MVP.

Deletion requires an explicit confirmation for every user type, including
regular users and administrators.

### 6.5 Calendar implementation

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
  - Configure regular and training rates.
  - Resource names must be unique within a tenant.
  - Archiving is immediate and permanent; resources cannot be unarchived.
  - Archived resources cannot receive new bookings but remain visible for
    existing and future bookings.
- Organizational units.
  - Create and edit a name.
  - Organizational-unit names must be unique within a tenant.
  - Assign every user to exactly one unit.
  - Prevent deletion while users are assigned.
- Users.
  - Create regular and administrator users.
  - Assign an organizational unit.
  - Send an invitation email so the user can create a password.
  - Change role and deactivate users, subject to the last-admin rule.
- Exports.
  - Select a start date/time and end date/time.
  - Export CSV or Excel (`.xlsx`).

Administrators use the regular booking area to create, edit, and permanently
delete eligible future bookings. The administration area does not contain a
separate booking management screen. From the regular booking area,
administrators can create bookings for active users and create training or
maintenance bookings.

## 8. Invoicing exports

Exports are administrator-only and must be generated with server-side
authorization and tenant scoping.

The selected interval uses the application timezone, with an inclusive start
and exclusive end. Include bookings whose start time is greater than or equal
to the selected start and less than the selected end. Exclude maintenance and
permanently deleted bookings.

Each exported booking row contains:

- Tenant
- Organizational-unit snapshot
- Booker display-name snapshot
- Booker email snapshot
- Resource-name snapshot
- Booking type
- Start time
- End time
- Duration
- Hourly-rate snapshot
- Amount in DKK calculated from the final duration and hourly-rate snapshot

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
- Organizational-unit ID
- Active/deactivated status
- Invitation and password-setup state required to complete first-time access

### OrganizationalUnit

- ID
- Tenant ID
- Name

### Resource

- ID
- Tenant ID
- Name
- Regular hourly rate
- Training hourly rate
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
- Hourly-rate snapshot
- Booker display-name snapshot
- Organizational-unit snapshot
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
- Training and maintenance booking permissions.
- Resource archive behavior.
- User deactivation and last-administrator protection.
- Organizational-unit deletion protection.
- Rate, booker name, booker email, resource name, and organizational-unit
  snapshots.
- CSV and Excel export filtering and contents.
- Tenant isolation for reads, writes, and exports.

Add a small end-to-end smoke test covering sign-in, resource selection, booking
creation, and booking visibility.

## 14. MVP acceptance criteria

The MVP is ready when:

1. A user can sign in on the correct tenant subdomain.
2. A regular user can select a resource and create a future regular booking.
3. A second user can see that booking's time and booker but not its price.
4. An overlapping booking for the same resource is rejected.
5. A regular user can edit/delete their own eligible booking but is blocked
   inside the 24-hour window.
6. A regular user cannot edit/delete another user's booking.
7. An administrator can create and edit any booking, and can delete a booking
   only while its current start time is in the future.
8. An administrator can create training and maintenance bookings.
9. Maintenance blocks the resource but does not appear in invoicing exports.
10. Calendar behavior works in desktop day/week/month views and mobile daily
    view.
11. Mobile uses a compact resource selector and no drag-and-drop.
12. Administrators can manage resources, users, and organizational units.
13. Administrators can export the selected booking interval as CSV and Excel.
14. Exported rates and amounts use booking snapshots, actual elapsed duration,
    and decimal half-up DKK rounding.
15. Cross-tenant reads and writes are rejected by backend enforcement.
16. The application can be built as static files and served by the existing
    Nginx installation.
17. The existing production tenant is resolved from
    `nejsumlab.frontend-freelance.dk`; tenant identity is never client-selected.
18. Production readiness requires the manually provisioned tenant,
    organizational unit, and active administrator; F03 provides no tenant
    onboarding workflow.
19. Invitation links are one-time and valid for 30 days; authenticated
    sessions last one workday and survive reloads.
20. PocketBase's built-in password validator is used without additional
    composition rules, and roles are exactly `administrator` and `regular`.
21. Deactivation blocks sign-in and new protected actions while preserving the
    user, bookings, and already-issued tokens until normal expiry.
22. Production uses SMTP2GO through protected server configuration, while local
    development and CI use non-network capture/test sinks.

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
