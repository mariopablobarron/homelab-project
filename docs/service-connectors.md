# Declarative Service Connectors

The native iOS and Android apps currently implement every service integration
by hand. That keeps the platform UI polished, but it also makes each new
service expensive to add twice.

The `connectors/` directory introduces a small declarative layer that can be
used as a shared contract between platforms.

## Goals

- Keep iOS and Android fully native.
- Describe common service metadata once.
- Make new integrations easier to review.
- Separate read-only dashboard data from write/destructive actions.
- Document auth, compatibility, and security expectations per service.

This is not a plugin runtime yet. It is the first stable contract that a future
runtime, generator, or platform adapter can consume.

## Directory Layout

```text
connectors/
  schema/
    service-connector.schema.json
  services/
    portainer.json
    pihole.json
    uptime-kuma.json
scripts/
  validate-connectors.mjs
```

## Connector Shape

Each connector describes:

- `id` and `displayName`
- category and icon metadata
- base URL hints
- authentication type and credential fields
- read/write/destructive capabilities
- endpoints used by the integration
- metrics that can be displayed in dashboards
- actions that require confirmation
- iOS/Android support status
- compatibility and security notes

Example:

```json
{
  "schemaVersion": 1,
  "id": "example-service",
  "displayName": "Example Service",
  "category": "observability",
  "baseUrl": {
    "placeholder": "https://example.local",
    "allowSelfSignedTls": true
  },
  "auth": {
    "type": "api_key",
    "header": "Authorization",
    "credentialFields": [
      {
        "key": "apiKey",
        "label": "API key",
        "secret": true,
        "required": true
      }
    ]
  },
  "capabilities": {
    "read": true,
    "write": false,
    "destructiveActions": false
  },
  "endpoints": [
    {
      "id": "status",
      "method": "GET",
      "path": "/api/status",
      "purpose": "Read service status.",
      "risk": "read"
    }
  ],
  "platforms": {
    "ios": "planned",
    "android": "planned"
  }
}
```

## Validation

Run:

```bash
node scripts/validate-connectors.mjs
```

The validator checks:

- valid connector ids
- supported categories, auth types, and platform statuses
- unique endpoint, metric, and action ids
- metric/action references to existing endpoints
- mandatory confirmation for destructive endpoints
- consistency between destructive actions and declared capabilities

## Adding a New Service

1. Create `connectors/services/<service-id>.json`.
2. Use kebab-case for ids, metrics, endpoints, and actions.
3. Start with read-only endpoints when possible.
4. Mark write actions as `safe-write` or `destructive`.
5. Add `confirmationText` to every action.
6. Add compatibility notes with the service versions you tested.
7. Run `node scripts/validate-connectors.mjs`.
8. In a later PR, wire the connector into iOS and/or Android.

## Platform Integration Plan

Recommended next steps:

1. **Catalog import**: load connector metadata into each native app at build
   time.
2. **Connection form generator**: use `auth.credentialFields` and `baseUrl` to
   render a consistent add-service screen.
3. **Read-only cards**: use `metrics` to render simple dashboard cards.
4. **Runtime adapters**: map endpoint definitions to platform-specific API
   clients, including special transports such as Socket.IO.
5. **Action guardrails**: centralize confirmation and destructive-action UX.

The existing native integrations should remain the source of truth until a
connector has enough runtime coverage to replace duplicated code safely.
