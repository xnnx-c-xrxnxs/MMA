# TODO — Customer domain

Status: COMPLETE — refined to match `.specs/domain-customer.yaml`.
Build + test + lint + lint:standards all green.

## 1. Business rules (entity) — DONE

- [x] Validation rules in `create()` (name 1–120, company ≤160, tier ∈ enum) — throw domain exceptions.
- [x] State-transition method `deactivate()` (ACTIVE → INACTIVE; throws if already INACTIVE).
- [x] `updateProfile({name?, company?, tier?})` — mutable fields only; email is immutable (no setter).
- [x] Exceptions: `CustomerAlreadyInactiveError`, `InvalidCustomerTierError`, `InvalidCustomerNameError`
      (replaced the generated hard-delete `CustomerAlreadyDeletedError`).

## 2. Repository methods — DONE

- [x] Interface: save, findById, findByUserId (GSI3), findByEmail (GSI4),
      listByStatus (GSI1), listByTier (GSI2).
- [x] Implemented in `dynamo-customer.repository.ts` (get vs find, mandatory index param,
      cursor pagination, createdAt → dateCreated mapping).
- [x] GSI1–GSI4 added to `CustomerSchema.ts`; tier converted to enum.
- [x] `scripts/setup-localstack.ts` updated with GSI2/3/4 attributes + indexes.
- [x] `.github/service-registry.json` → infrastructure.dynamodbTables GSIs updated.

## 3. Contracts (Zod schemas) — DONE

- [x] tier enum, create/update (no email on update), response, cursor list query schemas.
- [x] Re-exports CustomerStatusEnum + CustomerTierEnum; uses `@mma/contracts/common`.

## 4. Service wiring — DONE

- [x] Module: repo token + one useFactory provider per use case.
- [x] Application service: 7 methods, entity → DTO via `schema.parse()`, actorId logged on mutations.
- [x] Controller: full REST surface with Swagger decorators + `@CurrentUser()` actor.
- [x] `DomainExceptionFilter` DOMAIN_ERROR_MAP populated.
- [x] `main.ts`: correlationMiddleware first, initTelemetry present.

## 5. Use cases — DONE

- [x] createCustomer (email uniqueness), getCustomer, getCustomerByUserId (NEW),
      updateCustomer (name/company/tier only), deactivateCustomer (NEW),
      listCustomersByStatus, listCustomersByTier (NEW). Hard-delete path removed.

## 6. Tests — DONE

- [x] Entity tests (create defaults, tier validation, email immutability, updateProfile,
      deactivate twice throws).
- [x] Use case tests (happy + error paths, mocked repo).
- [x] Application service + controller tests (DTO mapping, cursor routing, actor passthrough).

## 7. Env / registry — DONE

- [x] CUSTOMER_SERVICE_PORT=3005, API_CUSTOMER_URL, NEXT_PUBLIC_API_CUSTOMER_URL added to
      `.env.local`, `.env.local.example`, `.github/service-registry.env`.
- [x] `eslint.config.mjs` depConstraints: added `scope:customer` entry.

## 8. Deferred (not in this task's scope)

- [ ] API E2E project (`customer-api-service-e2e`).
- [ ] Deployment verification via `cd-register-service`.
