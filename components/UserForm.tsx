"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SUBJECTS_2025_RU, METHODICAL_GROUPS_108 } from "@/lib/edu";

type RoleDTO = { id: string; name: string; slug: string; power?: number };
type UserDTO = {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roleSlug?: string;
  roles?: { slug: string; name: string }[];
  classroom?: string | null;
  subjects?: string[];
  methodicalGroups?: string[];
  telegram?: string | null;
  avatarUrl?: string | null;
  about?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  birthday?: string | null; // ISO "YYYY-MM-DD"
};

const FALLBACK_ROLES: RoleDTO[] = [
  { id: "r1", slug: "director",     name: "Директор",      power: 5 },
  { id: "r2", slug: "deputy_plus",  name: "Заместитель +", power: 4 },
  { id: "r3", slug: "deputy",       name: "Заместитель",   power: 3 },
  { id: "r4", slug: "teacher_plus", name: "Педагог +",     power: 2 },
  { id: "r5", slug: "teacher",      name: "Педагог",       power: 1 },
];

function MultiSelectList({ options, value, onChange, columns = 2 }:{
  options: string[]; value: string[]; onChange: (v: string[]) => void; columns?: 1|2|3;
}) {
  const set = new Set(value);
  return (
    <div className="rounded border p-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns},1fr)`, maxHeight: 240, overflow: "auto" }}>
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center gap-2">
          <input type="checkbox" checked={set.has(opt)} onChange={() => {
            const next = new Set(value);
            next.has(opt) ? next.delete(opt) : next.add(opt);
            onChange([...next]);
          }} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

export default function UserForm({
  mode = "create",
  initialValues,
  onSuccess,
  allowRoleChange = true,
}: {
  mode?: "create" | "edit";
  initialValues?: Partial<UserDTO>;
  onSuccess?: () => void;
  allowRoleChange?: boolean;
}) {
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [roleSlug, setRoleSlug] = useState(initialValues?.roleSlug ?? "");
  const [classroom, setClassroom] = useState(initialValues?.classroom ?? "");
  const [subjects, setSubjects] = useState<string[]>(initialValues?.subjects ?? []);
  const [groups, setGroups] = useState<string[]>(initialValues?.methodicalGroups ?? []);
  const [telegram, setTelegram] = useState(initialValues?.telegram ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialValues?.avatarUrl ?? "");
  const [about, setAbout] = useState(initialValues?.about ?? "");
  const [notifyEmail, setNotifyEmail] = useState<boolean>(initialValues?.notifyEmail ?? true);
  const [notifyTelegram, setNotifyTelegram] = useState<boolean>(initialValues?.notifyTelegram ?? false);
  const [birthday, setBirthday] = useState<string>(() => {
    const b = initialValues?.birthday;
    if (!b) return "";
    // поддержка ISO/Date: приводим к YYYY-MM-DD
    try { return new Date(b).toISOString().slice(0,10); } catch { return ""; }
  });

  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState(mode === "create" ? "test-password" : "");
  const [showPass, setShowPass] = useState(mode === "create");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch("/api/roles", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        let list: any[] = Array.isArray(j) ? j : (Array.isArray(j?.roles) ? j.roles : []);
        if (!Array.isArray(list)) list = [];
        const norm: RoleDTO[] = list.map((x: any, i: number) => ({
          id: x.id ?? String(i),
          name: x.name ?? x.title ?? x.slug,
          slug: x.slug ?? x.code ?? x.name,
          power: typeof x.power === "number" ? x.power : undefined,
        }));
        if (!aborted) setRoles(norm.length ? norm : FALLBACK_ROLES);
      } catch { if (!aborted) setRoles(FALLBACK_ROLES); }
    })();
    return () => { aborted = true; };
  }, []);

  useEffect(() => {
    if (!initialValues) return;
    setName(initialValues.name ?? "");
    setEmail(initialValues.email ?? "");
    setPhone(initialValues.phone ?? "");
    setRoleSlug(initialValues.roleSlug ?? initialValues.roles?.[0]?.slug ?? "");
    setClassroom(initialValues.classroom ?? "");
    setSubjects(initialValues.subjects ?? []);
    setGroups(initialValues.methodicalGroups ?? []);
    setTelegram(initialValues.telegram ?? "");
    setAvatarUrl(initialValues.avatarUrl ?? "");
    setAbout(initialValues.about ?? "");
    setNotifyEmail(initialValues.notifyEmail ?? true);
    setNotifyTelegram(initialValues.notifyTelegram ?? false);
    const b = initialValues.birthday;
    setBirthday(b ? new Date(b).toISOString().slice(0,10) : "");
    if (mode === "edit") { setPassword(""); setShowPass(false); }
  }, [JSON.stringify(initialValues), mode]);

  useEffect(() => {
    if (roleSlug || roles.length === 0) return;
    const byName =
      roles.find((r) => r.slug?.toLowerCase().includes("teacher")) ||
      roles.find((r) => (r.name || "").toLowerCase().includes("педагог"));
    if (byName) { setRoleSlug(byName.slug); return; }
    const min = [...roles].sort((a, b) => (a.power ?? 99) - (b.power ?? 99))[0];
    if (min) setRoleSlug(min.slug);
  }, [roles, roleSlug]);

  const canSubmit = useMemo(() => !!name.trim() && !!roleSlug && !loading, [name, roleSlug, loading]);

  async function save(payload: any, id?: string) {
    if (id) {
      let res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await fetch(`/api/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      return res;
    }
    return fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError("");

    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        roleSlug,
        role: roleSlug,
        classroom: classroom || undefined,
        subjects,
        methodicalGroups: groups,
        groups,
        telegram: telegram || undefined,
        avatarUrl: avatarUrl || undefined,
        about: about || undefined,
        notifyEmail,
        notifyTelegram,
        birthday: birthday ? new Date(birthday).toISOString() : null,
      };

      if (mode === "create") {
        payload.password = password || "test-password";
      } else if (password.trim() && initialValues?.id) {
        payload.password = password.trim();
      }

      const res = await save(payload, initialValues?.id);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.message || j?.error || "Ошибка сохранения");
        return;
      }

      onSuccess?.();
      if (mode === "create") {
        setName(""); setEmail(""); setPhone(""); setRoleSlug("");
        setClassroom(""); setSubjects([]); setGroups([]);
        setTelegram(""); setAvatarUrl(""); setAbout("");
        setNotifyEmail(true); setNotifyTelegram(false);
        setPassword("test-password"); setShowPass(true);
        setBirthday("");
      }
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div>
        <label className="block mb-1">ФИО*</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Иванович" required />
      </div>

      <div>
        <label className="block mb-1">Email (необязательно)</label>
        <input
          type="email"
          autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" name="offEmail" inputMode="email"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivanov@pochta.ru"
        />
      </div>

      <div>
        <label className="block mb-1">Телефон (необязательно)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="+7XXXXXXXXXX" />
      </div>

      <div>
        <label className="block mb-1">Дата рождения</label>
        <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      </div>

      <div>
        <label className="block mb-1">Роль*</label>
        <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} disabled={!allowRoleChange}>
          <option value="">— выберите роль —</option>
          {roles.map((r) => (<option key={r.id} value={r.slug}>{r.name}</option>))}
        </select>
      </div>

      <div>
        <label className="block mb-1">
          Пароль {mode === "edit" && <span className="text-xs opacity-70">(оставьте пустым, чтобы не менять)</span>}
        </label>
        <div className="flex items-center gap-2">
          <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                 placeholder={mode === "create" ? "test-password" : "Новый пароль"} style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={() => setShowPass((v) => !v)}>{showPass ? "Скрыть" : "Показать"}</button>
        </div>
      </div>

      <div>
        <label className="block mb-1">Классное руководство (например, 9Б)</label>
        <input value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="9Б" />
      </div>

      <div>
        <label className="block mb-1">Предметы</label>
        <MultiSelectList options={SUBJECTS_2025_RU} value={subjects} onChange={setSubjects} columns={2} />
      </div>

      <div>
        <label className="block mb-1">Группы пользователей (МО)</label>
        <MultiSelectList options={METHODICAL_GROUPS_108} value={groups} onChange={setGroups} columns={2} />
      </div>

      <div>
        <label className="block mb-1">Telegram</label>
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
      </div>

      <div>
        <label className="block mb-1">Ссылка на фото (аватар)</label>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
      </div>

      <div>
        <label className="block mb-1">О себе</label>
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} placeholder="Кратко о себе" />
      </div>

      <div className="flex items-center gap-6">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
          <span>Уведомления на email</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={notifyTelegram} onChange={(e) => setNotifyTelegram(e.target.checked)} />
          <span>Уведомления в Telegram</span>
        </label>
      </div>

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        {loading ? "Сохранение…" : mode === "edit" ? "Сохранить" : "Добавить"}
      </button>
    </form>
  );
}
