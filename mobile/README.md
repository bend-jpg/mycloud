# MyTitanCloud Mobile (Capacitor)

Wrapper Capacitor qui transforme mytitancloud.com en application native
Android (.apk) et iOS (.ipa).

## Architecture

L'app native est un shell minimal qui charge `https://mytitancloud.com`
dans une WebView native (Android WebView ou iOS WKWebView), avec :

- Splash screen au démarrage
- Notifications push (via Capacitor Push Notifications quand configuré)
- Caméra / Photos / Files natifs accessibles depuis le site
- Apparait dans le tiroir d'apps Android / Springboard iOS comme une vraie app

## Android — Build du .apk

### Prérequis local

- Node.js 20+
- Java JDK 21
- Android SDK (via Android Studio ou cmdline tools)
- `ANDROID_HOME` configuré

### Initialisation (une seule fois)

```bash
cd mobile
npm install
npx cap add android
```

### Build du .apk

```bash
# Debug build (sideloadable, signé avec une clé debug auto)
npm run build:android:debug
# Sortie : android/app/build/outputs/apk/debug/app-debug.apk

# Release build (nécessite un keystore signé pour le Play Store)
npm run build:android
```

### Distribution sans Play Store

Le .apk debug est directement installable :
1. Transférer le .apk sur le téléphone
2. Autoriser "Sources inconnues" dans Paramètres > Sécurité
3. Tap sur le .apk pour installer

## iOS — Build du .ipa

**⚠️ Nécessite :**
- Mac physique (Apple ne permet pas le build iOS depuis Windows/Linux)
- Xcode 16+
- Compte Apple Developer (99€/an) pour signer + soumettre App Store
- iPhone physique pour test (le simulator n'accepte que .app, pas .ipa)

```bash
cd mobile
npx cap add ios
npm run open:ios   # ouvre Xcode pour build/signer
```

## GitHub Actions CI

Le workflow `.github/workflows/mobile-android-release.yml` builde le .apk
Android automatiquement à chaque tag `mobile-v*`. Le .apk debug est attaché
à la release GitHub pour téléchargement direct.

iOS n'est pas dans le CI tant qu'on n'a pas le compte Apple Dev + secrets
(certificat + provisioning profile + Apple ID app-specific password).
