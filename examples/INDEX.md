# Skill → Reference Implementation Index

Every skill in `.github/skills/` describes **how** to do something. This file maps each skill to the canonical, working implementation in this `examples/` directory.

> **Convention:** when a skill says "see [examples/...](...)", the path resolves to a file in this index.

---

## Domain Layer

| Skill | Reference file(s) |
|---|---|
| `new-domain-package` | [packages/user-domain/](packages/user-domain/) (full DynamoDB tree) · [packages/order-domain/](packages/order-domain/) (full Prisma tree) |
| `new-domain-entity` | [packages/user-domain/src/domain/entities/user.entity.ts](packages/user-domain/src/domain/entities/user.entity.ts) · [packages/order-domain/src/domain/entities/order.entity.ts](packages/order-domain/src/domain/entities/order.entity.ts) |
| `domain-business-rules` | [packages/order-domain/src/domain/entities/order.entity.ts](packages/order-domain/src/domain/entities/order.entity.ts) (status transitions + invariants) |
| `new-use-case` | [packages/user-domain/src/application/use-cases/](packages/user-domain/src/application/use-cases/) (one folder per operation) |
| `parse-domain-spec` | [packages/order-domain/](packages/order-domain/) (multi-entity domain with aggregates) |

## Persistence

| Skill | Reference file(s) |
|---|---|
| `dynamo-repository` | [packages/user-domain/src/infrastructure/repositories/dynamo-user.repository.ts](packages/user-domain/src/infrastructure/repositories/dynamo-user.repository.ts) · [packages/product-domain/src/infrastructure/repositories/dynamo-product.repository.ts](packages/product-domain/src/infrastructure/repositories/dynamo-product.repository.ts) |
| `new-dynamo-schema` | [packages/user-domain/src/infrastructure/schemas/UserSchema.ts](packages/user-domain/src/infrastructure/schemas/UserSchema.ts) |
| `prisma-repository` | [packages/order-domain/src/infrastructure/repositories/prisma-order.repository.ts](packages/order-domain/src/infrastructure/repositories/prisma-order.repository.ts) |
| `new-prisma-schema` | [packages/order-domain/src/infrastructure/prisma/schema.prisma](packages/order-domain/src/infrastructure/prisma/schema.prisma) |

## Contracts

| Skill | Reference file(s) |
|---|---|
| `add-contracts` | [packages/contracts/user/src/schemas.ts](packages/contracts/user/src/schemas.ts) · [packages/contracts/order/src/schemas.ts](packages/contracts/order/src/schemas.ts) |
| `contracts-subpath-imports` | [packages/contracts/user/package.json](packages/contracts/user/package.json) (per-domain package layout) |

## Service Composition (NestJS)

| Skill | Reference file(s) |
|---|---|
| `nestjs-service-layers` | [apps/users/user-api-service/src/](apps/users/user-api-service/src/) (full presentation/application/module wiring) |
| `prisma-service-wiring` | [apps/orders/order-api-service/src/modules/order.module.ts](apps/orders/order-api-service/src/modules/order.module.ts) · [apps/orders/order-api-service/src/infrastructure/config/prisma.config.ts](apps/orders/order-api-service/src/infrastructure/config/prisma.config.ts) |
| `nx-microservice-scaffold` | [apps/users/user-api-service/project.json](apps/users/user-api-service/project.json) · [apps/users/user-api-service/webpack.config.js](apps/users/user-api-service/webpack.config.js) |
| `add-api-endpoints` | [apps/users/user-api-service/src/presentation/controllers/user.controller.ts](apps/users/user-api-service/src/presentation/controllers/user.controller.ts) |
| `swagger-controller-docs` | [apps/users/user-api-service/src/main.ts](apps/users/user-api-service/src/main.ts) (bootstrap) · [apps/users/user-api-service/src/presentation/controllers/user.controller.ts](apps/users/user-api-service/src/presentation/controllers/user.controller.ts) (decorators) |
| `domain-exception-filter` | [apps/users/user-api-service/src/presentation/filters/domain-exception.filter.ts](apps/users/user-api-service/src/presentation/filters/domain-exception.filter.ts) |
| `current-user-decorator` | [apps/users/user-api-service/src/presentation/decorators/current-user.decorator.ts](apps/users/user-api-service/src/presentation/decorators/current-user.decorator.ts) |
| `add-feature-existing-domain` | Diff between [packages/user-domain/](packages/user-domain/) and [apps/users/user-api-service/](apps/users/user-api-service/) — full add-feature stack |

