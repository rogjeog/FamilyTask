# FamilyTask — Contexte projet pour Claude

Ce fichier est la source de vérité pour les sessions Claude sur ce projet.
Lis-le entièrement avant toute intervention.

---

## Description

Application web familiale : les parents assignent des tâches aux enfants,
les enfants les acceptent/complètent, les parents valident, des points sont
crédités, les points permettent de réclamer des récompenses.

**Dépôt :** monorepo pnpm workspaces sur VPS Debian 12 avec Docker.
**Dev :** directement sur le VPS via SSH + tunnel pour accéder au navigateur.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | NestJS 10 + TypeScript + Prisma 5 + PostgreSQL 16 + Redis 7 + BullMQ |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS 3 + shadcn/ui |
| Conteneurs | Docker + docker-compose (dev local sur VPS) |
| Monorepo | pnpm workspaces (pnpm 9.15.0, node 20) |
| Auth | JWT access token (15m) + refresh token en cookie httpOnly secure sameSite=strict |
| Contrat API | OpenAPI 3.1 — `packages/shared/openapi.yaml` est la source de vérité |

---

## Structure du monorepo

```
familytask/
├── apps/
│   ├── backend/              NestJS — port 3000
│   │   ├── prisma/schema.prisma
│   │   ├── src/
│   │   │   ├── config/       env.schema.ts (Zod) + config.module.ts
│   │   │   ├── common/prisma/ prisma.service.ts + prisma.module.ts (@Global)
│   │   │   ├── modules/health/ GET /api/v1/health
│   │   │   ├── app.module.ts
│   │   │   └── main.ts       prefix api/v1, ValidationPipe, CORS, cookieParser
│   │   ├── Dockerfile         multi-stage: deps/dev/build/prod
│   │   └── .env.example
│   └── web/                  Next.js — port 3001
│       ├── app/
│       │   ├── (auth)/login/page.tsx
│       │   ├── layout.tsx
│       │   ├── page.tsx      redirect → /login
│       │   └── globals.css   variables CSS HSL (palette FamilyTask)
│       ├── components/ui/    shadcn/ui (button, input, label, card, form, sonner)
│       ├── lib/
│       │   ├── utils.ts      cn()
│       │   └── config.ts     API_BASE_URL depuis NEXT_PUBLIC_API_BASE_URL
│       ├── tailwind.config.ts
│       ├── Dockerfile        multi-stage: deps/dev/build/prod
│       └── .env.example
├── packages/shared/
│   ├── openapi.yaml          contrat API OpenAPI 3.1
│   └── types/index.ts        types TS (à générer depuis openapi.yaml)
├── docker-compose.yml        dev local VPS
├── .env.example              variables pour tous les services
├── CLAUDE.md                 ce fichier
└── README.md
```

---

## Démarrage dev

```bash
cp .env.example .env
docker compose up -d postgres redis   # attendre healthy
docker compose up api web              # foreground pour les logs
```

Tunnel SSH depuis la machine locale :
```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 debian@servmoisst.btsinfo.nc
```

- Frontend : http://localhost:3001
- API health : http://localhost:3000/api/v1/health

---

## Domaine / URLs

- **Production** : `https://servmoisst.btsinfo.nc`
- **Jamais de valeur en dur** : toujours `process.env.NEXT_PUBLIC_API_BASE_URL` (frontend) ou les env vars NestJS (backend)
- `lib/config.ts` expose `API_BASE_URL` avec fallback `http://localhost:3000/api/v1`

---

## Palette de couleurs (strict — aucune couleur en dur dans le code)

Tous les tokens sont dans `apps/web/app/globals.css` (variables CSS HSL)
et `apps/web/tailwind.config.ts` (tokens Tailwind).

