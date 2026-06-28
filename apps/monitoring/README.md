# Monitoring (Internal Tool)

Two services that together form the in-house observability dashboard for the platform:

| App | Purpose | Port |
|---|---|---|
| `monitoring-api-service` | Reads CloudWatch alarms, X-Ray traces, service health, deploy history | **8080** |
| `monitoring-webapp` | Next.js dashboard that consumes the API | **4300** |

This is an **internal tool** — not a customer-facing product. Auth is a simple session-token model stored in localStorage. **Do not** use this auth model for production user-facing services.

## Local dev

```sh
# Both at once via VS Code task: "Monitoring: Start All"
pnpm nx serve monitoring-api-service
pnpm nx serve monitoring-webapp
```

Open http://localhost:4300, sign in with the local mock token, and select an environment from the header to view alarms / traces / metrics for that AWS account.

## Endpoints (monitoring-api-service)

Prefixed with `/api`:

- `POST /auth/sign-in` — issues session token
- `GET /alarms` — CloudWatch alarms grouped by service
- `GET /traces` — X-Ray traces with filtering by service / time window / error status
- `GET /traces/:traceId` — single trace timeline
- `GET /services` — service registry + last-deploy metadata
- `GET /health` — liveness

Every protected endpoint requires `Authorization: Bearer <session-token>` and `X-Target-Environment: dev|staging|prod` (the API switches AWS SDK clients per request based on this header).

## Deployment

Deployed independently via **`cd-monitoring-deploy.yml`** — both services ship as Lambda container images with separate ECR repos. Use the `Monitoring Deploy: Trigger` VS Code task.

The monitoring tool can deploy to its own AWS account (recommended — separation of concerns) or to one of the platform accounts. Configure via the `MONITORING_*` repo variables.

## Extending

To add a new view, metric, or AWS data source: load the **[extend-monitoring-service](../../.claude/skills/extend-monitoring-service/SKILL.md)** skill.

## See also

- [docs/monitoring.md](../../docs/monitoring.md) — observability strategy across the whole platform
- [.claude/skills/add-monitoring](../../.claude/skills/add-monitoring/) — wire alarms to a new domain service
- [packages/monitoring-sdk](../../packages/monitoring-sdk/) — types shared with consumers
