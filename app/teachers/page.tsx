"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AddUserModal from "@/components/AddUserModal";
import EditUserModal from "@/components/EditUserModal";

const ACTIONS_WIDTH = 280; // фиксированная ширина колонки действий

const ROLE_RU: Record<string, string> = {
  admin: "Администратор",
  director: "Директор",
  deputy_plus: "Заместитель +",
  deputy: "Заместитель",
  teacher_plus: "Педагог +",
  teacher: "Педагог",
};

type RowUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  classroom?: string | null;
  roleSlug?: string; // <- БЕЗ null, чтобы совпадать с EditUserModal
  role?: string | { slug: string } | null;
  subjects?: string[];
  methodicalGroups?: string[];
  telegram?: string | null;
  avatarUrl?: string | null;
  about?: string | null;
  birthday?: string | null; // ISO
  username?: string | null;
};

type Presence = { id: string; lastSeen: string | null };

function getRoleSlug(u: RowUser): string | undefined {
  if (u.roleSlug) return u.roleSlug;
  if (typeof u.role === "string" && u.role) return u.role;
  if (u.role && typeof u.role === "object" && "slug" in u.role) return (u.role as any).slug;
  return undefined; // <- возвращаем undefined, не null
}
function ruRole(u: RowUser): string {
  const slug = getRoleSlug(u);
  return slug ? (ROLE_RU[slug] ?? slug) : "Педагог";
}
function isOnline(lastSeen?: string | null, thresholdMin = 5) {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Date.now() - t < thresholdMin * 60 * 1000;
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/>
    </svg>
  );
}
function SmallButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn ${props.className ?? ""}`} style={{ padding: "6px 10px", fontSize: 14 }} />;
}
function SmallPrimary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn-primary ${props.className ?? ""}`} style={{ padding: "6px 12px", fontSize: 14 }} />;
}

