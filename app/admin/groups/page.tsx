// app/admin/groups/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type SimpleUser = { id: string; name: string | null; role?: string | null };
type Group = { id: string; name: string };
type MemberDetail = { userId: string; name: string | null };

type Subject = { name: string; count: number };
type SubjectMember = { userId: string; name: string | null };

const BRAND = "#8d2828";

function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  width?: number;
}) {
  if (!props.open) return null;
  return (
    <div
      onClick={props.onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: props.width ?? 420, maxWidth: "94vw", padding: 16 }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{props.title}</div>
        <div>{props.children}</div>
        {props.actions && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            {props.actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminGroupsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role?.toLowerCase?.() ?? "";
  const allowed = role === "director" || role === "deputy_plus";

  const [tab, setTab] = useState<"groups" | "subjects">("groups");

  // общие
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [searchUser, setSearchUser] = useState("");

  // группы
  const [groups, setGroups] = useState<Group[]>([]);
  const [selUserIds, setSelUserIds] = useState<string[]>([]);
  const [selGroupId, setSelGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberDetail[]>([]);
  const [searchGroup, setSearchGroup] = useState("");

  // модалки групп
  const [mCreateGroup, setMCreateGroup] = useState(false);
  const [mRenameGroup, setMRenameGroup] = useState(false);
  const [mDeleteGroup, setMDeleteGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");

  // предметы
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selSubject, setSelSubject] = useState<string | null>(null);
  const [subjectMembers, setSubjectMembers] = useState<SubjectMember[]>([]);
  const [searchSubject, setSearchSubject] = useState("");

  // модалки предметов
  const [mCreateSubject, setMCreateSubject] = useState(false);
  const [mRenameSubject, setMRenameSubject] = useState(false);
  const [mDeleteSubject, setMDeleteSubject] = useState(false);
  const [subjectNameInput, setSubjectNameInput] = useState("");

  // LOADERS
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
  async function loadSubjects() {
    const r = await fetch("/api/subjects", { cache: "no-store" });
    if (r.ok) setSubjects(await r.json());
  }
  async function loadSubjectMembers(name: string | null) {
    if (!name) { setSubjectMembers([]); return; }
    const r = await fetch(`/api/subjects/${encodeURIComponent(name)}/members?details=1`, { cache: "no-store" });
    if (r.ok) setSubjectMembers(await r.json());
  }

  useEffect(() => {
    if (status !== "authenticated" || !allowed) return;
    loadUsers();
    loadGroups();
    loadSubjects();
  }, [status, allowed]);

  useEffect(() => { loadMembers(selGroupId); }, [selGroupId]);
  useEffect(() => { loadSubjectMembers(selSubject); }, [selSubject]);

  // FILTERS
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

  const filteredSubjects = useMemo(() => {
    const s = searchSubject.trim().toLowerCase();
    const list = s ? subjects.filter(x => x.name.toLowerCase().includes(s)) : subjects;
    return list;
  }, [subjects, searchSubject]);

  // COMMON helpers
  function toggleUser(id: string) {
    setSelUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function resetUserSelection() { setSelUserIds([]); }

  // GROUP ACTIONS
  async function addSelectedToGroup() {
    if (!selGroupId || selUserIds.length === 0) return;
    const ids = [...selUserIds];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
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

  // group modals handlers
  function openCreateGroup() {
    setGroupNameInput("");
    setMCreateGroup(true);
  }
  async function doCreateGroup() {
    const name = groupNameInput.trim();
    if (!name) return;
    const r = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) { alert("Не удалось создать группу"); return; }
    setMCreateGroup(false);
    await loadGroups();
  }

  function openRenameGroup() {
    if (!selGroupId) return;
    const current = groups.find(g => g.id === selGroupId)?.name || "";
    setGroupNameInput(current);
    setMRenameGroup(true);
  }
  async function doRenameGroup() {
    if (!selGroupId) return;
    const name = groupNameInput.trim();
    if (!name) return;
    const r = await fetch(`/api/groups/${selGroupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) { alert("Не удалось переименовать группу"); return; }
    setMRenameGroup(false);
    await loadGroups();
  }

  function openDeleteGroup() {
    if (!selGroupId) return;
    setMDeleteGroup(true);
  }
  async function doDeleteGroup() {
    if (!selGroupId) return;
    const r = await fetch(`/api/groups/${selGroupId}`, { method: "DELETE" });
    if (!r.ok) { alert("Не удалось удалить группу"); return; }
    setMDeleteGroup(false);
    setSelGroupId(null);
    setMembers([]);
    await loadGroups();
  }

  // SUBJECT ACTIONS
  async function addSelectedToSubject() {
    if (!selSubject || selUserIds.length === 0) return;
    const ids = [...selUserIds];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await fetch(`/api/subjects/${encodeURIComponent(selSubject)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
    }
    setSelUserIds([]);
    await loadSubjectMembers(selSubject);
    await loadSubjects();
  }
  async function removeSubjectMember(userId: string) {
    if (!selSubject) return;
    await fetch(`/api/subjects/${encodeURIComponent(selSubject)}/members?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    await loadSubjectMembers(selSubject);
    await loadSubjects();
  }

  function openCreateSubject() {
    setSubjectNameInput("");
    setMCreateSubject(true);
  }
  async function doCreateSubject() {
    const name = subjectNameInput.trim();
    if (!name) return;
    const r = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, userIds: [] }),
    });
    if (!r.ok) { alert("Не удалось создать предмет"); return; }
    setMCreateSubject(false);
    await loadSubjects();
  }

  function openRenameSubject() {
    if (!selSubject) return;
    setSubjectNameInput(selSubject);
    setMRenameSubject(true);
  }
  async function doRenameSubject() {
    if (!selSubject) return;
    const name = subjectNameInput.trim();
    if (!name) return;
    const r = await fetch(`/api/subjects/${encodeURIComponent(selSubject)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) { alert("Не удалось переименовать предмет"); return; }
    setMRenameSubject(false);
    setSelSubject(name);
    await loadSubjects();
    await loadSubjectMembers(name);
  }

  function openDeleteSubject() {
    if (!selSubject) return;
    setMDeleteSubject(true);
  }
  async function doDeleteSubject() {
    if (!selSubject) return;
    const r = await fetch(`/api/subjects/${encodeURIComponent(selSubject)}`, { method: "DELETE" });
    if (!r.ok) { alert("Не удалось удалить предмет"); return; }
    setMDeleteSubject(false);
    setSelSubject(null);
    setSubjectMembers([]);
    await loadSubjects();
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16, fontFamily: '"Times New Roman", serif' }}>Нужна авторизация.</section>;
  }
  if (!allowed) {
    return <section style={{ padding: 16, fontFamily: '"Times New Roman", serif' }}>Доступ только для ролей «директор» и «заместитель +».</section>;
  }

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      {/* Tabs */}
      <div className="card" style={{ padding: 8, marginBottom: 12, display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setTab("groups")}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: tab === "groups" ? "1px solid #e5e7eb" : "1px solid transparent",
            background: tab === "groups" ? "#f9fafb" : "transparent",
            cursor: "pointer",
            fontWeight: 800
          }}
        >
          Группы
        </button>
        <button
          type="button"
          onClick={() => setTab("subjects")}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: tab === "subjects" ? "1px solid #e5e7eb" : "1px solid transparent",
            background: tab === "subjects" ? "#f9fafb" : "transparent",
            cursor: "pointer",
            fontWeight: 800
          }}
        >
          Предметы
        </button>
      </div>

      {tab === "groups" && (
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
                onClick={resetUserSelection}
                style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
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
                  onClick={openCreateGroup}
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
                      onClick={openRenameGroup}
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
                      onClick={openDeleteGroup}
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
      )}

      {tab === "subjects" && (
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
                onClick={addSelectedToSubject}
                disabled={!selSubject || selUserIds.length === 0}
                style={{
                  height: 32, padding: "0 12px", borderRadius: 10,
                  border: `1px solid ${BRAND}`, background: BRAND, color: "#fff",
                  cursor: selSubject && selUserIds.length ? "pointer" : "not-allowed"
                }}
                title={selSubject ? "Назначить выбранным предмет" : "Сначала выберите предмет справа"}
              >
                Назначить предмет
              </button>
              <button
                type="button"
                onClick={resetUserSelection}
                style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
              >
                Сбросить выбор
              </button>
            </div>
          </div>

          {/* Предметы */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Предметы</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={openCreateSubject}
                  style={{ height: 28, padding: "0 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                >
                  Создать предмет
                </button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <input
                value={searchSubject}
                onChange={e => setSearchSubject(e.target.value)}
                placeholder="Поиск предмета"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
              {/* список предметов */}
              <div style={{ height: 420, overflow: "auto", border: "1px solid #f3f4f6", borderRadius: 10 }}>
                {filteredSubjects.map(s => {
                  const active = selSubject === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setSelSubject(s.name)}
                      style={{
                        display: "block", width: "100%", textAlign: "left", padding: "8px 10px",
                        border: "none", background: active ? "#fff5f5" : "transparent",
                        borderBottom: "1px solid #f3f4f6", cursor: "pointer"
                      }}
                      title={`${s.count} чел.`}
                    >
                      <span style={{ fontWeight: 700 }}>{s.name}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280" }}>{s.count}</span>
                      {active && <span style={{ marginLeft: 8, fontSize: 11, color: BRAND }}>выбран</span>}
                    </button>
                  );
                })}
              </div>

              {/* состав выбранного предмета */}
              <div className="card" style={{ padding: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>Состав предмета</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={openRenameSubject}
                      disabled={!selSubject}
                      style={{
                        height: 28, padding: "0 10px", borderRadius: 8,
                        border: "1px solid #e5e7eb", background: "#fff",
                        cursor: selSubject ? "pointer" : "not-allowed"
                      }}
                    >
                      Переименовать
                    </button>
                    <button
                      type="button"
                      onClick={openDeleteSubject}
                      disabled={!selSubject}
                      style={{
                        height: 28, padding: "0 10px", borderRadius: 8,
                        border: `1px solid ${BRAND}`, background: BRAND, color: "#fff",
                        cursor: selSubject ? "pointer" : "not-allowed"
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {!selSubject && <div style={{ padding: 8, color: "#6b7280" }}>Выберите предмет слева.</div>}

                {selSubject && (
                  <div style={{ marginTop: 8, height: 380, overflow: "auto", border: "1px solid #f3f4f6", borderRadius: 10 }}>
                    {subjectMembers.length === 0 && <div style={{ padding: 8, color: "#6b7280" }}>К предмету пока не привязаны преподаватели.</div>}
                    {subjectMembers.map(m => (
                      <div key={m.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid #f3f4f6" }}>
                        <div>{m.name || m.userId}</div>
                        <button
                          type="button"
                          onClick={() => removeSubjectMember(m.userId)}
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
      )}

      {/* MODALS: GROUPS */}
      <Modal
        open={mCreateGroup}
        onClose={() => setMCreateGroup(false)}
        title="Создать группу"
        actions={
          <>
            <button onClick={() => setMCreateGroup(false)} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Отмена</button>
            <button onClick={doCreateGroup} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff" }}>Создать</button>
          </>
        }
      >
        <input
          value={groupNameInput}
          onChange={(e) => setGroupNameInput(e.target.value)}
          placeholder="Название группы"
          autoFocus
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
        />
      </Modal>

      <Modal
        open={mRenameGroup}
        onClose={() => setMRenameGroup(false)}
        title="Переименовать группу"
        actions={
          <>
            <button onClick={() => setMRenameGroup(false)} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Отмена</button>
            <button onClick={doRenameGroup} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff" }}>Сохранить</button>
          </>
        }
      >
        <input
          value={groupNameInput}
          onChange={(e) => setGroupNameInput(e.target.value)}
          placeholder="Новое название"
          autoFocus
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
        />
      </Modal>

      <Modal
        open={mDeleteGroup}
        onClose={() => setMDeleteGroup(false)}
        title="Удалить группу"
        actions={
          <>
            <button onClick={() => setMDeleteGroup(false)} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Отмена</button>
            <button onClick={doDeleteGroup} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff" }}>Удалить</button>
          </>
        }
      >
        <div style={{ color: "#6b7280" }}>Группа будет удалена. Участники из БД не удаляются.</div>
      </Modal>

      {/* MODALS: SUBJECTS */}
      <Modal
        open={mCreateSubject}
        onClose={() => setMCreateSubject(false)}
        title="Создать предмет"
        actions={
          <>
            <button onClick={() => setMCreateSubject(false)} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Отмена</button>
            <button onClick={doCreateSubject} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff" }}>Создать</button>
          </>
        }
      >
        <input
          value={subjectNameInput}
          onChange={(e) => setSubjectNameInput(e.target.value)}
          placeholder="Название предмета"
          autoFocus
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
        />
      </Modal>

      <Modal
        open={mRenameSubject}
        onClose={() => setMRenameSubject(false)}
        title="Переименовать предмет"
        actions={
          <>
            <button onClick={() => setMRenameSubject(false)} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Отмена</button>
            <button onClick={doRenameSubject} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff" }}>Сохранить</button>
          </>
        }
      >
        <input
          value={subjectNameInput}
          onChange={(e) => setSubjectNameInput(e.target.value)}
          placeholder="Новое название предмета"
          autoFocus
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10 }}
        />
      </Modal>

      <Modal
        open={mDeleteSubject}
        onClose={() => setMDeleteSubject(false)}
        title="Удалить предмет"
        actions={
          <>
            <button onClick={() => setMDeleteSubject(false)} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>Отмена</button>
            <button onClick={doDeleteSubject} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff" }}>Удалить</button>
          </>
        }
      >
        <div style={{ color: "#6b7280" }}>Предмет будет удалён у всех пользователей.</div>
      </Modal>

      <style jsx>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
      `}</style>
    </section>
  );
}
