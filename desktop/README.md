# MyTitanCloud Desktop

Logiciel desktop officiel — wrapper Electron qui charge mytitancloud.com
dans une vraie fenêtre native (.exe / .dmg / .AppImage).

## Build local (pour développement)

Nécessite Node.js 18+ et npm.

```bash
cd desktop
npm install
npm start          # lance l'app pointant sur mytitancloud.com
npm run dev        # idem + DevTools ouvert
```

## Build des installeurs

```bash
npm run build:win    # produit dist/MyTitanCloud-Setup-X.Y.Z.exe
npm run build:mac    # produit dist/MyTitanCloud-X.Y.Z.dmg (sur macOS uniquement)
npm run build:linux  # produit dist/MyTitanCloud-X.Y.Z.AppImage
```

## Build via GitHub Actions

Le workflow `.github/workflows/desktop-release.yml` compile les 3 plateformes
en parallèle quand on push un tag `desktop-v*`. Exemple :

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

Les installeurs sont uploadés comme assets sur la release GitHub correspondante.

## Icônes

Placer dans `build/` :

- `icon.png` — 512×512 (Linux + fallback)
- `icon.ico` — multi-tailles Windows (16, 32, 48, 64, 128, 256)
- `icon.icns` — multi-tailles macOS (générer via `iconutil` ou `png2icns`)
- `tray-icon.png` — 16×16 ou 32×32 pour la barre des tâches (optionnel)

## Variable d'environnement

- `MYCLOUD_URL` : URL à charger (default `https://mytitancloud.com`).
  Utile pour tester contre staging : `MYCLOUD_URL=http://localhost:3000 npm start`.

## Pourquoi pas Tauri ?

Tauri (3 MB binaires vs 100+ MB Electron) est plus efficace mais nécessite
Rust toolchain et le webview natif de l'OS (qui diffère entre Windows /
macOS / Linux). Electron est plus prévisible, mieux documenté, et l'écart
de taille n'est pas critique pour notre usage.
