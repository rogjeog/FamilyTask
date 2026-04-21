# Build context = monorepo root (set in docker-compose)

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy manifests only — layer is cached until a package.json changes
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# pnpm-lock.yaml may not exist yet on first run
COPY pnpm-lock.yaml* ./

RUN pnpm install

# ─── Stage 2: dev ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV NODE_ENV=development
# Required for file-watching on Linux bind-mount volumes
ENV CHOKIDAR_USEPOLLING=true

# Copy the installed workspace (node_modules + pnpm virtual store)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules 2>/dev/null || true

# Copy full source (overridden by volume mount in docker-compose dev)
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["pnpm", "dev"]

# ─── Stage 3: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules 2>/dev/null || true

COPY . .

WORKDIR /app/apps/backend
RUN pnpm exec prisma generate && pnpm build

# ─── Stage 4: prod ────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV NODE_ENV=production

# Reinstall prod-only deps from lockfile for a clean minimal image
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
