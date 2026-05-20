# MyCloud

SaaS de stockage cloud personnel et familial. Combine pCloud (drive synchronisé),
WeTransfer (liens de partage), NAS familial, et — à terme — hébergement de sites
et instances Claude Code.

## État du projet

- **Phase 0 ✅** Scaffold, i18n, design system, schéma DB, abstraction storage
- **Phase 1 🚧** Upload/download fichiers + dossiers (code prêt, test pendant)
- **Phase 2 →** Liens de partage, espaces famille, paiements, admin, PWA, etc.

## Démarrer en local

### 1. Configurer la base de données (obligatoire)

L'option la plus simple : **Neon** (Postgres serverless, plan gratuit).

1. Va sur https://neon.tech, crée un compte (Google/GitHub).
2. Crée un projet "mycloud".
3. Copie la **connection string** — elle ressemble à :
   `postgresql://user:pass@ep-xxxx.eu-west-1.aws.neon.tech/mycloud?sslmode=require`

Crée un fichier `.env.local` à la racine (copie `.env.example`) et colle :

```bash
DATABASE_URL="postgresql://...l'URL Neon..."
AUTH_SECRET="..."  # génère avec : openssl rand -base64 32
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Créer les tables

```bash
npx prisma db push
```

### 3. Lancer

```bash
npm run dev
```

Ouvre http://localhost:3000.

Au premier accès au dashboard, un user demo (`demo@mycloud.local`) et les plans
par défaut sont créés automatiquement. Tu peux tester l'upload — les fichiers
sont stockés dans `./.storage/` localement.

### 4. (Optionnel) Brancher Cloudflare R2 pour la prod

Voir `.env.example` pour les variables R2. En prod, un backend R2 doit remplacer
le backend LOCAL (qui ne marche pas sur Vercel — filesystem en lecture seule).

## Stack technique

| Couche | Choix |
|---|---|
| Frontend + API | Next.js 16 (App Router, Turbopack) |
| UI | Tailwind v4, design "Box TV" |
| DB | Postgres via Prisma 6 |
| Auth | NextAuth v5 (en cours) |
| Stockage | Cloudflare R2 (prod) / Filesystem (dev) — multi-provider |
| Paiements | Stripe + Coinbase Commerce (à venir) |
| i18n | next-intl (FR / EN / ES / HE+RTL) |

## Roadmap

- [x] Phase 0 — Setup (DB, i18n, design, storage abstraction, landing)
- [ ] Phase 1 — Files & folders (upload, download, navigation, corbeille)
- [ ] Phase 2 — Liens de partage WeTransfer-style
- [ ] Phase 3 — Espaces famille avec permissions
- [ ] Phase 4 — Dashboard admin (clients, tickets, WhatsApp)
- [ ] Phase 5 — Paiements (Stripe + crypto + espèces manuel)
- [ ] Phase 6 — PWA mobile + upload auto photos
- [ ] Phase 7 — App desktop (drive monté)
- [ ] Phase 8 — Multi-storage admin UI
- [ ] Phase 9 — Hébergement sites + Claude Code (infra séparée)
