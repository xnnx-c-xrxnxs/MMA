/**
 * Coding Standards Configuration
 *
 * Toggle structural checks on/off per project.
 * Projects forked from this template can disable checks that don't apply.
 */
export interface CodingStandardsConfig {
  checks: {
    /** Entities must not have toObject() methods (A13) */
    'no-toObject-in-entities': boolean;
    /** Entities must not declare a createdAt field (A12) */
    'no-createdAt-in-entities': boolean;
    /** No NODE_ENV === 'development' checks anywhere (B8) — also enforced by ESLint plugin */
    'no-node-env-development': boolean;
    /** Exception filters must not include timestamp in error responses (C7) */
    'error-shape-no-timestamp': boolean;
    /** Every service in apps/ with an HTTP target must be in service-registry.json (E5) */
    'service-registry-sync': boolean;
    /** SQS/DynamoDB/database env vars in module code must be declared in both registry files */
    'service-registry-env-sync': boolean;
    /** Every process.env.X reference in a registered service must be (a) in its envVars[] in service-registry.json, (b) hydrated by SecretsConfig.resolve([...]) in main.ts, or (c) on the ambient Lambda/runtime allowlist. Also warns when a *_DATABASE_URL / *_API_KEY / *_SECRET / *_PASSWORD / *_PRIVATE_KEY is declared in envVars[] and read in code but missing from SecretsConfig.resolve(...). Catches the two most common deploy-time outages: missing env var in registry + forgotten SecretsConfig.resolve() call. */
    'service-config-completeness': boolean;
    /** Every leaf src/ subfolder with .ts files should have an index.ts barrel export (E10) */
    'barrel-export-completeness': boolean;
    /** Every domain with events must have a dedicated event-handler-service (new) */
    'event-handler-service-exists': boolean;
    /** Every service must have a DomainExceptionFilter (A9) */
    'domain-exception-filter-exists': boolean;
    /** Every application service must use createLogger() from @mma/telemetry (B35) */
    'app-service-has-logger': boolean;
    /** Controllers must extract userId/email/userRole via @CurrentUser() — never from body/query/path (B45 — Golden Rule #45) */
    'no-userId-in-controller-input': boolean;
    /** Routes in service-registry.json gatewayAuth.publicRoutes must match @Public() decorators in the corresponding service (Golden Rule §B1) */
    'gateway-public-routes-sync': boolean;
    /** Every prompt file in .claude/commands/ must have a row in CLAUDE.md §11.1 Workflow Entry Points decision tree */
    'prompt-entry-point-sync': boolean;
    /** Status enum values rendered in JSX must be wrapped in a format*Status() helper from @mma/client-common — never raw (Golden Rule #22a) */
    'no-raw-status-in-jsx': boolean;
    /** No SCSS / Sass / styled-components / Emotion files anywhere in the workspace — styling is Tailwind utilities + cva only (Golden Rule #23j / fe-design-tokens skill) */
    'no-scss-files': boolean;
    /** Every primitive in packages/ui/src/components/{category}/{name}/ must ship name.tsx + index.ts + name.stories.tsx + name.spec.tsx (Golden Rule #23n / webapp-ui-primitive skill) */
    'ui-primitive-has-story-and-spec': boolean;
    /** Tailwind v4 JIT only emits CSS for literal class names — template-literal interpolation like `bg-${prefix}-${step}` silently produces no styles. Use a cva() literal map, an @source inline safelist, or style={{ backgroundColor: token }} for fully-dynamic values. */
    'no-dynamic-tailwind-classes': boolean;
    /** Knowledge layer (.github/, docs/, READMEs, lint config) and universal packages must not reference example domains (user/product/order/payment) or examples/ paths except as explicit markdown links to examples/ (Decision D11). Enforced by scripts/audit-example-refs.mjs which is invoked here. */
    'skills-no-example-imports': boolean;
    /** Lambda-deployed API/worker services (listed in service-registry.json) must NOT ship a per-app package.json that uses the 'workspace:*' protocol. @nx/js:prune-lockfile preserves workspace:* strings into dist/package.json, which then breaks `npm install --omit=dev` at deploy time with EUNSUPPORTEDPROTOCOL. Recommended: delete the per-app package.json entirely and let prune-lockfile generate one from the workspace lockfile. */
    'no-workspace-protocol-in-lambda-package-json': boolean;
    /** Every controller route in apps/{domain}/{service}/src/presentation/controllers/*.controller.ts must have explicit Swagger metadata: @ApiTags on the class, @ApiOperation on every method, and matching @ApiBody/@ApiQuery/@ApiParam for every @Body()/@Query()/@Param() parameter. Without these decorators the OpenAPI document has empty operations and Swagger UI's "Try it out" panel renders only an Execute button (no body/query/path fields). This codebase uses Zod schemas (z.infer<>) so parameter types are erased at runtime — the metadata MUST be supplied explicitly. See the swagger-controller-docs skill. */
    'swagger-decorators-required': boolean;
    /** Every icon symbol exported from packages/ui/src/icons/icons.tsx during a /figma-import workflow must trace to apps/webapp/src/app/design-preview/figma-library-manifest.json#icons[].name OR templateAllowlist[]. Dormant unless the manifest exists AND iconsTraceabilityEnforced === true. Blocks agent-invented icons (e.g. ClockIcon added "because empty states often have clocks" when Figma has no clock anywhere). See ADR-006 and fe-icon-set skill § Provenance. */
    'figma-imported-icons-have-manifest-entry': boolean;
    /** Every cva variant key declared in packages/ui/src/components/{cat}/{name}/{name}.tsx must appear as an argTypes entry in the sibling {name}.stories.tsx so the Storybook Controls addon panel can flip it. Catches the failure mode where a primitive's variant is demoed via className ("variant-brand") instead of args:{ variant: 'brand' } — the Show Code panel surfaces className blobs and the addon panel does nothing. See ADR-006 and webapp-ui-primitive skill § Stories contract. */
    'cva-variants-have-storybook-argtypes': boolean;
    /** Every .claude/agents/*.md file must have YAML frontmatter with a `description:` field AND a body section heading `## Allowed Tools`. Enforces the subagent contract documented in ADR-007 so `Agent(subagent_type, prompt)` callers can rely on a discoverable description (surface for routing) and an explicit tool boundary (enforcement contract). */
    'agent-frontmatter-required': boolean;
    /** Every `Agent(subagent_type="X", ...)` reference inside .claude/commands/**/*.md must resolve to an existing .claude/agents/X.md file. Prevents drift between orchestrator commands and the subagent catalog (ADR-007). (Check key retains its legacy `runSubagent-reference-resolves` name from the pre-Claude-Code era.) */
    'runSubagent-reference-resolves': boolean;
    /** No tracked file may contain a pre-migration "AI config" signal: a "Copilot" tool-name reference, an old `.github/{prompts,skills,agents,instructions}/` path, an old `.prompt.md`/`.agent.md`/`.instructions.md`/`.chatmode.md` file convention, an `applyTo:`/`runSubagent(` directive, or a parallel AI-tool config dir (`.cursor/`, `.opencode/`, `.windsurf/`). Claude Code (`.claude/`, `CLAUDE.md`) is the single source of truth. Shells out to scripts/audit-ai-config.mjs (allowlist for ADR-007/008, `.mcp.json`, `examples/`, and the scanner files; the spec dir was renamed `.copilot/` → `.specs/` and the old name is now forbidden). Keeps the Copilot→Claude migration at 100% and blocks regressions. See docs/decisions/008. */
    'no-legacy-ai-config-references': boolean;
  };

