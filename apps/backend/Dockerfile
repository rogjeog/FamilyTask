# Build context = monorepo root (set in docker-compose)

# ─── Stage 1: dev ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app

# Prisma binary engines require OpenSSL on Alpine
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install

COPY . .

# Generate Prisma client so the image starts without a manual prisma generate
RUN cd apps/backend && pnpm exec prisma generate

WORKDIR /app/apps/backend
EXPOSE 3000
ENV CHOKIDAR_USEPOLLING=true
CMD ["pnpm", "start:dev"]

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install

COPY . .

WORKDIR /app/apps/backend
RUN pnpm exec prisma generate && pnpm build

# ─── Stage 3: prod ────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# node_modules include the generated Prisma client from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