| Token | Hex | HSL |
|---|---|---|
| `primary` | #D97757 | 15 63% 60% |
| `primary-dark` | #C6603E | 15 54% 51% |
| `primary-light` | #F4E2D8 | 21 56% 90% |
| `accent` | #BF4A28 | 14 65% 45% |
| `background` | #FFFFFF | 0 0% 100% |
| `surface` | #FAF9F5 | 47 33% 97% |
| `border` / `border-subtle` | #EDE9DF | 43 28% 90% |
| `text-primary` | #1F1E1D | 30 3% 12% |
| `text-secondary` | #6B6A68 | 30 2% 41% |
| `success` | #2E7D5B | 154 46% 34% |
| `warning` | #C98A2D | 36 64% 48% |

---

## Règles métier critiques (ne jamais transgresser)

1. **Transitions de Task.status côté serveur uniquement.** Le client ne mute jamais le status directement.

2. **Isolation famille stricte.** Un utilisateur ne peut pas voir/modifier une tâche d'une autre famille. Middleware NestJS qui vérifie `familyId` sur chaque route protégée.

3. **Points via ledger uniquement.** Jamais de champ `points` mutable sur `User`. Solde = `SUM(delta)` sur `PointsLedger`. Chaque changement crée une entrée.

4. **Un assigné ne valide pas sa propre tâche.** Seul le `requesterId` peut valider (ou contester).

5. **Récompenses : droits PARENT uniquement.** Les enfants ne peuvent pas créer/modifier/supprimer des récompenses.

---

## Entités principales (Prisma — `apps/backend/prisma/schema.prisma`)

Tables Postgres en snake_case via `@@map`. Champs Prisma en camelCase.

| Modèle | Clé | Notes |
|---|---|---|
| `User` | cuid | email unique, passwordHash |
| `Family` | cuid | inviteCode unique |
| `FamilyMember` | [userId, familyId] | role: PARENT/CHILD/OTHER |
| `Task` | cuid | familyId, requesterId, assigneeId, status, recurrenceRule (RRULE) |
| `TaskReminderConfig` | cuid | offsetsMinutes: Int[] (unique par userId+taskId) |
| `TaskEvent` | cuid | journal append-only des transitions |
| `Reward` | cuid | familyId, costPoints, createdById |
| `RewardRedemption` | cuid | status: PENDING/APPROVED/REJECTED |
| `PointsLedger` | cuid | delta (peut être négatif), reason, relatedTaskId |
| `Device` | cuid | pushToken unique par (userId, pushToken) |
| `RefreshToken` | cuid | tokenHash unique, expiresAt, revokedAt |

---

## State machine des tâches

```
PENDING ──► ACCEPTED ──► COMPLETED ──► REWARDED   (chemin heureux)
PENDING ──► REJECTED                              (refus assigné)
COMPLETED ──► ACCEPTED                            (contestation requester)
```

---

## Endpoints MVP (préfixe `/api/v1`)

Auth JWT requis sauf `/auth/*` et `/health`.

```
POST   /auth/register | /auth/login | /auth/refresh | /auth/logout
GET    /auth/me
PATCH  /users/me
POST   /families          POST /families/join        GET /families/me
POST   /families/:id/invite
GET|POST  /tasks          GET|PATCH|DELETE /tasks/:id
POST   /tasks/:id/{accept|reject|complete|validate|dispute}
PUT    /tasks/:id/reminders
GET|POST  /rewards        PATCH|DELETE /rewards/:id
POST   /rewards/:id/redeem
POST   /redemptions/:id/{approve|reject}
GET    /points/me         GET /points/ledger
GET    /health
```

---

## Conventions

