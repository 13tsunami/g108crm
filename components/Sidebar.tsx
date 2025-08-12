// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ChatUnreadIndicator from "@/components/ChatUnreadIndicator";
import ChatWrap from "@/components/ChatWrap";

const ROLE_RU: Record<string, string> = {
  admin: "Администратор",
  director: "Директор",
  deputy_plus: "Заместитель +",
  deputy: "Заместитель",
  teacher_plus: "Педагог +",
  teacher: "Педагог",
};

type ThreadListItem = { id: string; unreadCount?: number | null };

export default function Sidebar() {
  const { data } = useSession();
  const authed = Boolean(data?.user);
  const roleSlug = (data?.user as any)?.role as string | null;
  const roleRu = roleSlug ? (ROLE_RU[roleSlug] ?? roleSlug) : null;
  const pathname = usePathname();

  const uid = useMemo(() => (data?.user as any)?.id as string | undefined, [data?.user]);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  async function refreshUnread() {
    if (!uid) { setUnreadTotal(0); return; }
    try {
      const r = await fetch("/api/chat/threads/list", {
        cache: "no-store",
        headers: { "X-User-Id": uid },
      }).catch(() => null);
      if (!r?.ok) return;
      const list = (await r.json()) as ThreadListItem[];
      const total = (list || []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0);
      setUnreadTotal(total);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    if (!authed) { setUnreadTotal(0); return; }
    refreshUnread();

    const onThreadsUpdated = () => refreshUnread();
    const onSsePush = () => refreshUnread();
    const onVis = () => { if (document.visibilityState === "visible") refreshUnread(); };

    window.addEventListener("g108:chat-threads-updated", onThreadsUpdated as any);
    window.addEventListener("g108:sse-push", onSsePush as any);
    window.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("g108:chat-threads-updated", onThreadsUpdated as any);
      window.removeEventListener("g108:sse-push", onSsePush as any);
      window.removeEventListener("visibilitychange", onVis);
    };
  }, [authed, uid]);

  const hasUnread = authed && unreadTotal > 0;

  return (
    <div className="sidebar">
      {/* локальные стили для акцентной подсветки «Чаты» */}
      <style jsx>{`
        .nav a {
          display: block;
          position: relative;
          padding: 8px 12px;
          border-radius: 10px;
        }
        .nav a[aria-current="true"] {
          background: #eef2ff;
          border: 1px solid #c7e3ff;
        }
        .nav a.chat-link--unread {
          background: #fff7ed;
          border: 1px solid #fde68a;
        }
        .nav a.chat-link--unread::before {
          content: "";
          position: absolute;
          left: -1px; top: -1px; bottom: -1px;
          width: 4px;
          background: #ef9b28;
          border-top-left-radius: 10px;
          border-bottom-left-radius: 10px;
        }
        .nav a .chat-badge {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
        }
      `}</style>

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
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.94-2.88-.96-.55c.04-.35.06-.7.06-1.07s-.02-.72-.06-1.07l.96-.55a.75.75 0 0 0 .27-1.02l-1-1.73a.75.75 0 0 0-.95-.32l-1.1.46a7.73 7.73 0 0 0-1.84-1.07l-.17-1.18a.75.75 0 0 0-.74-.64h-2a.75.75 0 0 0-.74.64l-.17 1.18c-.65.25-1.27.6-1.84 1.07l-1.1-.46a.75.75 0 0 0-.95.32l-1 1.73a.75.75 0 0 0 .27 1.02л.96.55c-.04.35-.06.7-.06 1.07s.02.72.06 1.07л-.96.55a.75.75 0 0 0-.27 1.02л1 1.73c.2.34.62.48.95.32л1.1-.46c.57.47 1.2.82 1.84 1.07л.17 1.18c.07.37.38.64.74.64h2c.36 0 .67-.27.74-.64л.17-1.18c.65-.25 1.27-.6 1.84-1.07л1.1.46c.33.16.75.02.95-.32л1-1.73a.75.75 0 0 0-.27-1.02Z" />
            </svg>
          </Link>
        )}
      </div>

      {authed && (
        <nav>
          <ul className="nav">
            <li><Link href="/dashboard" aria-current={pathname==="/dashboard"}>Основное</Link></li>

            <li>
              <Link
                href="/chat"
                aria-current={pathname==="/chat"}
                className={hasUnread ? "chat-link--unread" : undefined}
              >
                Чаты
                {/* Бейдж рисуем тем же компонентом, но уже с готовым числом */}
                <ChatUnreadIndicator asText count={unreadTotal} />
              </Link>
            </li>

            <li><Link href="/inboxTasks" aria-current={pathname==="/inboxTasks"}>Задачи</Link></li>
            <li><Link href="/calendar" aria-current={pathname==="/calendar"}>Календарь</Link></li>
            <li><Link href="/schedule" aria-current={pathname==="/schedule"}>Расписание</Link></li>
            <li><Link href="/changes" aria-current={pathname==="/changes"}>Изменения в расписании</Link></li>
            <li><Link href="/teachers" aria-current={pathname==="/teachers"}>Педагоги</Link></li>
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

      {/* единая подписка на chat SSE для всего приложения */}
      <ChatWrap />
    </div>
  );
}
