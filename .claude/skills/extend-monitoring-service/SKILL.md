---
name: extend-monitoring-service
description: Add a new endpoint, view, or AWS data source to the internal monitoring tool (apps/monitoring/monitoring-api-service + apps/monitoring/monitoring-webapp). Use this when extending the in-house dashboard with new metrics, alarm types, log search, or service health checks.
---

# Extend the Monitoring Tool

The monitoring tool is an **internal-only** Next.js dashboard + NestJS API for inspecting CloudWatch alarms, X-Ray traces, and Lambda invocation logs across environments. It uses a single deployment that switches AWS accounts via the `X-Target-Environment` request header.

> ⚠️ This is **not** a pattern for production user-facing apps. Authentication is intentionally simple (single internal user, session token in localStorage). Do not copy these patterns to customer-facing services.

Canonical references:
- `apps/monitoring/monitoring-api-service/` — NestJS API
- `apps/monitoring/monitoring-webapp/` — Next.js dashboard
- `packages/monitoring-sdk/` — Lambda + X-Ray providers
- `docs/monitoring.md` — high-level architecture

---

## Architecture Recap

```
monitoring-webapp (Next.js Lambda container)
  ↓  Bearer token + X-Target-Environment: dev|staging|prod
monitoring-api-service (NestJS Lambda container)
  ↓  AssumeRole into target account
AWS APIs (CloudWatch, X-Ray, Lambda)
```

The API service has **one Lambda execution role** that can `sts:AssumeRole` into a per-environment monitoring read-only role. The `X-Target-Environment` header tells the API which role to assume per request.

---

## Part 1 — Pick the Layer to Extend

| Goal | Where to add code |
|---|---|
| New AWS data source (e.g. ECS, RDS metrics) | `packages/monitoring-sdk/src/providers/{name}.provider.ts` |
| New API endpoint | `apps/monitoring/monitoring-api-service/src/presentation/controllers/{name}.controller.ts` |
| New API service method | `apps/monitoring/monitoring-api-service/src/application/services/{name}.service.ts` |
| New dashboard page | `apps/monitoring/monitoring-webapp/src/app/{route}/page.tsx` |
| New shared dashboard component | `apps/monitoring/monitoring-webapp/src/components/{name}/` |
| New typed fetch hook | `apps/monitoring/monitoring-webapp/src/lib/use-monitoring-api.ts` (extend the existing wrapper) |

---

## Part 2 — Add a New Provider in `monitoring-sdk` (if needed)

```ts
// packages/monitoring-sdk/src/providers/ecs.provider.ts
import { ECSClient, ListServicesCommand, DescribeServicesCommand } from '@aws-sdk/client-ecs';
import { createLogger } from '@old-st/telemetry';

const logger = createLogger('monitoring-sdk-ecs');

export interface EcsServiceSummary {
  clusterName: string;
  serviceName: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
}

export class EcsProvider {
  constructor(private readonly client: ECSClient) {}

  async listServices(clusterName: string): Promise<EcsServiceSummary[]> {
    logger.info('Listing ECS services', { clusterName });

    const list = await this.client.send(new ListServicesCommand({ cluster: clusterName }));
    if (!list.serviceArns?.length) return [];

    const detail = await this.client.send(
      new DescribeServicesCommand({ cluster: clusterName, services: list.serviceArns }),
    );

    return (detail.services ?? []).map((s) => ({
      clusterName,
      serviceName: s.serviceName ?? 'unknown',
      desiredCount: s.desiredCount ?? 0,
      runningCount: s.runningCount ?? 0,
      pendingCount: s.pendingCount ?? 0,
    }));
  }
}
```

Add the SDK package as a dependency (`@aws-sdk/client-ecs`) in `packages/monitoring-sdk/package.json`.

Re-export from `packages/monitoring-sdk/src/index.ts`.

---

## Part 3 — Add the IAM Permission

The monitoring read-only role in the target account must allow the new AWS service. Edit the role's IAM policy:

```hcl
# infra/environments/{env}/monitoring/iam.tf (or similar — varies by setup)
data "aws_iam_policy_document" "monitoring_readonly" {
  # ... existing CloudWatch / Lambda / X-Ray statements ...

  statement {
    sid    = "EcsRead"
    effect = "Allow"
    actions = [
      "ecs:ListClusters",
      "ecs:ListServices",
      "ecs:DescribeServices",
      "ecs:DescribeClusters",
    ]
    resources = ["*"]
  }
}
```

Apply via `cd-monitoring-deploy.yml` workflow (or `infra/environments/{env}/monitoring/` Terraform).