/** Модалка принудительной смены пароля (для директора/зам+). */
function ForcePasswordModal({
  user, onClose, onDone,
}: { user: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave = !loading && pwd.length >= 6 && pwd === pwd2;

  async function save() {
    if (!canSave) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const t = await res.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch {}
      if (!res.ok || j?.error) throw new Error(j?.error || t || `Ошибка ${res.status}`);
      onDone(); onClose();
    } catch (e: any) { setErr(e?.message || "Не удалось сменить пароль"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="card w-[420px] max-w-[94vw] p-4 relative" onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost absolute right-2 top-2" onClick={onClose}>×</button>
        <h3 className="text-lg font-medium mb-2">Сбросить пароль</h3>
        <div className="text-sm text-neutral-600 mb-3">Пользователь: <span className="font-medium">{user.name}</span></div>

        {err && <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 mb-2 text-sm">{err}</div>}

        <div className="space-y-2">
          <div>
            <label className="block mb-1 text-sm">Новый пароль</label>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Минимум 6 символов" style={{ height: 36, fontSize: 14 }} autoFocus />
          </div>
          <div>
            <label className="block mb-1 text-sm">Повторите пароль</label>
            <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} style={{ height: 36, fontSize: 14 }} />
            {pwd && pwd2 && pwd !== pwd2 && <div className="text-xs text-red-600 mt-1">Пароли не совпадают</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <SmallButton onClick={onClose}>Отмена</SmallButton>
          <div className="flex-1" />
          <SmallPrimary onClick={save} disabled={!canSave}>{loading ? "Сохранение…" : "Сменить пароль"}</SmallPrimary>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { data } = useSession();
  const mySlug = (data?.user as any)?.role as string | undefined;
  const canManage = mySlug === "director" || mySlug === "deputy_plus";

  const [users, setUsers] = useState<RowUser[]>([]);
  const [presence, setPresence] = useState<Record<string, string | null>>({});
  const [details, setDetails] = useState<Record<string, RowUser>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<RowUser | null>(null);
  const [forceUser, setForceUser] = useState<{ id: string; name: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/users", { cache: "no-store" });
      const j = await r.text();
      const arr: RowUser[] = (() => { try { return JSON.parse(j); } catch { return []; } })();
      setUsers(Array.isArray(arr) ? arr : (arr as any)?.users ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // presence: PATCH для своего "пинга" и GET для списка (fallback на /presence).
  useEffect(() => {
    let alive = true;

    const beat = async () => {
      try {
        let r = await fetch("/api/presence", { method: "PATCH" });
        if (r.status === 404) await fetch("/presence", { method: "PATCH" });
      } catch {}
    };

    const pull = async () => {
      try {
        let r = await fetch("/api/presence", { cache: "no-store" });
        if (r.status === 404) r = await fetch("/presence", { cache: "no-store" });
        const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch {}
        const arr: any[] = Array.isArray(j) ? j : (Array.isArray(j?.list) ? j.list : (Array.isArray(j?.users) ? j.users : []));
        if (!alive) return;
        const map: Record<string, string | null> = {};
        for (const it of arr) {
          if (it && typeof it.id === "string") map[it.id] = it.lastSeen ?? null;
        }
        setPresence(map);
      } catch {}
    };

    beat(); pull();
    const i1 = setInterval(beat, 60_000);
    const i2 = setInterval(pull, 60_000);
    return () => { alive = false; clearInterval(i1); clearInterval(i2); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      [
        u.name, ruRole(u), u.email ?? "", u.phone ?? "", u.classroom ?? "",
        ...(u.subjects ?? []), ...(u.methodicalGroups ?? []),
      ].join(" ").toLowerCase().includes(s)
    );
  }, [users, q]);

  async function openExpand(u: RowUser) {
    const id = u.id;
    setExpandedId(prev => (prev === id ? null : id));
    if (!details[id]) {
      try {
        const r = await fetch(`/api/users/${id}`, { cache: "no-store" });
        const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch {}
        if (j && !j.error) setDetails(prev => ({ ...prev, [id]: j }));
      } catch {}
    }
  }

  async function doDelete() {
    if (!delId) return;
    const r = await fetch(`/api/users/${delId}`, { method: "DELETE" });
    if (!r.ok) { alert("Не удалось удалить"); return; }
    setDelOpen(false); setDelId(""); await load();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Педагоги</h2>

      {/* верхняя панель */}
      <div className="flex gap-2 items-center mb-3">
        <input
          placeholder="Поиск: ФИО, роль, email, телефон, класс, группы, предметы"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input"
          style={{ height: 36, fontSize: 14, width: 520 }}
        />
        {canManage && (
          <>
            <SmallPrimary onClick={() => setAddOpen(true)}>Добавить</SmallPrimary>
            <SmallButton onClick={() => setDelOpen(true)}>Удалить</SmallButton>
          </>
        )}
        <SmallButton onClick={load}>{loading ? "Обновление…" : "Обновить"}</SmallButton>
      </div>

      {/* список */}
      <div className="card divide-y">
        {filtered.map((u) => {
          const online = isOnline(presence[u.id]);
          const expanded = expandedId === u.id;
          const d = details[u.id] ?? u;

          return (
            <div key={u.id} className="p-2">
              {/* РОВНАЯ СТРОКА: имя/статус слева, фиксированная зона кнопок справа */}
              <div className="grid items-center gap-2" style={{ gridTemplateColumns: `minmax(180px,1fr) ${ACTIONS_WIDTH}px` }}>
                <button
                  className="text-left hover:underline rounded-full"
                  style={{ padding: "8px 12px", background: "#f5f6f7" }}
                  onClick={() => openExpand(u)}
                  title="Показать подробности"
                >
                  <div className="font-medium">{u.name}</div>
                  <div style={{ fontSize: 12, color: online ? "#16a34a" : "#ef4444", lineHeight: "16px" }}>
                    {online ? "онлайн" : "оффлайн"}
                  </div>
                </button>

                {canManage ? (
                  <div className="flex justify-end gap-8" style={{ paddingRight: 4 }}>
                    <SmallButton onClick={() => setForceUser({ id: u.id, name: u.name })} title="Принудительно задать пароль">
                      <span className="inline-flex items-center gap-1">
                        <LockIcon /> Задать пароль
                      </span>
                    </SmallButton>
                    <SmallButton onClick={() => setEditUser(u)}>Редактировать</SmallButton>
                  </div>
                ) : (
                  <div /> // пустая колонка, чтобы сетка не прыгала
                )}
              </div>

              {/* РАЗВОРОТ — вся инфа компактно, метки жирные */}
              {expanded && (
                <div className="mt-2" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.6)" }}>
                  <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                    <div className="space-y-1">
                      <div><strong>Роль:</strong> {ruRole(d)}</div>
                      <div><strong>E-mail:</strong> {d.email || "—"}</div>
                      <div><strong>Телефон:</strong> {d.phone || "—"}</div>
                      <div><strong>Классное руководство:</strong> {d.classroom || "—"}</div>
                      <div><strong>Telegram:</strong> {d.telegram || "—"}</div>
                      <div><strong>Дата рождения:</strong> {d.birthday ? new Date(d.birthday).toLocaleDateString() : "—"}</div>
                      {d.username && <div><strong>Логин:</strong> {d.username}</div>}
                    </div>
                    <div className="space-y-1">
                      <div><strong>Предметы:</strong> {d.subjects?.length ? d.subjects.join(", ") : "—"}</div>
                      <div><strong>Методические объединения:</strong> {d.methodicalGroups?.length ? d.methodicalGroups.join(", ") : "—"}</div>
                      <div className="flex items-start gap-8">
                        {d.avatarUrl ? (
                          <img src={d.avatarUrl} alt="" className="rounded-full" style={{ width: 48, height: 48, objectFit: "cover", marginTop: 2 }} />
                        ) : null}
                        <div>
                          <div><strong>О себе:</strong></div>
                          <div className="whitespace-pre-wrap">{d.about || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && <div className="p-6 text-neutral-500">Ничего не найдено</div>}
      </div>

      {addOpen && <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={load}
          allowRoleChange={canManage}
        />
      )}

      {forceUser && (
        <ForcePasswordModal
          user={forceUser}
          onClose={() => setForceUser(null)}
          onDone={load}
        />
      )}

      {delOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setDelOpen(false)}>
          <div className="card w-[520px] max-w-[94vw] p-4 relative" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost absolute right-2 top-2" onClick={() => setDelOpen(false)}>×</button>
            <h3 className="text-lg font-medium mb-3">Удалить пользователя</h3>
            <select value={delId} onChange={(e) => setDelId(e.target.value)} className="input w-full mb-3" style={{ height: 36, fontSize: 14 }}>
              <option value="">— выберите —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {ruRole(u)}</option>)}
            </select>
            <div className="flex gap-2">
              <SmallPrimary onClick={doDelete} disabled={!delId}>Удалить</SmallPrimary>
              <SmallButton onClick={() => setDelOpen(false)}>Отмена</SmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