## Async / Events

| Skill | Reference file(s) |
|---|---|
| `sqs-event-driven-service` | [apps/users/user-event-handler-service/src/](apps/users/user-event-handler-service/src/) (intra-domain consumer) |
| `sqs-event-publisher` | [apps/products/product-api-service/src/application/services/product-application.service.ts](apps/products/product-api-service/src/application/services/product-application.service.ts) (publishes from app service) |
| `cross-domain-event-handler` | [apps/orders/order-event-handler-service/src/](apps/orders/order-event-handler-service/src/) (consumes product events) |
| `choreography-saga` | [apps/orders/order-api-service/src/application/use-cases/create-order/create-order.use-case.ts](apps/orders/order-api-service/src/application/use-cases/create-order/) (initiator) · [apps/products/product-event-handler-service/](apps/products/product-event-handler-service/) (responder) · [apps/orders/order-event-handler-service/](apps/orders/order-event-handler-service/) (resolver) |
| `sync-cross-service-call` | [apps/orders/order-api-service/src/infrastructure/clients/](apps/orders/order-api-service/src/infrastructure/clients/) (ACL adapter) · [packages/order-domain/src/application/interfaces/](packages/order-domain/src/application/interfaces/) (port) |

## Webapp (Next.js)

| Skill | Reference file(s) |
|---|---|
| `webapp-new-page` | [apps/webapp/src/app/(protected)/users/page.tsx](apps/webapp/src/app/(protected)/users/page.tsx) · [apps/webapp/src/app/(protected)/orders/page.tsx](apps/webapp/src/app/(protected)/orders/page.tsx) |
| `webapp-api-client-hooks` | [packages/client-common-examples/src/hooks/use-users.ts](packages/client-common-examples/src/hooks/use-users.ts) · [packages/client-common-examples/src/infrastructure/api-clients/users-api.client.ts](packages/client-common-examples/src/infrastructure/api-clients/users-api.client.ts) |
| `webapp-form-with-validation` | [apps/webapp/src/components/users/](apps/webapp/src/components/users/) (forms reuse contract Zod schemas) |
| `webapp-data-table` | [apps/webapp/src/components/users/users-table.tsx](apps/webapp/src/components/users/users-table.tsx) |
| `webapp-cursor-infinite-scroll` | [packages/client-common-examples/src/hooks/](packages/client-common-examples/src/hooks/) (`useUsersByStatusInfinite`) |
| `webapp-optimistic-mutations` | [packages/client-common-examples/src/hooks/](packages/client-common-examples/src/hooks/) (status-toggle mutations) |
| `webapp-error-boundaries` | [apps/webapp/src/app/(protected)/](apps/webapp/src/app/(protected)/) (`error.tsx` + `loading.tsx` per segment) |
| `webapp-toast-notifications` | [apps/webapp/src/app/layout.tsx](apps/webapp/src/app/layout.tsx) (`<Toaster />`) + mutation handlers in domain components |
| `webapp-skeleton-loading` | [apps/webapp/src/app/(protected)/users/loading.tsx](apps/webapp/src/app/(protected)/users/loading.tsx) |
| `webapp-file-upload-ux` | [apps/webapp/src/components/](apps/webapp/src/components/) — direct-to-S3 upload with `<FileDropzone>` |
| `webapp-auth-middleware` | [apps/webapp/src/middleware.ts](apps/webapp/src/middleware.ts) |

## Mobile (Expo / React Native)

| Skill | Reference file(s) |
|---|---|
| `mobile-new-screen` | [apps/mobile/src/app/(tabs)/users.tsx](apps/mobile/src/app/(tabs)/users.tsx) · [apps/mobile/src/app/users/[userId].tsx](apps/mobile/src/app/users/[userId].tsx) |
| `mobile-new-domain-feature` | Same files as `mobile-new-screen` plus the matching `client-common-examples` hook |
| `mobile-secure-storage-auth` | [apps/mobile/src/app/_layout.tsx](apps/mobile/src/app/_layout.tsx) (`createSecureTokenStorage()` wiring) |
| `mobile-error-boundary-sentry` | [apps/mobile/src/app/_layout.tsx](apps/mobile/src/app/_layout.tsx) (`Sentry.init` + `Sentry.wrap`) |
| `mobile-deep-linking` | [apps/mobile/app.config.ts](apps/mobile/app.config.ts) + [apps/mobile/DEEP_LINKING.md](apps/mobile/DEEP_LINKING.md) |

