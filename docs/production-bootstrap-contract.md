# Production Bootstrap Contract

**Status:** Version-controlled, non-secret operator contract
**Applies to:** F03 production readiness
**Related:** [F03 parent issue #29](https://github.com/cbtgit/asset-calendar/issues/29), [manual prerequisite #30](https://github.com/cbtgit/asset-calendar/issues/30)

This document describes the boundary between the application and the operator.
It contains lookup rules and configuration names only. Passwords, invitation
links, SMTP credentials, database exports, and private production record data
must remain on the VPS or in the protected operator systems.

## Production identity

- Application root domain: `frontend-freelance.dk`.
- Configured tenant host: `nejsumlab.frontend-freelance.dk`.
- SMTP sender infrastructure: `mail.frontend-freelance.dk`. This is not a
  tenant host and must not resolve as one.
- The tenant host is supplied through
  `ASSET_CALENDAR_ROOT_DOMAIN` and `ASSET_CALENDAR_TENANT_HOSTS`. Tenant
  identity is derived from the trusted request host, never from a client tenant
  ID, route parameter, browser state, or request body.

## Manual bootstrap boundary

Production onboarding is ready only after an operator has manually provisioned
all of the following in the production PocketBase data:

1. One tenant whose `subdomain` is `nejsumlab`.
2. One organizational unit belonging to that tenant. Its `name` is the
   operator-supplied stable organizational-unit name.
3. One active user belonging to that tenant and organizational unit, with the
   operator-supplied stable email identity, `role=administrator`, and completed
   initial password setup.

The record IDs, administrator password, and any invitation or setup credential
are operator-managed values and are not stored in Git. F03 has no tenant
onboarding or self-service provisioning UI. Later invitations are sent by the
administrator through the protected application flow.

## Stable lookup rules

- Resolve the tenant by the exact normalized `tenants.subdomain` value
  `nejsumlab`, under the configured root domain.
- Resolve the initial organizational unit by its `tenant` relation and the
  exact operator-supplied `name`. Organizational-unit names are unique within a
  tenant.
- Resolve the initial administrator by the tenant relation and the exact
  operator-supplied PocketBase email identity. Require `active=true` and
  `role=administrator`; do not select an administrator by position, creation
  order, or guessed email.
- The host resolver and authorization hooks use the tenant record selected by
  the trusted host. They do not create records when a lookup is missing.

## Migration and preservation behavior

F03 migrations reconcile schema and safe missing defaults; they do not seed,
duplicate, or guess production records.

- When the existing records and required relations are present, migrations
  preserve their IDs and intentional values while applying the versioned schema.
- When the tenant, organizational unit, or administrator is missing, migrations
  may still apply the schema, but production is not bootstrap-ready. An
  operator must provision the missing record manually before production
  onboarding or an invitation smoke test.
- When a missing relation cannot be assigned to exactly one existing tenant or
  organizational unit, migration reconciliation fails rather than choosing a
  record. Duplicate tenant subdomains and duplicate organizational-unit names
  within a tenant are rejected by the schema's unique constraints.
- Migrations never import production data into a release, local workspace, or
  CI fixture. Production records are preserved and never duplicated or guessed.

Deployment applies migrations to the persistent PocketBase data directory
before starting the service. A failed service activation or health check
restores the previous `current` release symlink and attempts to restart the
previous service. This release rollback does not reverse an already-applied
database migration; database recovery requires the operator's backup and
recovery procedure.

## Operator prerequisites

Before a production invitation smoke test:

- The SMTP2GO account is approved and the sender domain
  `mail.frontend-freelance.dk` has its provider-required SPF and DKIM records
  plus a DMARC policy.
- SMTP2GO host, port, username, password, and sender values are stored only in
  the protected VPS file `/etc/asset-calendar/auth.env`, owned and permissioned
  as documented in [README.md](../README.md). They are never placed in
  `.env.example`, frontend code, a release directory, or an issue.
- The VPS runs no inbound SMTP service and exposes PocketBase only through the
  Nginx HTTPS boundary.
- The operator verifies delivery to an operator-controlled address. The
  repository's local and CI transports are `capture` and `test`; neither sends
  real mail.

The manual SMTP2GO/DNS/VPS prerequisite is tracked as completed in issue #30;
the production smoke test remains an operator-controlled action and must not be
automated with repository credentials.
