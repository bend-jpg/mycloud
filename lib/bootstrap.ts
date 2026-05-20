// Seed initial idempotent : plans + backend storage LOCAL (dev) + user demo (dev only).
// Optimisé pour cold starts Vercel : check rapide au lieu d'upsert systématique.

import bcrypt from "bcryptjs";
import path from "path";
import { db } from "./db";
import { DEFAULT_PLANS } from "./plans";

let bootstrapDone = false;
const DEMO_PASSWORD = process.env.MYCLOUD_DEMO_PASSWORD ?? "demo123";

export async function ensureBootstrap(): Promise<void> {
  if (bootstrapDone) return;

  // Fast-path : si le 1er plan existe, on suppose que tout est déjà seedé
  // (cas le plus fréquent à chaque cold start). 1 SELECT au lieu de 4 UPSERT.
  const firstPlan = await db.plan.findUnique({
    where: { slug: DEFAULT_PLANS[0].slug },
    select: { id: true },
  });

  if (!firstPlan) {
    for (const plan of DEFAULT_PLANS) {
      await db.plan.upsert({ where: { slug: plan.slug }, update: {}, create: plan });
    }
  }

  // Backend storage LOCAL UNIQUEMENT en dev.
  if (process.env.NODE_ENV === "development") {
    const defaultBackend = await db.storageBackend.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });
    if (!defaultBackend) {
      await db.storageBackend.create({
        data: {
          name: "Stockage local (dev)",
          type: "LOCAL",
          bucket: "mycloud",
          accessKeyId: "local",
          secretAccessKey: "local",
          endpoint: path.resolve(process.cwd(), ".storage", "mycloud"),
          isDefault: true,
          isActive: true,
        },
      });
    }

    if (process.env.MYCLOUD_DISABLE_DEV_USER !== "1") {
      const existing = await db.user.findUnique({
        where: { email: "demo@mycloud.local" },
        select: { id: true, passwordHash: true },
      });
      if (!existing) {
        const family = await db.plan.findUnique({ where: { slug: "family" } });
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
        await db.user.create({
          data: {
            email: "demo@mycloud.local",
            name: "Demo",
            passwordHash,
            role: "ADMIN",
            locale: "fr",
            planId: family?.id,
            storageQuota: family?.storageBytes ?? BigInt(0),
            emailVerified: new Date(),
          },
        });
        console.log(`[mycloud] Dev user créé : demo@mycloud.local / ${DEMO_PASSWORD}`);
      } else if (!existing.passwordHash) {
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
        await db.user.update({ where: { id: existing.id }, data: { passwordHash } });
      }
    }
  }

  bootstrapDone = true;
}
