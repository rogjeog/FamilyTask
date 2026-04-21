# Build context = monorepo root (set in docker-compose)

# ─── Stage 1: dev ─────────────────────────────────────────────────────────────
# Self-contained: installs deps, copies source.
# Source is overridden by bind-mount volumes in docker-compose; node_modules
# and .next cache are preserved by anonymous volumes declared in docker-compose.
FROM node:20-alpine AS dev
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install

COPY . .

WORKDIR /app/apps/web
EXPOSE 3001
CMD ["pnpm", "dev"]

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install

COPY . .

WORKDIR /app/apps/web
RUN pnpm build

# ─── Stage 3: prod ────────────────────────────────────────────────────────────
# Uses Next.js standalone output — no node_modules needed in final image.
FROM node:20-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3001
CMD ["node", "apps/web/server.js"]
