# MyTitanCloud — Guide admin

Tout ce que tu (Ben) dois faire pour que l'app soit pleinement opérationnelle
en prod. Ce fichier est ton checklist personnel.

---

## 🔴 Bloquants critiques (à faire pour que l'app tourne en prod)

### 1. Pousser le schema Prisma vers Neon (5 minutes)

Trois tables ajoutées récemment ne sont pas encore en prod : `Favorite`,
`FileVersion`, `FileRequest`, `AppRelease`. Sans ça, les pages
correspondantes affichent vide (j'ai mis du `try/catch` defensive partout
pour éviter les crash, mais les features sont désactivées).

```bash
cd mycloud
npx prisma db push
```

Te demandera de confirmer. Tape `y` puis Entrée. C'est sans risque (le push
ajoute juste les nouvelles tables, ne touche pas aux données existantes).

### 2. Repo GitHub public OU R2 bucket pour héberger les installeurs

**Option A — Repo public (recommandé, 30 secondes)** :
- github.com/bend-jpg/mycloud/settings → Danger Zone → Change visibility → Public
- Les tags `desktop-v*` et `mobile-v*` créeront automatiquement des releases avec
  les .exe/.dmg/.apk publics

**Option B — R2 / Vercel Blob (privé, plus complexe)** :
- Crée un bucket R2 Cloudflare `mycloud-installers` avec accès public
- Upload manuellement les installeurs
- Va sur `/admin/app-releases` (sur ton site déployé) et colle les URLs
- Les boutons « Télécharger » du site pointeront direct dessus

---

## 🟡 Env vars Vercel (à configurer dans Settings → Environment Variables)

### Storage (Cloudflare R2)
```
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=mycloud-prod
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://files.mytitancloud.com  (CDN devant le bucket, optionnel)
```

### Emails (Resend)
```
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@mytitancloud.com
```

### Paiements (Stripe + Coinbase)
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
COINBASE_COMMERCE_API_KEY=xxx
COINBASE_COMMERCE_WEBHOOK_SECRET=xxx
```

### Google OAuth (optionnel — pour "Continue with Google")
```
AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=xxx
```

### WhatsApp Business (optionnel — pour support)
```
WHATSAPP_BUSINESS_NUMBER=+972504716440
```

### Téléchargement des apps natives (alternative à /admin/app-releases)
```
DOWNLOAD_URL_WIN=https://mycloud-installers.r2.dev/MyTitanCloud-Setup-0.1.1.exe
DOWNLOAD_URL_MAC=https://mycloud-installers.r2.dev/MyTitanCloud-0.1.1.dmg
DOWNLOAD_URL_LINUX=https://mycloud-installers.r2.dev/MyTitanCloud-0.1.1.AppImage
DOWNLOAD_URL_ANDROID=https://mycloud-installers.r2.dev/MyTitanCloud-0.1.1.apk
```

---

## 🟢 Optionnel mais recommandé

### Apps natives stores
- **Apple Developer Program** : 99 USD/an → permet iOS App Store + signature macOS .dmg
- **Google Play Console** : 25 USD une fois → permet Play Store Android
- **Windows Code Signing Cert** : ~200 USD/an (Sectigo, SSL.com) → évite warning SmartScreen

### Icônes brandées
Envoie-moi 1 PNG 1024×1024 de ton logo MyTitanCloud — je génère :
- `desktop/build/icon.ico` (Windows)
- `desktop/build/icon.icns` (macOS, via iconutil)
- `desktop/build/icon.png` (Linux + Android)
- Tray icon 32×32

---

## 📦 Publier une nouvelle version de l'app desktop

```bash
git tag desktop-v0.1.2
git push origin desktop-v0.1.2
```

→ GitHub Actions builde automatiquement Windows / macOS / Linux et attache
les installeurs à la release. Si repo public, accessible immédiatement.

Idem pour mobile :
```bash
git tag mobile-v0.1.2
git push origin mobile-v0.1.2
```

→ Builde l'.apk Android. iOS attend le compte Apple Dev.

---

## 🛠 Architecture rapide

- **Frontend + API** : Next.js 16 sur Vercel (mytitancloud.com)
- **Database** : Postgres Neon
- **Storage** : Cloudflare R2 (objets fichiers)
- **CDN** : Vercel Edge + R2 public URL
- **Email** : Resend
- **Auth** : NextAuth v5 (credentials + Google + Passkey)
- **Payments** : Stripe (cartes) + Coinbase Commerce (crypto) + saisie cash admin
- **Desktop app** : Electron 33 dans `desktop/`
- **Mobile app** : Capacitor 7 dans `mobile/`
- **CI** : GitHub Actions (`.github/workflows/*`)

---

## 🐛 Debug rapide

- **404 sur télécharger** : env vars `DOWNLOAD_URL_*` pas configurées OU
  /admin/app-releases pas rempli — voir section bloquants #2
- **« Favoris pas dispo »** : prisma db push pas fait — voir bloquants #1
- **App ne s'installe pas** : Service Worker doit être déployé (vérifier /sw.js
  accessible). Recharge 2× la page avant que Chrome considère le PWA installable.
- **Erreur critique générique** : check les logs Vercel + le browser console pour
  l'erreur React précise. La page /global-error catch tout.

---

## 📖 Pages utiles côté admin

- `/admin` — vue d'ensemble
- `/admin/clients` — gestion users
- `/admin/storage` — backends de stockage multi-provider
- `/admin/plans` — plans tarifaires
- `/admin/coupons` — codes promo Stripe
- `/admin/payments` — historique paiements
- `/admin/tickets` — support
- `/admin/app-releases` — **URLs des installeurs natifs** (où tu colles tes liens R2)
- `/admin/cms` — édition des textes de la landing
- `/admin/audit` — journal d'audit des actions admin
- `/admin/staff` — gestion équipe interne (RBAC)
