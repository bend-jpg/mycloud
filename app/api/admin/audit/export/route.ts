// GET /api/admin/audit/export — export CSV du journal d'audit.
//
// Le journal était consultable page par page, sans moyen de l'extraire. Or
// c'est exactement ce qu'on demande lors d'un contrôle, d'un litige avec un
// client, ou pour analyser une série d'actions suspectes : un journal qu'on
// ne peut que feuilleter à l'écran ne sert pas à grand-chose.
//
// L'export reprend les MÊMES filtres que la page : ce qu'on voit est ce
// qu'on exporte. Un export qui ignorerait les filtres produirait un fichier
// qui ne correspond pas à ce que l'utilisateur croit avoir demandé.
//
// Accès restreint à la permission page.audit — celle réservée à l'ADMIN.
// L'export est plus sensible que la consultation : il sort les données de
// l'application.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { buildCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plafond de sécurité : un export illimité sur un journal de plusieurs
// millions de lignes ferait dépasser le temps d'exécution et la mémoire de
// la fonction. Au-delà, l'utilisateur doit affiner ses filtres — c'est
// annoncé dans l'en-tête du fichier plutôt que tronqué en silence.
const MAX_ROWS = 50_000;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasPermission(session.role, "page.audit")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;

  // Mêmes filtres que app/[locale]/(admin)/admin/audit/page.tsx
  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q } },
      {
        actor: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, logs] = await Promise.all([
    db.adminAuditLog.count({ where }),
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: { actor: { select: { email: true, name: true } } },
    }),
  ]);

  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.actor?.email ?? "",
    log.actor?.name ?? "",
    log.action,
    log.targetType ?? "",
    log.targetId ?? "",
    log.ipAddress ?? "",
    log.metadata ?? "",
  ]);

  const csv = buildCsv(
    ["Date (UTC)", "Auteur (email)", "Auteur (nom)", "Action", "Type de cible", "Cible", "Adresse IP", "Détails"],
    rows,
  );

  const truncated = total > logs.length;
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `journal-audit-${stamp}${truncated ? `-partiel-${logs.length}-sur-${total}` : ""}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Le nom du fichier indique déjà la troncature ; cet en-tête permet à
      // l'interface de l'annoncer aussi.
      "X-Total-Rows": String(total),
      "X-Exported-Rows": String(logs.length),
      // Jamais mis en cache : le journal change en permanence, et un export
      // servi depuis un cache donnerait une fausse image de la situation.
      "Cache-Control": "no-store",
    },
  });
}
