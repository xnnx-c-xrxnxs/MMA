# ADR-003: Lambda Web Adapter Over Dual-Mode Handler

**Status:** ACCEPTED  
**Date:** 2026-05

## Context

NestJS HTTP services need to run both locally (plain Node.js HTTP server) and on AWS Lambda. Two mainstream approaches exist: export a Lambda handler from `main.ts` alongside the HTTP server (dual-mode), or use the AWS Lambda Web Adapter layer which proxies Lambda invocation events to a running HTTP server.

## Decision

All backend API services use the **AWS Lambda Web Adapter** (public Lambda layer). The Lambda handler is `run.sh` — a shell script that runs `exec node main.js`. The NestJS app starts as a plain HTTP server on `PORT` (default 8080). Lambda Web Adapter intercepts the Lambda invocation event and proxies it to the HTTP server transparently.

## Rationale

- `main.ts` is identical locally and on Lambda — no branching, no conditional exports, no extra dependencies
- The HTTP server is fully testable locally with `curl` / Postman without any Lambda simulation tooling
- Cold start overhead is ~2ms — negligible compared to NestJS bootstrap time
- `AWS_LWA_REMOVE_BASE_PATH=/{domain}` env var strips the API Gateway path prefix before forwarding to NestJS, keeping NestJS unaware of the gateway routing

## Alternatives Rejected

- **`@codegenie/serverless-express`:** Requires a dual-mode `main.ts`, adds a dependency, and the local dev experience diverges from deployed behaviour. Breaking changes in the adapter have historically caused outages.
- **Dual-mode main.ts (detect Lambda via `AWS_LAMBDA_FUNCTION_NAME` env):** Works but couples every `main.ts` to Lambda-specific logic. A missed condition in a new service causes a silent failure on Lambda.

## Constraints

- Every service `webpack.config.js` must include `libraryTarget: 'commonjs2'` in the `output` block — without this, Lambda cannot resolve the module exports
- `run.sh` must be created in the `dist/` directory by the CD workflow before zipping the Lambda package
- `PORT` defaults to 8080 inside Lambda; local dev uses `{DOMAIN}_SERVICE_PORT` from `.env.local`
- The Lambda Web Adapter layer ARN must be referenced in the `lambda-api` and `lambda-worker` Terraform modules
