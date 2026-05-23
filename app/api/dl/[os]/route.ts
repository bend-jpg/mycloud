// /api/dl/[os] — redirige vers le bon installeur selon l'OS.
//
// Lit les env vars DOWNLOAD_URL_* configurées dans Vercel :
//   - DOWNLOAD_URL_WIN    → .exe Windows
//   - DOWNLOAD_URL_MAC    → .dmg macOS
//   - DOWNLOAD_URL_LINUX  → .AppImage Linux
//   - DOWNLOAD_URL_ANDROID → .apk Android
//
// Si l'env var n'est pas configurée (CI build pas fini, repo privé sans
// release publique, etc.), redirige vers /download?soon=1 qui affiche
// un message clair au lieu d'un 404 brut.

import { NextResponse } from "next/server";

const ENV_MAP: Record<string, string> = {
  win: "DOWNLOAD_URL_WIN",
  windows: "DOWNLOAD_URL_WIN",
  exe: "DOWNLOAD_URL_WIN",
  mac: "DOWNLOAD_URL_MAC",
  macos: "DOWNLOAD_URL_MAC",
  dmg: "DOWNLOAD_URL_MAC",
  linux: "DOWNLOAD_URL_LINUX",
  appimage: "DOWNLOAD_URL_LINUX",
  android: "DOWNLOAD_URL_ANDROID",
  apk: "DOWNLOAD_URL_ANDROID",
};

export async function GET(req: Request, ctx: { params: Promise<{ os: string }> }) {
  const { os } = await ctx.params;
  const envKey = ENV_MAP[os.toLowerCase()];
  const target = envKey ? process.env[envKey] : null;

  const url = new URL(req.url);

  if (target) {
    // Redirige vers l'URL du release (R2, GitHub release, etc.)
    return NextResponse.redirect(target, 302);
  }

  // Pas d'URL configurée → redirige vers /download avec un flag pour afficher
  // un message clair (au lieu de 404 GitHub)
  url.pathname = `/${getLocaleFromReferer(req) ?? "fr"}/download`;
  url.search = `?soon=1&os=${os}`;
  return NextResponse.redirect(url, 302);
}

function getLocaleFromReferer(req: Request): string | null {
  const referer = req.headers.get("referer");
  if (!referer) return null;
  try {
    const path = new URL(referer).pathname;
    const match = path.match(/^\/([a-z]{2})(?:\/|$)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
