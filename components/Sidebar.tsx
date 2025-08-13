// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ChatUnreadIndicator from "@/components/ChatUnreadIndicator";
import ChatWrap from "@/components/ChatWrap";

const BRAND = "#8d2828";

const ROLE_RU: Record<string, string> = {
  admin: "Администратор",
  director: "Директор",
  deputy_plus: "Заместитель +",
  deputy: "Заместитель",
  teacher_plus: "Педагог +",
  teacher: "Педагог",
};

type ThreadListItem = { id: string; unreadCount?: number | null };

function NavTile(props: { href: string; active: boolean; label: string; unread?: number | null }) {
  const { href, active, label, unread } = props;
  const hasUnread = typeof unread === "number" && unread > 0;
  return (
    <Link href={href} className="navlink" aria-current={active ? "true" : undefined}>
      <div className={`tile ${active ? "active" : ""} ${hasUnread && !active ? "unread" : ""}`}>
        <span className="label" title={label}>{label}</span>
        {hasUnread ? (
          <span className="badge" aria-label="Непрочитанные">
            <ChatUnreadIndicator asText count={unread || 0} />
          </span>
        ) : null}
      </div>
      <style jsx>{`
        .navlink { display: block; text-decoration: none; }
        .tile {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 44px 10px 12px;
          margin: 6px 0;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .tile:hover { background: #f7fbff; border-color: #c7e3ff; }
        .tile.active { background: #eef2ff; border-color: #c7e3ff; }
        .tile.unread::before {
          content: "";
          position: absolute; left: -1px; top: -1px; bottom: -1px;
          width: 4px; background: #ef9b28;
          border-top-left-radius: 12px; border-bottom-left-radius: 12px;
        }
        .label { color: #111827; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .badge {
          position: absolute; right: 12px; top: 8px;
          font-size: 11px; line-height: 18px;
          min-width: 24px; text-align: center;
          padding: 0 6px; border-radius: 9999px;
          background: ${BRAND}; color: #fff;
        }
      `}</style>
    </Link>
  );
}

