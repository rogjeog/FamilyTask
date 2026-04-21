# Build context = monorepo root (set in docker-compose)

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

COPY pnpm-lock.yaml* ./

RUN pnpm install

# ─── Stage 2: dev ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV NODE_ENV=development
# Required for file-watching on Linux bind-mount volumes
ENV WATCHPACK_POLLING=true

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules 2>/dev/null || true

COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

WORKDIR /app/apps/web
EXPOSE 3001
CMD ["pnpm", "dev"]

# ─── Stage 3: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules 2>/dev/null || true

COPY . .

WORKDIR /app/apps/web
RUN pnpm build

# ─── Stage 4: prod ────────────────────────────────────────────────────────────
# Uses Next.js standalone output — minimal image, no dev deps
FROM node:20-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# standalone output includes everything needed to run the server
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3001
CMD ["node", "apps/web/server.js"]
