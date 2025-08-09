"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { SUBJECTS_2025_RU, METHODICAL_GROUPS_108, FALLBACK_ROLES } from "@/lib/edu";

type Role = { id?: string; name: string; slug: string; power?: number };
type UserRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  birthday?: string | null;
  classroom?: string | null;
  subjects?: string[] | null;
  methodicalGroups?: string[] | null;
  roles?: { name: string; slug: string }[];
};

export default function TeachersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const editUser = useMemo(() => rows.find((u) => u.id === editId) || null, [rows, editId]);

  const loadRoles = async () => {
    try {
      const r = await fetch("/api/roles", { cache: "no-store" });
      const data = r.ok ? await r.json() : [];
      setRoles(Array.isArray(data) ? data : (data?.items ?? FALLBACK_ROLES as any));
    } catch {
      setRoles(FALLBACK_ROLES as any);
    }
  };

  const loadUsers = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setRows(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      setErr("Не удалось получить список пользователей");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMe = async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const me = await r.json();
      if (me?.error === "NO_USER") { setCanEdit(false); return; }

      const rolesArr: { name?: string; slug?: string }[] = Array.isArray(me?.roles) ? me.roles : [];
      const roleText: string = (me?.role ?? "") as string;

      const bySlug = rolesArr.some(x => x?.slug === "director" || x?.slug === "deputy_plus");
      const byName = rolesArr.some(x => x?.name === "Директор" || x?.name === "Заместитель +");
      const bySingleText = /директор|заместитель\s*\+?/i.test(roleText || "");
      const byRoot = Boolean(me?.isRoot || me?.root);
      const byPower = typeof me?.power === "number" && me.power >= 90;

      setCanEdit(bySlug || byName || bySingleText || byRoot || byPower);
    } catch { setCanEdit(false); }
  };

  useEffect(() => { loadRoles(); loadMe(); }, []);
  useEffect(() => { loadUsers(); }, [q]);

  const onAdded = () => { setShowAdd(false); loadUsers(); };
  const onSaved = () => { setEditId(null); loadUsers(); };

  const tdBorderTop = { borderTop: "1px solid #e2e8f0" };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Добавить пользователя</button>
        <input
          className="input flex-1"
          placeholder="Поиск: ФИО, роль, телефон, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ border: "1px solid #e5e7eb" }}
        />
        <button className="btn" onClick={loadUsers}>Обновить</button>
      </div>

      {err && <div className="alert alert-error mb-4">{err}</div>}

      <div className="card overflow-x-auto">
        <table className="table w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Роль</th>
              <th>Дата рождения</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-neutral-500">Ничего не найдено</td></tr>
            )}
            {rows.map((u: UserRow, idx: number) => {
              const cellStyle = idx === 0 ? undefined : tdBorderTop;
              return (
                <tr key={u.id}>
                  <td style={cellStyle}>
                    <div style={{ textAlign: "left" }}>{u.name}</div>
                    <div style={{ textAlign: "center", fontSize: 12, marginTop: 4, color: "#16a34a" }}>online</div>
                  </td>
                  <td style={cellStyle}>{u.email || "—"}</td>
                  <td style={cellStyle}>{u.phone || "—"}</td>
                  <td style={cellStyle}>{u.role || (Array.isArray(u.roles) && u.roles[0]?.name) || "—"}</td>
                  <td style={cellStyle}>
                    {u.birthday
                      ? new Date(u.birthday).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td style={cellStyle}>
                    {canEdit && (
                      <button className="btn btn-primary" onClick={() => setEditId(u.id)} title="Редактировать">
                        Редактировать
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Добавить пользователя">
        <UserForm mode="create" roles={roles} onSuccess={onAdded} />
      </Modal>

      <Modal open={!!editId} onClose={() => setEditId(null)} title="Редактировать пользователя">
        {editId ? (
          <UserForm mode="edit" roles={roles} userId={editId} onSuccess={onSaved} />
        ) : (
          <div className="py-8 text-center text-neutral-500">Загрузка…</div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- форма ---------- */
function fmtDateInput(value?: string | null): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch { return ""; }
}

function CheckboxGroup({
  options, value, onChange, columns = 2,
}: { options: string[]; value: string[]; onChange: (next: string[]) => void; columns?: number; }) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
  }
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2">
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function UserForm({ mode, roles, userId, onSuccess }: {
  mode: "create" | "edit"; roles: Role[]; userId?: string; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [classroom, setClassroom] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !userId) return;
    let aborted = false;
    (async () => {
      try {
        const r = await fetch(`/api/users/${userId}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const u = await r.json();
        if (aborted) return;

        setName(u.name ?? "");
        setEmail(u.email ?? "");
        setPhone(u.phone ?? "");
        setBirthday(fmtDateInput(u.birthday ?? null));
        setClassroom(u.classroom ?? "");
        setSubjects(Array.isArray(u.subjects) ? u.subjects : []);
        setGroups(Array.isArray(u.methodicalGroups) ? u.methodicalGroups : []);

        const firstSlug = Array.isArray(u.roles) && u.roles.length ? (u.roles[0]?.slug as string) : "";
        setRoleSlug(firstSlug || "");
      } catch { setErr("Не удалось загрузить пользователя"); }
    })();
    return () => { aborted = true; };
  }, [mode, userId]);

  useEffect(() => {
    if (roleSlug || roles.length === 0) return;
    const teacher = roles.find((r) => r.slug.toLowerCase().includes("teacher")) || roles.find((r) => r.name.toLowerCase().includes("педагог"));
    setRoleSlug((teacher ?? roles[roles.length - 1]).slug);
  }, [roles, roleSlug]);

  const canSubmit =
    name.trim() && email.trim() && phone.trim() && roleSlug.trim() && birthday.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true); setErr(null);

    try {
      const bdayISO = new Date(birthday + "T00:00:00").toISOString();
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        roleSlug,
        birthday: bdayISO,
        classroom: classroom || undefined,
        subjects,
        methodicalGroups: groups,
      };

      const url = mode === "edit" ? `/api/users/${userId}` : "/api/users";
      const method = mode === "edit" ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.error === "ROLE_NOT_FOUND") throw new Error("Роль не найдена");
        if (j?.error === "UNIQUE_CONSTRAINT") throw new Error("Email или телефон уже используются");
        throw new Error("Ошибка сохранения");
      }
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "Не удалось сохранить");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <div className="alert alert-error">{err}</div>}

      <div className="form-control">
        <label className="label">ФИО</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Иванович" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="name@example.com" />
        </div>
        <div className="form-control">
          <label className="label">Телефон</label>
          <input className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7XXXXXXXXXX" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label">Дата рождения</label>
          <input className="input" type="date" required value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label">Роль</label>
          <select className="select" required value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)}>
            {roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-control">
        <label className="label">Классное руководство (необязательно)</label>
        <input className="input" value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="например, 9Б" />
      </div>

      <div className="form-control">
        <label className="label">Предметы (множественный выбор)</label>
        <CheckboxGroup options={SUBJECTS_2025_RU} value={subjects} onChange={setSubjects} columns={2} />
      </div>

      <div className="form-control">
        <label className="label">Группы (МО) — множественный выбор</label>
        <CheckboxGroup options={METHODICAL_GROUPS_108} value={groups} onChange={setGroups} columns={2} />
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn btn-primary" disabled={!canSubmit || saving}>
          {saving ? "Сохранение…" : mode === "edit" ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </form>
  );
}