export default function Sidebar() {
  const { data } = useSession();
  const pathname = usePathname();

  const authed = Boolean(data?.user);
  const roleSlug = (data?.user as any)?.role as string | null;
  const roleRu = roleSlug ? (ROLE_RU[roleSlug] ?? roleSlug) : null;
  const isPriv = roleSlug === "director" || roleSlug === "deputy_plus";
  const uid = useMemo(() => (data?.user as any)?.id as string | undefined, [data?.user]);

  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  async function refreshUnread() {
    if (!uid) return setUnreadTotal(0);
    try {
      const r = await fetch("/api/chat/threads/list", {
        cache: "no-store",
        headers: { "X-User-Id": uid },
      }).catch(() => null);
      if (!r?.ok) return;
      const list = (await r.json()) as ThreadListItem[];
      const total = (list || []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0);
      setUnreadTotal(total);
    } catch {}
  }
  useEffect(() => {
    if (!authed) return;
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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);
  const [cleanErr, setCleanErr] = useState<string | null>(null);

  async function runPurge() {
    setCleaning(true); setCleanErr(null); setCleanMsg(null);
    try {
      const r = await fetch("/api/admin/cleanup-ghosts?purge=1", { method: "POST" });
      const ct = r.headers.get("content-type") || "";
      const payload = ct.includes("application/json") ? await r.json() : null;
      if (!r.ok) throw new Error(payload?.error || `HTTP ${r.status}`);
      const removed = (payload?.deleted || []).length ?? 0;
      setConfirmOpen(false);
      setCleanMsg(`Удалено призраков: ${removed}.`);
      setTimeout(() => setCleanMsg(null), 4500);
    } catch (e: any) {
      setCleanErr(e?.message || "Не удалось очистить");
      setTimeout(() => setCleanErr(null), 6000);
    } finally {
      setCleaning(false);
    }
  }

  return (
    <aside className="wrap">
      <div className="head">
        <div className="who">
          <div className="name" title={(data?.user?.name as string) || "Гость"}>
            {(data?.user?.name as string) || "Гость"}
          </div>

          {/* НОВОЕ: роль + шестерёнка в одной строке; ⚙️ чуть больше */}
          {authed && (
            <div className="metaRow">
              {roleRu && <div className="rolePill">{roleRu}</div>}
             <Link href="/settings" title="Настройки профиля" className="settings" aria-label="Настройки профиля">
  <span className="gear-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path fill="currentColor" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.94-2.88-.96-.55c.04-.35.06-.7.06-1.07s-.02-.72-.06-1.07l.96-.55a.75.75 0 0 0 .27-1.02l-1-1.73a.75.75 0 0 0-.95-.32l-1.1.46a7.73 7.73 0 0 0-1.84-1.07l-.17-1.18a.75.75 0 0 0-.74-.64h-2a.75.75 0 0 0-.74.64l-.17 1.18c-.65.25-1.27.6-1.84 1.07l-1.1-.46a.75.75 0 0 0-.95.32l-1 1.73a.75.75 0 0 0 .27 1.02l.96.55c-.04.35-.06.7-.06 1.07s.02-.72.06-1.07l-.96-.55a.75.75 0 0 0-.27 1.02l1 1.73c.2.34.62.48.95.32l1.1-.46c.57.47 1.2.82 1.84 1.07l.17 1.18c.07.37.38.64.74.64h2c.36 0 .67-.27.74-.64l.17-1.18c.65-.25 1.27-.6 1.84-1.07l1.1.46c.33.16.75.02.95-.32l1-1.73a.75.75 0 0 0-.27-1.02Z" />
    </svg>
  </span>
</Link>

            </div>
          )}
        </div>
        {/* Раньше иконка была здесь — убрано, чтобы не менять остальную верстку. */}
      </div>

      <nav className="nav">
        {authed && (
          <>
            {isPriv && <NavTile href="/admin/groups" active={pathname === "/admin/groups"} label="Кафедры и группы" />}

            <NavTile href="/dashboard"    active={pathname === "/dashboard"}    label="Основное" />
            <NavTile href="/chat"         active={pathname === "/chat"}         label="Чаты" unread={pathname !== "/chat" ? unreadTotal : 0} />
            <NavTile href="/inboxTasks"   active={pathname === "/inboxTasks"}   label="Задачи" />
            <NavTile href="/calendar"     active={pathname === "/calendar"}     label="Календарь" />
            <NavTile href="/schedule"     active={pathname === "/schedule"}     label="Расписание" />
            <NavTile href="/changes"      active={pathname === "/changes"}      label="Изменения в расписании" />
            <NavTile href="/teachers"     active={pathname === "/teachers"}     label="Педагоги" />
          </>
        )}
      </nav>

      <div className="foot">
        {isPriv && (
          <>
            <button className="btn danger" onClick={() => setConfirmOpen(true)}>Окончательное удаление</button>
            {cleanMsg && <div className="note">{cleanMsg}</div>}
            {cleanErr && <div className="error">{cleanErr}</div>}
          </>
        )}
        {authed ? (
          <button className="btn primary" onClick={() => signOut({ callbackUrl: "/sign-in" })}>Выйти</button>
        ) : (
          <Link className="btn primary" href="/sign-in">Войти</Link>
        )}
      </div>

      {confirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => !cleaning && setConfirmOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => !cleaning && setConfirmOpen(false)} aria-label="Закрыть">×</button>
            <h3 className="modal-title">Окончательное удаление</h3>
            <p className="modal-text">
              Вы собираетесь очистить базу от архивированных и удаленных пользователей. Это действие необратимо.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmOpen(false)} disabled={cleaning}>Отмена</button>
              <button className="btn danger" onClick={runPurge} disabled={cleaning}>
                {cleaning ? "Удаление…" : "Удалить окончательно"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatWrap />

      <style jsx>{`
        .wrap { display: grid; grid-template-rows: auto 1fr auto; height: 100%; background:#fff; border-right:1px solid #e5e7eb; font-size:14px; }
        .head { display:flex; align-items:center; justify-content:space-between; min-height:64px; padding:12px; border-bottom:1px solid #e5e7eb; }
        .who { min-width:0; }
        .name { font-weight:800; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .metaRow { display:flex; align-items:center; gap:8px; margin-top:4px; }
        .rolePill { display:inline-block; font-size:12px; color:#374151; padding:2px 8px; border:1px solid #e5e7eb; border-radius:9999px; background:#fafafa; }
        .settings { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:9999px; }
        .settings:hover { background: rgba(236, 240, 20, 1); }
        .gear-icon { display:inline-flex; transform: scale(1.5); transform-origin: center; }

        .nav { padding:10px; }

        .foot { padding:12px; border-top:1px solid #e5e7eb; display:grid; gap:8px; }
        .btn { height:36px; border:1px solid #e5e7eb; background:#fff; border-radius:10px; display:flex; align-items:center; justify-content:center; }
        .btn:hover { background:#f9fafb; }
        .primary { background:${BRAND}; color:#fff; border-color:${BRAND}; }
        .primary:hover { filter: brightness(0.96); }
        .danger { border-color:#ef4444; background:#ef4444; color:#fff; }
        .danger:hover { filter: brightness(0.98); }
        .note { font-size:12px; color:#16a34a; }
        .error { font-size:12px; color:#ef4444; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal-card { position: relative; width: 520px; max-width: calc(100vw - 32px); background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 16px; box-shadow: 0 16px 40px rgba(0,0,0,.2); }
        .close { position:absolute; right:8px; top:6px; border:none; background:transparent; font-size:20px; line-height:1; cursor:pointer; }
        .modal-title { margin: 0 0 8px; font-size:16px; font-weight:700; }
        .modal-text { margin: 0 0 12px; font-size:14px; color:#374151; }
        .modal-actions { display:flex; justify-content:flex-end; gap:8px; }
      `}</style>
    </aside>
  );
}
