"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const ROLE_RU: Record<string, string> = {
  admin: "Администратор",
  director: "Директор",
  deputy_plus: "Заместитель +",
  deputy: "Заместитель",
  teacher_plus: "Педагог +",
  teacher: "Педагог",
};

export default function Sidebar() {
  const { data } = useSession();
  const authed = Boolean(data?.user);
  const roleSlug = (data?.user as any)?.role as string | null;
  const roleRu = roleSlug ? (ROLE_RU[roleSlug] ?? roleSlug) : null;
  const pathname = usePathname();

  return (
    <div className="sidebar">
      <div className="p-4 flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{authed ? data?.user?.name : "Гость"}</div>
          {authed && roleRu && <div className="text-sm opacity-70">{roleRu}</div>}
        </div>

        {authed && (
          <Link
            href="/settings"
            title="Настройки профиля"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5"
            aria-label="Настройки профиля"
          >
            {/* простая иконка-шестерёнка без зависимостей */}
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.94-2.88-.96-.55c.04-.35.06-.7.06-1.07s-.02-.72-.06-1.07l.96-.55a.75.75 0 0 0 .27-1.02l-1-1.73a.75.75 0 0 0-.95-.32l-1.1.46a7.73 7.73 0 0 0-1.84-1.07l-.17-1.18a.75.75 0 0 0-.74-.64h-2a.75.75 0 0 0-.74.64l-.17 1.18c-.65.25-1.27.6-1.84 1.07l-1.1-.46a.75.75 0 0 0-.95.32l-1 1.73a.75.75 0 0 0 .27 1.02l.96.55c-.04.35-.06.7-.06 1.07s.02.72.06 1.07l-.96.55a.75.75 0 0 0-.27 1.02l1 1.73c.2.34.62.48.95.32l1.1-.46c.57.47 1.2.82 1.84 1.07l.17 1.18c.07.37.38.64.74.64h2c.36 0 .67-.27.74-.64l.17-1.18c.65-.25 1.27-.6 1.84-1.07l1.1.46c.33.16.75.02.95-.32l1-1.73a.75.75 0 0 0-.27-1.02Z" />
            </svg>
          </Link>
        )}
      </div>

      {authed && (
        <nav>
          <ul className="nav">
            <li><Link href="/dashboard" aria-current={pathname==="/dashboard"}>Основное</Link></li>
            <li><Link href="/inboxTasks">Входящие / Задачи</Link></li>
            <li><Link href="/calendar">Календарь</Link></li>
            <li><Link href="/schedule">Расписание</Link></li>
            <li><Link href="/changes">Изменения в расписании</Link></li>
            <li><Link href="/teachers">Педагоги</Link></li>
          </ul>
        </nav>
      )}

      <div className="p-4 mt-auto">
        {authed ? (
          <button
            className="border rounded px-3 py-2 w-full"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            Выйти
          </button>
        ) : (
          <Link className="border rounded px-3 py-2 block text-center" href="/sign-in">
            Войти
          </Link>
        )}
      </div>
    </div>
  );
}
