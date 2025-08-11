// auth.config.ts — NextAuth v4, JWT-сессии, "логин" работает как username/email/phone
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  debug: true,
  logger: {
    error(code, ...msg) { console.error("[auth][error]", code, ...msg); },
    warn(code, ...msg) { console.warn("[auth][warn]", code, ...msg); },
    debug(code, ...msg) { console.debug("[auth][debug]", code, ...msg); },
  },
  providers: [
    CredentialsProvider({
      name: "Логин и пароль",
      credentials: {
        username: { label: "Логин", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.username?.toString().trim() ?? "";
        const password = credentials?.password?.toString() ?? "";
        if (!identifier || !password) return null;

        // Проверяем, есть ли в БД столбец username
        const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
          `PRAGMA table_info('User');`
        );
        const hasUsername = cols.some((c) => c.name === "username");

        let dbUser: any = null;

        if (hasUsername) {
          // Ищем строго по username, без участия Prisma-типов
          const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name, email, username, role, passwordHash
             FROM "User" WHERE "username" = ? LIMIT 1`,
            identifier
          );
          dbUser = rows[0] ?? null;
        } else {
          // Если username-колонки нет, трактуем ввод как email или телефон
          if (identifier.includes("@")) {
            dbUser = await prisma.user.findUnique({ where: { email: identifier } });
          } else {
            // Пытаемся как phone, иначе в крайнем случае по имени
            const onlyDigits = identifier.replace(/\D+/g, "");
            if (onlyDigits.length >= 5) {
              dbUser = await prisma.user.findUnique({ where: { phone: identifier } });
            }
            if (!dbUser) {
              dbUser = await prisma.user.findFirst({ where: { name: identifier } });
            }
          }
        }

        if (!dbUser?.passwordHash) return null;

        const ok = await compare(password, dbUser.passwordHash);
        if (!ok) return null;

        return {
          id: dbUser.id,
          name: dbUser.name ?? identifier,
          email: dbUser.email ?? null,
          role: dbUser.role ?? "user",
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role ?? "user";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev_secret_change_me",
};
