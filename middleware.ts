// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized: ({ token }) => !!token, // без токена — редирект на /sign-in
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
});

export const config = {
  matcher: [
    // защищаем всё, КРОМЕ auth и статических/страницы входа
    "/((?!api/auth|_next/static|_next/image|_next/data|favicon.ico|sign-in).*)",
  ],
};
