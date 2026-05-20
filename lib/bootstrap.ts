// Seed initial idempotent : plans + backend storage LOCAL (dev) + user demo (dev only).
// Sécurité : en prod, aucun user n'est créé automatiquement — utiliser /signup.

import bcrypt from "bcryptjs";
import path from "path";
import { db } from "./db";
import { DEFAULT_PLANS } from "./plans";

let bootstrapDone = false;
const DEMO_PASSWORD = process.env.MYCLOUD_DEMO_PASSWORD ?? "demo123";

export async function ensureBootstrap(): Promise<void> {
  if (bootstrapDone) return;

  // 1. Plans
  for (const plan of DEFAULT_PLANS) {
    await db.plan.upsert({ where: { slug: plan.slug }, update: {}, create: plan });
  }

  // 2. Backend storage LOCAL UNIQUEMENT en dev.
  //    En prod (Vercel), le filesystem est en lecture seule → l'admin doit
  //    configurer R2/B2/S3 via /admin/storage après le 1er déploiement.
  if (process.env.NODE_ENV === "development") {
    const defaultBackend = await db.storageBackend.findFirst({ where: { isDefault: true, isActive: true } });
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
  }

  // 3. User demo — UNIQUEMENT en dev (jamais en prod automatique)
  if (process.env.NODE_ENV === "development" && process.env.MYCLOUD_DISABLE_DEV_USER !== "1") {
    const existing = await db.user.findUnique({ where: { email: "demo@mycloud.local" } });
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
      // Mettre à jour son mot de passe si absent
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      await db.user.update({ where: { id: existing.id }, data: { passwordHash } });
    }
  }

  bootstrapDone = true;
}
