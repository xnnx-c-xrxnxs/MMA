# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace root files needed for install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/monitoring/monitoring-webapp/package.json ./apps/monitoring/monitoring-webapp/
COPY packages/monitoring-sdk/package.json ./packages/monitoring-sdk/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ─────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/monitoring-sdk/node_modules ./packages/monitoring-sdk/node_modules
COPY . .

# NEXT_PUBLIC_* vars must be available at build time
ARG NEXT_PUBLIC_MONITORING_API_URL
ENV NEXT_PUBLIC_MONITORING_API_URL=$NEXT_PUBLIC_MONITORING_API_URL

# Disable Nx Daemon — hangs in Docker due to limited resources
ENV NX_DAEMON=false

RUN pnpm nx build monitoring-webapp

# ─── Stage 3: Run ───────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# Lambda Web Adapter — proxies Lambda invocations to the HTTP server.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 /lambda-adapter /opt/extensions/lambda-adapter

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/monitoring/monitoring-webapp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/monitoring/monitoring-webapp/.next/static ./apps/monitoring/monitoring-webapp/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/monitoring/monitoring-webapp/server.js"]