---

## Part 4 — Add the Application Service Method

```ts
// apps/monitoring/monitoring-api-service/src/application/services/ecs.service.ts
import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { EcsProvider } from '@old-st/monitoring-sdk';
import { AwsClientFactory } from '../../infrastructure/aws/aws-client-factory';

const logger = createLogger('ecs-service');

@Injectable()
export class EcsService {
  constructor(private readonly clientFactory: AwsClientFactory) {}

  async listServices(targetEnv: string, clusterName: string) {
    logger.info('Listing ECS services', { targetEnv, clusterName });

    const client = await this.clientFactory.ecs(targetEnv);
    const provider = new EcsProvider(client);
    return provider.listServices(clusterName);
  }
}
```

`AwsClientFactory` is the existing helper that calls `sts:AssumeRole` for the target environment and constructs an SDK client with temporary credentials.

---

## Part 5 — Add the Controller

```ts
// apps/monitoring/monitoring-api-service/src/presentation/controllers/ecs.controller.ts
import { Controller, Get, Headers, Param } from '@nestjs/common';
import { EcsService } from '../../application/services/ecs.service';

@Controller('ecs')
export class EcsController {
  constructor(private readonly ecsService: EcsService) {}

  @Get('clusters/:clusterName/services')
  async listServices(
    @Headers('x-target-environment') targetEnv: string,
    @Param('clusterName') clusterName: string,
  ) {
    return this.ecsService.listServices(targetEnv, clusterName);
  }
}
```

The `JwtAuthGuard` (already wired as `APP_GUARD`) protects this automatically.

Register the controller and service in the appropriate module (`apps/monitoring/monitoring-api-service/src/modules/ecs.module.ts`) and import it from `AppModule`.

---

## Part 6 — Add the Webapp Hook

The existing `use-monitoring-api.ts` wraps `fetch` with the auth header + target environment. Add a typed method:

```ts
// apps/monitoring/monitoring-webapp/src/lib/use-monitoring-api.ts
export function useEcsServices(clusterName: string) {
  const api = useMonitoringApi();
  return useQuery({
    queryKey: ['ecs-services', api.targetEnv, clusterName],
    queryFn: () => api.get(`/ecs/clusters/${clusterName}/services`),
    enabled: !!clusterName,
  });
}
```

---

## Part 7 — Add the Dashboard Page

```tsx
// apps/monitoring/monitoring-webapp/src/app/ecs/page.tsx
'use client';

import { useEcsServices } from '@/lib/use-monitoring-api';

export default function EcsPage() {
  const { data, isLoading } = useEcsServices('my-cluster');

  if (isLoading) return <div>Loading…</div>;

  return (
    <div>
      <h1>ECS Services</h1>
      <table>
        <thead>
          <tr><th>Service</th><th>Desired</th><th>Running</th></tr>
        </thead>
        <tbody>
          {data?.map((s) => (
            <tr key={s.serviceName}>
              <td>{s.serviceName}</td>
              <td>{s.desiredCount}</td>
              <td>{s.runningCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Wire navigation in the dashboard sidebar/layout.

---

## Part 8 — Test Locally

The monitoring tool runs locally with the `Monitoring: Start All` VS Code task. It expects valid AWS credentials in your shell (the local bypass for `LocalAuthProvider` does not apply to monitoring — it always assumes real credentials).

```sh
# In one terminal
aws sso login --profile dev-readonly
export AWS_PROFILE=dev-readonly

# Run the task: "Monitoring: Start All"
# Open http://localhost:4300
# Sign in with the seeded user
# Navigate to /ecs and verify data loads
```

---

## Part 9 — Deploy

Trigger via the **`Monitoring Deploy: Trigger`** VS Code task or the `cd-monitoring-deploy.yml` workflow. Select the target environment.

---

## Output Checklist

- [ ] New SDK provider added to `packages/monitoring-sdk/` and exported
- [ ] Required `@aws-sdk/client-{name}` dependency added
- [ ] IAM read-only role updated with the new AWS service permissions
- [ ] Application service injects `AwsClientFactory` and uses the new provider
- [ ] Controller declared with `@Headers('x-target-environment')`
- [ ] Module wires the new service and controller
- [ ] Webapp hook added to `use-monitoring-api.ts`
- [ ] Dashboard page added under `apps/monitoring/monitoring-webapp/src/app/`
- [ ] Tests added (mock `AwsClientFactory` in the service test)
- [ ] Local smoke test passes against a real AWS account
- [ ] Deployed via `cd-monitoring-deploy.yml`
