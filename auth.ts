// Configuration NextAuth v5 (App Router).
// Providers : Credentials (email/password + 2FA) + Passkey (WebAuthn) + Google (optionnel).

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, rateLimitReset, getClientIp } from "@/lib/rate-limit";
import { verifyTotpCode } from "@/lib/totp";
import { verifyPasskeyTicket } from "@/lib/passkey-ticket";
import type { UserRole, UserLocale } from "@prisma/client";

const providers: import("next-auth").NextAuthConfig["providers"] = [
  Credentials({
    name: "Email & mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
      totpCode: { label: "Code 2FA", type: "text" },
    },
    async authorize(credentials, request) {
      const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
      const password = credentials?.password as string | undefined;
      const totpCode = (credentials?.totpCode as string | undefined)?.replace(/\s/g, "");
      if (!email || !password) return null;

      // Anti brute-force : 10 tentatives par IP / 15 min, 5 par email / 15 min
      const ip = request ? getClientIp(request as Request) : "unknown";
      const ipRl = rateLimit(`login-ip:${ip}`, 10, 15 * 60 * 1000);
      const emailRl = rateLimit(`login-email:${email}`, 5, 15 * 60 * 1000);
      if (!ipRl.allowed || !emailRl.allowed) return null;

      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) return null;
      if (user.suspendedAt) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      // 2FA : si activé, vérifier le code TOTP ou un code de secours
      if (user.twoFactorEnabled) {
        if (!totpCode) return null;
        const cleanCode = totpCode.toUpperCase();
        const isTotp = /^\d{6}$/.test(cleanCode);

        if (isTotp && user.twoFactorSecret) {
          if (!verifyTotpCode(cleanCode, user.twoFactorSecret)) return null;
        } else {
          let matchedIndex = -1;
          for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
            if (await bcrypt.compare(cleanCode, user.twoFactorBackupCodes[i])) {
              matchedIndex = i;
              break;
            }
          }
          if (matchedIndex < 0) return null;
          const remaining = user.twoFactorBackupCodes.filter((_, i) => i !== matchedIndex);
          await db.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: remaining } });
        }
      }

      rateLimitReset(`login-email:${email}`);
      rateLimitReset(`login-ip:${ip}`);
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
      };
    },
  }),
  // Provider Passkey : prend un ticket signé renvoyé par /api/passkeys/login-verify.
  // Le ticket prouve qu'une assertion WebAuthn a été vérifiée côté serveur.
  Credentials({
    id: "passkey",
    name: "Passkey",
    credentials: { ticket: { label: "Ticket passkey", type: "text" } },
    async authorize(credentials) {
      const ticket = credentials?.ticket as string | undefined;
      if (!ticket) return null;
      const userId = verifyPasskeyTicket(ticket);
      if (!userId) return null;
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || user.suspendedAt) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase();
        const existing = await db.user.findUnique({ where: { email } });
        if (!existing) {
          const starter = await db.plan.findUnique({ where: { slug: "starter" } });
          const isBootstrapAdmin = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase() === email;
          await db.user.create({
            data: {
              email,
              name: user.name ?? null,
              image: user.image ?? null,
              role: isBootstrapAdmin ? "ADMIN" : "USER",
              planId: starter?.id,
              storageQuota: starter?.storageBytes ?? BigInt(0),
              emailVerified: new Date(),
            },
          });
        } else {
          await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await db.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.locale = dbUser.locale;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        (session.user as { role?: UserRole }).role = token.role as UserRole;
        (session.user as { locale?: UserLocale }).locale = token.locale as UserLocale;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        try {
          await db.activityLog.create({
            data: { userId: user.id, action: "login" },
          });
        } catch {
          /* ignore */
        }
      }
    },
    async signOut(message) {
      // message peut être { token } (jwt) ou { session } (db)
      const userId =
        "token" in message ? (message.token?.id as string | undefined) : message.session?.userId;
      if (userId) {
        try {
          await db.activityLog.create({ data: { userId, action: "logout" } });
        } catch {
          /* ignore */
        }
      }
    },
  },
});
