# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace root files needed for install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/webapp/package.json ./apps/webapp/
COPY packages/ui/package.json ./packages/ui/
COPY packages/client-common/package.json ./packages/client-common/
COPY packages/common/package.json ./packages/common/
COPY packages/contracts/common/package.json ./packages/contracts/common/
COPY packages/contracts/user/package.json ./packages/contracts/user/
COPY packages/contracts/order/package.json ./packages/contracts/order/
COPY packages/contracts/product/package.json ./packages/contracts/product/
COPY packages/user-domain/package.json ./packages/user-domain/
COPY packages/order-domain/package.json ./packages/order-domain/
COPY packages/product-domain/package.json ./packages/product-domain/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ─────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars must be available at build time
ARG NEXT_PUBLIC_API_USER_URL
ARG NEXT_PUBLIC_API_PRODUCT_URL
ARG NEXT_PUBLIC_API_ORDER_URL
ARG NEXT_PUBLIC_API_AUTH_URL
ARG NEXT_PUBLIC_API_FILE_URL

ENV NEXT_PUBLIC_API_USER_URL=$NEXT_PUBLIC_API_USER_URL
ENV NEXT_PUBLIC_API_PRODUCT_URL=$NEXT_PUBLIC_API_PRODUCT_URL
ENV NEXT_PUBLIC_API_ORDER_URL=$NEXT_PUBLIC_API_ORDER_URL
ENV NEXT_PUBLIC_API_AUTH_URL=$NEXT_PUBLIC_API_AUTH_URL
ENV NEXT_PUBLIC_API_FILE_URL=$NEXT_PUBLIC_API_FILE_URL

# Disable Nx Daemon — hangs in Docker due to limited resources
ENV NX_DAEMON=false

RUN pnpm nx build webapp

# ─── Stage 3: Run ───────────────────────────────────────────────────────────
# This image serves both ECS (staging/prod) and Lambda (dev/preview).
# Lambda Web Adapter is always present but only activates when
# AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap is set (injected by Terraform).
FROM node:24-alpine AS runner
WORKDIR /app

# Lambda Web Adapter — proxies Lambda invocations to the HTTP server.
# No-op on ECS (AWS_LAMBDA_EXEC_WRAPPER is not set).
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 /lambda-adapter /opt/extensions/lambda-adapter

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/webapp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/webapp/.next/static ./apps/webapp/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/webapp/public ./apps/webapp/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/webapp/server.js"]