  /** Glob patterns to exclude from checks */
  exclude?: string[];
}

const config: CodingStandardsConfig = {
  checks: {
    'no-toObject-in-entities': true,
    'no-createdAt-in-entities': true,
    'no-node-env-development': true,
    'error-shape-no-timestamp': true,
    'service-registry-sync': true,
    'service-registry-env-sync': true,
    'service-config-completeness': true,
    'barrel-export-completeness': true,
    'event-handler-service-exists': true,
    'domain-exception-filter-exists': true,
    'app-service-has-logger': true,
    'no-userId-in-controller-input': true,
    'gateway-public-routes-sync': true,
    'prompt-entry-point-sync': true,
    'no-raw-status-in-jsx': true,
    'no-scss-files': true,
    'ui-primitive-has-story-and-spec': true,
    'no-dynamic-tailwind-classes': true,
    'skills-no-example-imports': true,
    'no-workspace-protocol-in-lambda-package-json': true,
    'swagger-decorators-required': true,
    'figma-imported-icons-have-manifest-entry': true,
    'cva-variants-have-storybook-argtypes': true,
    'agent-frontmatter-required': true,
    'runSubagent-reference-resolves': true,
    'no-legacy-ai-config-references': true,
  },
  exclude: ['**/node_modules/**', '**/dist/**', '**/generated/**'],
};

export default config;