- **Langue du code** : anglais (variables, fonctions, commits, commentaires)
- **Langue de l'UI** : français
- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`)
- **Package manager** : pnpm exclusivement (jamais npm ni yarn)
- **Tests** : Jest pour la logique métier backend. Obligatoires sur les services et state machines.
- **DB** : toutes les opérations passent par Prisma. Migrations versionnées.
- **Commentaires** : uniquement si le WHY est non-évident. Jamais de commentaires qui décrivent le WHAT.

---

## Module Auth (`apps/backend/src/modules/auth/`)

### Architecture

- **Guard global** : `JwtAuthGuard` enregistré comme `APP_GUARD` dans `app.module.ts`. Toutes les routes sont protégées par défaut.
- **Routes publiques** : décorer avec `@Public()` (depuis `auth/decorators/public.decorator.ts`). Obligatoire sur `/health`, `/auth/register`, `/auth/login`, `/auth/refresh`.
- **Utilisateur courant** : `@CurrentUser()` injecte `{ userId, email }` (type `JwtUser`) dans les controllers.

### JWT

- **Access token** : JWT signé HS256, TTL `JWT_ACCESS_TTL` (défaut 15m), transmis dans `Authorization: Bearer`.
- **Refresh token** : 32 octets aléatoires (`crypto.randomBytes(32).toString('base64url')`), 256 bits d'entropie. Seul le **SHA-256 du token** est stocké en base (`RefreshToken.tokenHash`). Le token en clair n'est jamais persisté.
- **Cookie** : `refresh_token`, httpOnly, secure (prod uniquement), sameSite=strict, path=/api/v1/auth.

### Rotation et reuse detection

`AuthService.refresh(plainToken)` :
1. Calcule `sha256(plainToken)`, cherche en base **sans** filtrer sur `revokedAt`.
2. Si non trouvé → `INVALID_REFRESH_TOKEN`.
3. Si trouvé mais `revokedAt != null` → **token family revocation** : `updateMany` tous les tokens de l'utilisateur (`revokedAt = now`), log `console.warn('REUSE DETECTED')`, throw `REFRESH_TOKEN_REUSED`.
4. Si expiré (`expiresAt < now`) → `REFRESH_TOKEN_EXPIRED`.
5. Sinon : révoque l'ancien (`update revokedAt`), crée un nouveau token, retourne nouveaux access + refresh tokens.

### Helpers

| Fichier | Fonctions |
|---|---|
| `utils/password.util.ts` | `hashPassword(plain)` — bcrypt cost 12 ; `verifyPassword(plain, hash)` |
| `utils/tokens.util.ts` | `generateRefreshToken()` — 32 bytes base64url ; `hashToken(token)` — SHA-256 hex ; `parseTtl(ttl)` — convertit `15m`/`2h`/`30d` en ms |

### getMe (MVP)

Retourne l'utilisateur + première famille (`take: 1, orderBy: joinedAt asc`). Le schéma supporte plusieurs familles mais le MVP n'en expose qu'une.

### Tests unitaires

`auth.service.spec.ts` — 9 cas. Mocks : `hashPassword`/`verifyPassword` (module mock), `generateRefreshToken` (mock partiel, `hashToken`/`parseTtl` réels). `MOCK_TOKEN_HASH` calculé avec le vrai `crypto.createHash('sha256')`.

---

## Docker — notes importantes

- Tous les ports exposés bindés sur `127.0.0.1` (jamais `0.0.0.0` côté host).
- `CHOKIDAR_USEPOLLING=true` dans le container backend (hot reload sur volumes bind-mount Linux).
- `WATCHPACK_POLLING=true` dans le container web (même raison).
- `DATABASE_URL` utilise `postgres` comme hostname (nom du service Docker), pas `localhost`.
- `NEXT_PUBLIC_API_BASE_URL` utilise `localhost` (navigateur passe par le tunnel SSH).
- **Volumes anonymes** pour `node_modules` (pas de nom avant `:`) : Docker initialise les volumes anonymes depuis l'image au premier démarrage, ce qui préserve les symlinks pnpm. Les volumes nommés seraient initialisés vides et écraseraiert les deps.
- Healthchecks sur postgres (`pg_isready`) et redis (`redis-cli ping`). L'api `depends_on` les deux avec `condition: service_healthy`.
