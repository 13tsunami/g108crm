// app/admin/groups/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type SimpleUser = { id: string; name: string | null; role?: string | null };
type Group = { id: string; name: string };
type MemberDetail = { userId: string; name: string | null };

const BRAND = "#8d2828";

export default function AdminGroupsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role?.toLowerCase?.() ?? "";
  const allowed = role === "director" || role === "deputy_plus";

  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selUserIds, setSelUserIds] = useState<string[]>([]);
  const [selGroupId, setSelGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberDetail[]>([]);
  const [searchUser, setSearchUser] = useState("");
  const [searchGroup, setSearchGroup] = useState("");

  async function loadUsers() {
    const r = await fetch("/api/chat/users?includeSelf=1&limit=5000", { cache: "no-store" });
    if (r.ok) setUsers(await r.json());
  }
  async function loadGroups() {
    const r = await fetch("/api/groups?limit=5000", { cache: "no-store" });
    if (r.ok) setGroups(await r.json());
  }
  async function loadMembers(gid: string | null) {
    if (!gid) { setMembers([]); return; }
    const r = await fetch(`/api/groups/${gid}/members?details=1`, { cache: "no-store" });
    if (r.ok) setMembers(await r.json());
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!allowed) return;
    loadUsers(); loadGroups();
  }, [status, allowed]);

  useEffect(() => { loadMembers(selGroupId); }, [selGroupId]);

  const filteredUsers = useMemo(() => {
    const s = searchUser.trim().toLowerCase();
    const list = s ? users.filter(u => (u.name || "").toLowerCase().includes(s)) : users;
    return list;
  }, [users, searchUser]);

  const filteredGroups = useMemo(() => {
    const s = searchGroup.trim().toLowerCase();
    const list = s ? groups.filter(g => g.name.toLowerCase().includes(s)) : groups;
    return list;
  }, [groups, searchGroup]);

  function toggleUser(id: string) {
    setSelUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function addSelectedToGroup() {
    if (!selGroupId || selUserIds.length === 0) return;
    const ids = [...selUserIds];
    for (const id of ids) {
      await fetch(`/api/groups/${selGroupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
    }
    setSelUserIds([]);
    await loadMembers(selGroupId);
  }

  async function removeMember(userId: string) {
    if (!selGroupId) return;
    await fetch(`/api/groups/${selGroupId}/members?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    await loadMembers(selGroupId);
  }

  async function createGroup() {
    const name = prompt("Название новой группы:");
    if (!name) return;
    const r = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) { alert("Не удалось создать группу"); return; }
    await loadGroups();
  }

  async function renameGroup() {
    if (!selGroupId) return;
    const current = groups.find(g => g.id === selGroupId)?.name || "";
    const name = prompt("Новое название группы:", current);
    if (!name) return;
    const r = await fetch(`/api/groups/${selGroupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) { alert("Не удалось переименовать группу"); return; }
    await loadGroups();
  }

  async function deleteGroup() {
    if (!selGroupId) return;
    if (!confirm("Удалить группу целиком? Участники из БД не удаляются.")) return;
    const r = await fetch(`/api/groups/${selGroupId}`, { method: "DELETE" });
    if (!r.ok) { alert("Не удалось удалить группу"); return; }
    setSelGroupId(null);
    setMembers([]);
    await loadGroups();
  }

  async function importFromEdu() {
    if (!confirm("Импортировать группы из lib/edu.ts (режим sync)? Текущие составы будут приведены к данным из файла.")) return;
    const r = await fetch("/api/admin/sync-groups?mode=sync", { method: "POST" });
    if (!r.ok) { alert("Импорт завершился ошибкой"); return; }
    await loadGroups();
    if (selGroupId) await loadMembers(selGroupId);
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16, fontFamily: '"Times New Roman", serif' }}>Нужна авторизация.</section>;
  }
  if (!allowed) {
    return <section style={{ padding: 16, fontFamily: '"Times New Roman", serif' }}>Доступ только для ролей «директор» и «заместитель +».</section>;
  }

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Пользователи */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Пользователи</div>
            <div style={{ color: "#6b7280" }}>{filteredUsers.length}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              placeholder="Поиск ФИО"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
          </div>

          <div style={{ marginTop: 8, height: 460, overflow: "auto", border: "1px solid #f3f4f6", borderRadius: 10 }}>
            {filteredUsers.map(u => {
              const active = selUserIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className="rowbtn"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    background: active ? "#fff5f5" : "transparent",
                    borderBottom: "1px solid #f3f4f6",
                    cursor: "pointer"
                  }}
                  title={u.role || undefined}
                >
                  <span style={{ fontWeight: 600, color: "#111827" }}>{u.name || u.id}</span>
                  {active && <span style={{ marginLeft: 8, fontSize: 11, color: BRAND }}>выбран</span>}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={addSelectedToGroup}
              disabled={!selGroupId || selUserIds.length === 0}
              style={{
                height: 32, padding: "0 12px", borderRadius: 10,
                border: `1px solid ${BRAND}`, background: BRAND, color: "#fff",
                cursor: selGroupId && selUserIds.length ? "pointer" : "not-allowed"
              }}
              title={selGroupId ? "Добавить выбранных в группу" : "Сначала выберите группу справа"}
            >
              Добавить в группу
            </button>
            <button
              type="button"
              onClick={() => setSelUserIds([])}
              style={{
                height: 32, padding: "0 12px", borderRadius: 10,
                border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer"
              }}
            >
              Сбросить выбор
            </button>
          </div>
        </div>

        {/* Группы */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Группы</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={importFromEdu}
                style={{ height: 28, padding: "0 10px", borderRadius: 8, border: "1px dashed #c4c4c4", background: "#fff", cursor: "pointer" }}
                title="Привести составы к lib/edu.ts"
              >
                Импорт из lib/edu.ts
              </button>
              <button
                type="button"
                onClick={createGroup}
                style={{ height: 28, padding: "0 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
              >
                Создать группу
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <input
              value={searchGroup}
              onChange={e => setSearchGroup(e.target.value)}
              placeholder="Поиск группы"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            {/* список групп */}
            <div style={{ height: 420, overflow: "auto", border: "1px solid #f3f4f6", borderRadius: 10 }}>
              {filteredGroups.map(g => {
                const active = selGroupId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelGroupId(g.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 10px",
                      border: "none", background: active ? "#fff5f5" : "transparent",
                      borderBottom: "1px solid #f3f4f6", cursor: "pointer"
                    }}
                    title={g.id}
                  >
                    <span style={{ fontWeight: 700 }}>{g.name}</span>
                    {active && <span style={{ marginLeft: 8, fontSize: 11, color: BRAND }}>выбрана</span>}
                  </button>
                );
              })}
            </div>

            {/* состав выбранной группы */}
            <div className="card" style={{ padding: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>Состав группы</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={renameGroup}
                    disabled={!selGroupId}
                    style={{
                      height: 28, padding: "0 10px", borderRadius: 8,
                      border: "1px solid #e5e7eb", background: "#fff",
                      cursor: selGroupId ? "pointer" : "not-allowed"
                    }}
                  >
                    Переименовать
                  </button>
                  <button
                    type="button"
                    onClick={deleteGroup}
                    disabled={!selGroupId}
                    style={{
                      height: 28, padding: "0 10px", borderRadius: 8,
                      border: `1px solid ${BRAND}`, background: BRAND, color: "#fff",
                      cursor: selGroupId ? "pointer" : "not-allowed"
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>

              {!selGroupId && <div style={{ padding: 8, color: "#6b7280" }}>Выберите группу слева.</div>}

              {selGroupId && (
                <div style={{ marginTop: 8, height: 380, overflow: "auto", border: "1px solid #f3f4f6", borderRadius: 10 }}>
                  {members.length === 0 && <div style={{ padding: 8, color: "#6b7280" }}>В группе пока нет участников.</div>}
                  {members.map(m => (
                    <div key={m.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid #f3f4f6" }}>
                      <div>{m.name || m.userId}</div>
                      <button
                        type="button"
                        onClick={() => removeMember(m.userId)}
                        style={{ height: 26, padding: "0 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }
      `}</style>
    </section>
  );
}
