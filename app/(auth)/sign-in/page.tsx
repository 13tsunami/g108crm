// app/(auth)/sign-in/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const params = useSearchParams();
  const err = params.get("error");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await signIn("credentials", {
      redirect: true,
      username,
      password,
      callbackUrl: "/dashboard", // ⬅️ было "/teachers"
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <div className="text-lg text-neutral-600">Гимназия № 108 имени В. Н. Татищева</div>
        <h1 className="text-3xl font-semibold mt-1">Добро пожаловать в CRM-систему</h1>
        <div className="text-neutral-600 mt-2">Необходим вход в систему</div>
      </div>

      {err && <p className="text-red-600 mb-4">Ошибка авторизации. Проверьте логин и пароль.</p>}

      <form onSubmit={onSubmit} className="space-y-3 max-w-md">
        <div>
          <label className="block text-sm mb-1">Логин</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Пароль</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" className="rounded px-4 py-2 border hover:bg-black/5">
          Войти
        </button>
      </form>
    </div>
  );
}
