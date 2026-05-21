// Agrège les fichiers d'un user en catégories MIME + en série temporelle mensuelle.
// Utilisé pour les graphes du dashboard. Aucune lib externe.

import { db } from "./db";

export type MimeCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "other";

export interface CategoryStat {
  category: MimeCategory;
  label: string;
  color: string;
  bytes: number;
  count: number;
}

export interface MonthBucket {
  /** ISO de la 1ère du mois (UTC) */
  monthIso: string;
  label: string; // "Jan", "Fév"…
  count: number;
  bytes: number;
}

const CATEGORY_META: Record<MimeCategory, { label: string; color: string }> = {
  image: { label: "Images", color: "var(--accent)" },
  video: { label: "Vidéos", color: "var(--secondary)" },
  audio: { label: "Audio", color: "#a855f7" }, // violet
  document: { label: "Documents", color: "#22c55e" }, // green
  archive: { label: "Archives", color: "#f59e0b" }, // amber
  code: { label: "Code", color: "#ec4899" }, // pink
  other: { label: "Autres", color: "#64748b" }, // slate
};

function categorize(mime: string): MimeCategory {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime === "application/pdf" ||
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("ms-excel") ||
    mime.includes("ms-powerpoint") ||
    mime.includes("opendocument") ||
    mime.includes("text/plain") ||
    mime.includes("text/csv") ||
    mime.includes("text/rtf")
  ) {
    return "document";
  }
  if (
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    mime.includes("tar") ||
    mime.includes("gzip") ||
    mime.includes("bzip")
  ) {
    return "archive";
  }
  if (
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("html") ||
    mime.includes("css") ||
    mime.includes("yaml") ||
    mime.includes("python") ||
    mime.startsWith("text/")
  ) {
    return "code";
  }
  return "other";
}

/** Récupère les fichiers d'un user (perso, hors corbeille) et calcule les stats. */
export async function getUserStorageStats(userId: string): Promise<{
  totalBytes: number;
  totalFiles: number;
  categories: CategoryStat[];
  months: MonthBucket[];
}> {
  const files = await db.file.findMany({
    where: { ownerId: userId, isTrash: false, teamId: null },
    select: { mimeType: true, size: true, uploadedAt: true },
  });

  // Catégories
  const byCat: Record<MimeCategory, { bytes: number; count: number }> = {
    image: { bytes: 0, count: 0 },
    video: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    document: { bytes: 0, count: 0 },
    archive: { bytes: 0, count: 0 },
    code: { bytes: 0, count: 0 },
    other: { bytes: 0, count: 0 },
  };
  let totalBytes = 0;
  for (const f of files) {
    const cat = categorize(f.mimeType);
    const size = Number(f.size);
    byCat[cat].bytes += size;
    byCat[cat].count += 1;
    totalBytes += size;
  }
  const categories: CategoryStat[] = (Object.keys(byCat) as MimeCategory[])
    .map((cat) => ({
      category: cat,
      label: CATEGORY_META[cat].label,
      color: CATEGORY_META[cat].color,
      bytes: byCat[cat].bytes,
      count: byCat[cat].count,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.bytes - a.bytes);

  // 12 derniers mois
  const now = new Date();
  const monthStarts: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthStarts.push(d);
  }
  const labels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const months: MonthBucket[] = monthStarts.map((d) => ({
    monthIso: d.toISOString(),
    label: labels[d.getUTCMonth()],
    count: 0,
    bytes: 0,
  }));
  for (const f of files) {
    const upMonth = new Date(
      Date.UTC(f.uploadedAt.getUTCFullYear(), f.uploadedAt.getUTCMonth(), 1),
    );
    const idx = months.findIndex((m) => m.monthIso === upMonth.toISOString());
    if (idx >= 0) {
      months[idx].count += 1;
      months[idx].bytes += Number(f.size);
    }
  }

  return {
    totalBytes,
    totalFiles: files.length,
    categories,
    months,
  };
}
