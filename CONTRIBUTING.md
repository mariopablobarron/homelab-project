# Contributing

Thanks for helping improve Homelab Dashboard.

This project contains two native apps:

- `HomelabSwift/` for iOS.
- `HomelabAndroid/` for Android.

The repository also now includes a shared declarative connector catalog under
`connectors/`. That catalog is the preferred starting point for new service
integrations because it documents the service contract before native UI work
begins.

## Good First Contributions

- Add or improve a connector JSON file in `connectors/services/`.
- Add compatibility notes for a service version you tested.
- Improve setup docs for a specific service.
- Add screenshots to existing docs.
- Add model decoding tests for API responses.

## Adding a Service Connector

1. Read [`docs/service-connectors.md`](docs/service-connectors.md).
2. Create a JSON file in `connectors/services/`.
3. Keep the first version read-only unless write actions are essential.
4. Mark risky actions clearly:
   - `safe-write` for reversible writes.
   - `destructive` for delete/reset/remove operations.
5. Include security notes for tokens, TLS, public exposure, or scopes.
6. Run:

   ```bash
   node scripts/validate-connectors.mjs
   ```

## Native App Changes

When changing iOS or Android code:

- Keep platform conventions intact.
- Avoid logging tokens, passwords, cookies, API keys, or full backup payloads.
- Add confirmation UI for write/destructive actions.
- Prefer read-only API scopes when a service supports them.
- Add model decoding or repository tests where possible.

## Pull Request Checklist

- [ ] The app still builds on the touched platform.
- [ ] New connector files pass `node scripts/validate-connectors.mjs`.
- [ ] No secrets, private hostnames, or tokens are committed.
- [ ] New destructive actions require explicit confirmation.
- [ ] User-facing text is clear for non-expert homelab users.
