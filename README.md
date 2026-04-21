# FamilyTask

Application web de gestion de tâches familiales avec système de points et récompenses.

## Stack

| Couche | Technologie |
|---|---|
| Backend | NestJS + TypeScript + Prisma + PostgreSQL + Redis + BullMQ |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Conteneurs | Docker + docker-compose |
| Monorepo | pnpm workspaces |
| Contrat API | OpenAPI 3.1 (`packages/shared/openapi.yaml`) |

## Structure du monorepo

```
familytask/
├── apps/
│   ├── backend/        NestJS API
│   └── web/            Next.js frontend
├── packages/
│   └── shared/         Types TS + openapi.yaml (source de vérité API)
├── docker-compose.yml
└── .env.example
```

## Démarrer en local (VPS Debian 12)

### 1. Pré-requis

- Docker + Docker Compose v2 installés sur le VPS
- Accès SSH au VPS (`debian@servmoist.btsinfo.nc`)

### 2. Cloner et configurer

```bash
git clone <repo-url> ~/dev/familytask
cd ~/dev/familytask
cp .env.example .env
# Éditer .env si besoin (les valeurs par défaut fonctionnent pour le dev local)
```

### 3. Démarrer l'infrastructure (postgres + redis)

```bash
docker compose up -d postgres redis
```

Attendre que les healthchecks passent (quelques secondes) :

```bash
docker compose ps   # STATUS doit afficher "healthy" pour postgres et redis
```

### 4. Démarrer les applications

```bash
# En foreground pour voir les logs (Ctrl+C pour arrêter)
docker compose up api web

# Ou en arrière-plan
docker compose up -d api web
docker compose logs -f api web
```

### 5. Vérifier que tout tourne

```bash
# Depuis le VPS
curl http://localhost:3000/api/v1/health
# → { "status": "ok", "timestamp": "...", "uptime": ..., "version": "0.1.0" }
```

### 6. Accéder depuis le navigateur (tunnel SSH)

Depuis ta machine locale, ouvrir un tunnel SSH :

```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 debian@servmoist.btsinfo.nc
```

Puis ouvrir dans le navigateur :

- **Frontend** : http://localhost:3001
- **API health** : http://localhost:3000/api/v1/health

### 7. Tout arrêter

```bash
docker compose down          # Arrête et supprime les conteneurs (volumes conservés)
docker compose down -v       # Supprime aussi les volumes (⚠ perte des données DB)
```

## Commandes utiles

```bash
# Rebuild d'une image après changement de package.json
docker compose build api
docker compose build web

# Ouvrir un shell dans un conteneur
docker compose exec api sh
docker compose exec postgres psql -U familytask -d familytask

# Voir les logs d'un service
docker compose logs -f api

# Lancer les migrations Prisma (une fois la DB démarrée)
docker compose exec api pnpm exec prisma migrate dev
```

## Variables d'environnement

Voir `.env.example` à la racine. Ne jamais commiter le fichier `.env`.

> **Note :** `DATABASE_URL` et `REDIS_URL` utilisent les noms de services Docker (`postgres`, `redis`) comme hostnames. `NEXT_PUBLIC_API_BASE_URL` utilise `localhost` car c'est le navigateur (via tunnel SSH) qui fait les appels.
