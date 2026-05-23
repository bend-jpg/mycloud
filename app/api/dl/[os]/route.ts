// /api/dl/[os] — redirige vers le bon installeur selon l'OS.
//
// Priorité de résolution :
//   1. Env var DOWNLOAD_URL_{WIN,MAC,LINUX,ANDROID,IOS} (Vercel)
//   2. Table DB AppRelease (admin peut éditer via /admin/app-releases)
//   3. Fallback : /download?soon=1&os=... avec bannière friendly
//
// Avantage de la DB : l'admin peut publier une nouvelle version sans
// redéployer le code Next.js — il met juste à jour la URL via /admin.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const ENV_MAP: Record<string, { envKey: string; platform: string }> = {
  win: { envKey: "DOWNLOAD_URL_WIN", platform: "win" },
  windows: { envKey: "DOWNLOAD_URL_WIN", platform: "win" },
  exe: { envKey: "DOWNLOAD_URL_WIN", platform: "win" },
  mac: { envKey: "DOWNLOAD_URL_MAC", platform: "mac" },
  macos: { envKey: "DOWNLOAD_URL_MAC", platform: "mac" },
  dmg: { envKey: "DOWNLOAD_URL_MAC", platform: "mac" },
  linux: { envKey: "DOWNLOAD_URL_LINUX", platform: "linux" },
  appimage: { envKey: "DOWNLOAD_URL_LINUX", platform: "linux" },
  android: { envKey: "DOWNLOAD_URL_ANDROID", platform: "android" },
  apk: { envKey: "DOWNLOAD_URL_ANDROID", platform: "android" },
  ios: { envKey: "DOWNLOAD_URL_IOS", platform: "ios" },
};

export async function GET(req: Request, ctx: { params: Promise<{ os: string }> }) {
  const { os } = await ctx.params;
  const map = ENV_MAP[os.toLowerCase()];

  let target: string | null = null;

  // 1. Env var
  if (map) {
    target = process.env[map.envKey] ?? null;
  }

  // 2. DB AppRelease (defensive si table pas pushée)
  if (!target && map) {
    try {
      const release = await db.appRelease.findUnique({
        where: { platform: map.platform },
      });
      if (release?.url) target = release.url;
    } catch {
      // table pas encore pushée — on continue avec le fallback
    }
  }

  if (target) {
    return NextResponse.redirect(target, 302);
  }

  // 3. Fallback : /download?soon=1
  const url = new URL(req.url);
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