## Testing

| Skill | Reference file(s) |
|---|---|
| `write-domain-tests` | [packages/user-domain/src/domain/entities/user.entity.spec.ts](packages/user-domain/src/domain/entities/user.entity.spec.ts) · [packages/user-domain/src/application/use-cases/](packages/user-domain/src/application/use-cases/) (`*.spec.ts` per use case) |
| `write-webapp-tests` | [apps/webapp/src/components/users/](apps/webapp/src/components/users/) (`*.spec.tsx`) |
| `write-mobile-tests` | [apps/mobile/src/components/users/](apps/mobile/src/components/users/) |
| `write-client-common-tests` | [packages/client-common-examples/src/hooks/](packages/client-common-examples/src/hooks/) (`*.spec.ts`) |
| `write-api-e2e-tests` | [apps/users/user-api-service-e2e/](apps/users/user-api-service-e2e/) · [apps/orders/order-api-service-e2e/](apps/orders/order-api-service-e2e/) |
| `write-webapp-e2e-tests` | [apps/webapp-e2e/src/specs/](apps/webapp-e2e/src/specs/) |
| `e2e-infrastructure` | [scripts/](scripts/) (mirrors root setup-e2e but for example tables/queues only) |

---

## Where the main workspace still owns the canonical reference

A few skills point at code that **stays in the main workspace** (not duplicated here) because they're production scaffolding, not example domains:

| Skill | Lives in main workspace |
|---|---|
| `auth-api-service` | `apps/auth/auth-api-service/` |
| `file-upload-s3` | `apps/files/file-api-service/` |
| `gateway-jwt-auth` | `infra/modules/api-gateway/` + `.github/service-registry.json` |
| `cd-register-service` | `infra/environments/*/` + `.github/service-registry.json` |
| `cloudfront-cdn` | `infra/modules/cloudfront-webapp/` + `infra/modules/cloudfront-s3/` |
| `lambda-function-url` | `infra/modules/lambda-webapp/` |
| `infra-new-module` | `infra/modules/` |
| `init-runner-deploy-task` | `infra/modules/init-runner/` + `infra/init-runner/` |
| `add-monitoring`, `add-notifications` | `infra/modules/monitoring/` + `infra/modules/notifications/` |
| `extend-monitoring-service` | `apps/monitoring/` |
| `webapp-ui-primitive`, `mobile-ui-primitive`, `webapp-radix-primitive-wrap` | `packages/ui/` + `packages/mobile-ui/` (still in main — examples just consume them via `link:`) |
| `fe-design-tokens`, `webapp-dark-mode`, `fe-icon-set`, `fe-accessibility-audit`, `fe-performance-bundle-analysis` | `packages/ui/src/lib/tokens.ts` + `apps/webapp/src/app/globals.css` |
| `xray-adot-setup` | `infra/modules/lambda-api/` |
| `secrets-rotation` | `packages/aws/aws-secrets/` + `infra/modules/secrets/` |
| `notification-domain` | (planning skill — no code yet) |
| `mobile-cd-pipeline`, `mobile-eas-build-update`, `mobile-app-icon-splash`, `mobile-push-notifications` | `.github/workflows/cd-mobile-deploy.yml` + `apps/mobile/app.config.ts` (in main) |
| `nx-*`, `link-workspace-packages`, `monitor-ci`, `add-structural-lint-check`, `generate-env-local`, `debug-local-dev`, `local-seed-data`, `parse-page-spec`, `figma-to-ui-component`, `figma-to-ui-screen` | Tooling / process skills — no per-domain reference file |

---

## Refresh checklist

When a skill changes the canonical pattern (e.g. a new mandatory layer, a renamed token, a guard contract change):

1. Update the main `packages/`/`apps/` files first.
2. Mirror the change here in `examples/` (or rely on `link:` for shared packages — `ui`, `mobile-ui`, `telemetry`, `aws-*` propagate automatically).
3. Run `cd examples && pnpm nx run-many -t test,build` to confirm nothing drifted.
4. Bump this INDEX if any reference paths moved.
