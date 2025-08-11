"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AddUserModal from "@/components/AddUserModal";
import EditUserModal from "@/components/EditUserModal";

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
  roles?: { slug: string; name?: string }[];
  roleSlug?: string;
  role?: string | { slug: string; name?: string };
  subjects?: string[];
  methodicalGroups?: string[];
  telegram?: string | null;
  avatarUrl?: string | null;
  about?: string | null;
  birthday?: string | null; // ISO (может прийти строкой)
};

type Presence = { id: string; lastSeen: string | null };

function getRoleSlug(u: RowUser): string | null {
  if (u.roleSlug) return u.roleSlug;
  if (Array.isArray(u.roles) && u.roles[0]?.slug) return u.roles[0].slug;
  if (typeof u.role === "string") return u.role;
  if (u.role && typeof u.role === "object" && "slug" in u.role) return (u.role as any).slug;
  return null;
}
function ruRole(u: RowUser): string {
  const slug = getRoleSlug(u);
  return slug ? (ROLE_RU[slug] ?? slug) : "Педагог";
}
function onlineFrom(lastSeen?: string | null, thresholdMin = 5) {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Date.now() - t < thresholdMin * 60 * 1000;
}

export default function Page() {
  const { data } = useSession();
  const mySlug = (data?.user as any)?.role || null;

  const [users, setUsers] = useState<RowUser[]>([]);
  const [presence, setPresence] = useState<Record<string, string | null>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<RowUser | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState<string>("");

  const canCreate = mySlug === "director" || mySlug === "deputy_plus";
  const canEdit   = mySlug === "director" || mySlug === "deputy_plus";
  const canDelete = mySlug === "director" || mySlug === "deputy_plus";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/users", { cache: "no-store" });
      const j = await r.json();
      const arr: RowUser[] = Array.isArray(j) ? j : (j?.users ?? []);
      setUsers(arr);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // presence: обновляем свой lastSeen и периодически тянем всех
  useEffect(() => {
    let alive = true;
    const beat = async () => { try { await fetch("/api/presence", { method: "PATCH" }); } catch {} };
    const pull = async () => {
      try {
        const r = await fetch("/api/presence", { cache: "no-store" });
        const arr: Presence[] = await r.json();
        if (!alive) return;
        const map: Record<string, string | null> = {};
        for (const p of arr) map[p.id] = p.lastSeen ?? null;
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

  async function doDelete() {
    if (!delId) return;
    const r = await fetch(`/api/users/${delId}`, { method: "DELETE" });
    if (!r.ok) { alert("Не удалось удалить"); return; }
    setDelOpen(false); setDelId(""); await load();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Педагоги</h2>

      <div className="flex gap-3 items-center mb-3">
        <input
          placeholder="Поиск: ФИО, роль, email, телефон, класс, группы, предметы"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input w-[520px]"
        />
        <button className="btn-primary" onClick={() => setAddOpen(true)} disabled={!canCreate}>
          Добавить пользователя
        </button>
        <button className="btn" onClick={() => setDelOpen(true)} disabled={!canDelete}>Удалить пользователя</button>
        <button className="btn" onClick={load}>{loading ? "Обновление…" : "Обновить"}</button>
      </div>

      <div className="card divide-y">
        {filtered.map((u) => {
          const isOnline = onlineFrom(presence[u.id]);
          const expanded = expandedId === u.id;
          return (
            <div key={u.id} className="p-3">
              {/* строка-«сводка» */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="text-left flex-1 hover:underline"
                  onClick={() => setExpandedId(expanded ? null : u.id)}
                  title="Показать подробности"
                >
                  <div className="font-medium">{u.name}</div>
                  <div className={`text-xs ${isOnline ? "text-green-600" : "text-red-500"}`}>
                    {isOnline ? "онлайн" : "оффлайн"}
                  </div>
                </button>
                <div className="hidden sm:block text-sm text-neutral-700 w-[28ch] truncate">{u.email || "—"}</div>
                <div className="hidden sm:block text-sm text-neutral-700 w-[18ch]">{u.phone || "—"}</div>
                <button className="btn" onClick={() => setEditUser(u)} disabled={!canEdit}>Редактировать</button>
              </div>

              {/* разворот */}
              {expanded && (
                <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div><span className="text-neutral-500">Роль:</span> {ruRole(u)}</div>
                    <div><span className="text-neutral-500">Классное руководство:</span> {u.classroom || "—"}</div>
                    <div><span className="text-neutral-500">Telegram:</span> {u.telegram || "—"}</div>
                    <div><span className="text-neutral-500">Дата рождения:</span> {u.birthday ? new Date(u.birthday).toLocaleDateString() : "—"}</div>
                  </div>
                  <div>
                    <div><span className="text-neutral-500">Предметы:</span> {u.subjects?.length ? u.subjects.join(", ") : "—"}</div>
                    <div><span className="text-neutral-500">Методические объединения:</span> {u.methodicalGroups?.length ? u.methodicalGroups.join(", ") : "—"}</div>
                    <div><span className="text-neutral-500">О себе:</span> {u.about || "—"}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && (
          <div className="p-6 text-neutral-500">Ничего не найдено</div>
        )}
      </div>

      {addOpen && <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={load}
          allowRoleChange={canEdit}
        />
      )}

      {delOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setDelOpen(false)}>
          <div className="card w-[520px] max-w-[94vw] p-4 relative" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost absolute right-2 top-2" onClick={() => setDelOpen(false)}>×</button>
            <h3 className="text-lg font-medium mb-3">Удалить пользователя</h3>
            <select value={delId} onChange={(e) => setDelId(e.target.value)} className="input w-full mb-3">
              <option value="">— выберите —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {ruRole(u)}</option>)}
            </select>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={doDelete} disabled={!delId || !canDelete}>Удалить</button>
              <button className="btn" onClick={() => setDelOpen(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
