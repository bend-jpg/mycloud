import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["FAMILY", "WORKSPACE"]).default("FAMILY"),
});

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const memberships = await db.membership.findMany({
    where: { userId: session.id },
    include: {
      team: {
        include: { _count: { select: { members: true, files: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  return NextResponse.json({
    teams: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      type: m.team.type,
      role: m.role,
      memberCount: m.team._count.members,
      fileCount: m.team._count.files,
    })),
  });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const { name, type } = parsed.data;

  // Vérifie quota du plan : nombre de membres autorisés
  const userWithPlan = await db.user.findUnique({
    where: { id: session.id },
    include: { plan: true },
  });
  if (!userWithPlan?.plan || userWithPlan.plan.maxMembers < 2) {
    return NextResponse.json(
      { error: "PLAN_NO_TEAM", message: "Ton plan ne permet pas d'espaces partagés." },
      { status: 403 }
    );
  }

  const team = await db.$transaction(async (tx) => {
    const t = await tx.team.create({
      data: { name, type, ownerId: session.id },
    });
    await tx.membership.create({
      data: { teamId: t.id, userId: session.id, role: "OWNER" },
    });
    return t;
  });

  return NextResponse.json({
    ok: true,
    team: { id: team.id, name: team.name, type: team.type },
  });
}
