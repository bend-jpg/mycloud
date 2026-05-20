// Configuration NextAuth v5 (App Router).
// Providers : Credentials (email/password) en V1.
// Google et Resend (magic link) activés conditionnellement si les env vars existent.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { UserRole, UserLocale } from "@prisma/client";

const providers: import("next-auth").NextAuthConfig["providers"] = [
  Credentials({
    name: "Email & mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) return null;
      if (user.suspendedAt) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

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
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 jours
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Pour Google : on s'assure que le User existe dans notre DB
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
      // Au login, on récupère le User en DB et on met l'id en token
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
});
