"use client";

import React, { useMemo, useState } from "react";
// Гибкий импорт справочников — возьмём то, что реально экспортирует ваш lib/edu.ts
import * as EDU from "@/lib/edu";

const SUBJECTS: string[] =
  (EDU as any).SUBJECTS_108 ??
  (EDU as any).SUBJECTS_2025_RU ??
  (EDU as any).SUBJECTS_RU ??
  (EDU as any).SUBJECTS ??
  [];

const GROUPS: string[] =
  (EDU as any).METHODICAL_GROUPS_108 ??
  (EDU as any).METHODICAL_GROUPS_RU ??
  (EDU as any).METHODICAL_GROUPS ??
  [];

type Props = {
  mode: "self" | "create" | "edit";
  initialValues: {
    id?: string;
    name: string;
    username?: string;        // логин
    email?: string;
    phone?: string;
    classroom?: string;
    roleSlug?: string;
    birthday?: string | null; // ISO
    telegram?: string;
    avatarUrl?: string;
    about?: string;
    notifyEmail?: boolean;
    notifyTelegram?: boolean;
    subjects?: string[];
    methodicalGroups?: string[];
    password?: string;
  };
  forbid?: ("role" | "classroom" | "password" | "email" | "username")[];
  allowRoleChange?: boolean;
  onSuccess?: () => void;
};

const ROLES = [
  { value: "director", label: "Директор" },
  { value: "deputy_plus", label: "Заместитель +" },
  { value: "deputy", label: "Заместитель" },
  { value: "teacher_plus", label: "Педагог +" },
  { value: "teacher", label: "Педагог" },
];

function isValidEmail(s: string) {
  if (!s) return true;
  return /\S+@\S+\.\S+/.test(s);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium mb-1">{children}</div>;
}

function Chips({ items }: { items: string[] }) {
  if (!items?.length) return <span>—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((x) => (
        <span key={x} className="rounded-full px-2 py-[2px] text-[12px] bg-black/5">
          {x}
        </span>
      ))}
    </div>
  );
}

function CheckboxGrid({
  title, options, values, onChange, disabled,
}: {
  title: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.toLowerCase().includes(s)) : options;
  }, [q, options]);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  };

  const allVisible = filtered.length > 0 && filtered.every((id) => values.includes(id));
  const selectAllVisible = () => onChange([...new Set([...values, ...filtered])]);
  const clearAllVisible = () => onChange(values.filter((v) => !filtered.includes(v)));

  return (
    <div className="border rounded-lg p-3 bg-white/60">
      <div className="flex items-center gap-2 mb-2">
        <SectionLabel>{title}</SectionLabel>
        <div className="text-xs text-neutral-500">({values.length})</div>
        <div className="flex-1" />
        <input
          placeholder="Поиск…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input"
          style={{ height: 32, fontSize: 13, width: 200 }}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn"
          style={{ padding: "4px 8px", fontSize: 13 }}
          onClick={allVisible ? clearAllVisible : selectAllVisible}
          disabled={disabled || filtered.length === 0}
        >
          {allVisible ? "Снять все (видимые)" : "Выбрать все (видимые)"}
        </button>
      </div>

      {values.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-neutral-500 mb-1">Выбрано:</div>
          <Chips items={values} />
        </div>
      )}

      <div className="grid" style={{ gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {filtered.map((id) => {
          const checked = values.includes(id);
          return (
            <label key={id} className={`flex items-center gap-2 rounded-md px-2 py-[6px] cursor-pointer ${checked ? "bg-sky-50 border border-sky-200" : ""}`}>
              <input type="checkbox" className="mt-[1px]" checked={checked} onChange={() => toggle(id)} disabled={disabled} />
              <span className="text-[13px]">{id}</span>
            </label>
          );
        })}
        {filtered.length === 0 && <div className="text-sm text-neutral-500">Ничего не найдено</div>}
      </div>
    </div>
  );
}

export default function UserForm({
  mode, initialValues, forbid = [], allowRoleChange = true, onSuccess,
}: Props) {
  const [v, setV] = useState({
    ...initialValues,
    subjects: initialValues.subjects ?? [],
    methodicalGroups: initialValues.methodicalGroups ?? [],
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isCreate = mode === "create";
  const canChangeRole = allowRoleChange && !forbid.includes("role");
  const canChangeClassroom = !forbid.includes("classroom");
  const canChangeEmail = !forbid.includes("email");
  const canChangeUsername = !forbid.includes("username") && mode !== "self";

  const submitPath = mode === "create" ? "/api/users" : mode === "edit" ? `/api/users/${v.id}` : "/api/profile";
  const method = mode === "create" ? "POST" : "PATCH";

  const canSubmit = useMemo(() => {
    if (!v.name?.trim()) return false;
    if (v.email && !isValidEmail(v.email)) return false;
    if (mode === "create" && canChangeUsername && !v.username?.trim()) return false;
    return !loading;
  }, [v.name, v.email, v.username, loading, mode, canChangeUsername]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErr(null);
    setMsg(null);

    const body: any = {
      name: v.name?.trim(),
      username: canChangeUsername ? (v.username?.trim() || null) : undefined,
      email: v.email?.trim() || null,
      phone: v.phone || null,
      classroom: canChangeClassroom ? v.classroom || null : undefined,
      roleSlug: canChangeRole ? v.roleSlug : undefined,
      birthday: v.birthday || null,
      telegram: v.telegram || null,
      avatarUrl: v.avatarUrl || null,
      about: v.about || null,
      notifyEmail: !!v.notifyEmail,
      notifyTelegram: !!v.notifyTelegram,
      subjects: v.subjects ?? [],
      methodicalGroups: v.methodicalGroups ?? [],
    };
    if (isCreate && v.password) body.password = v.password;

    try {
      const res = await fetch(submitPath, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let j: any = null;
      try { j = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok || j?.error) throw new Error(j?.error || text || `Ошибка ${res.status}`);
      setMsg("Сохранено");
      onSuccess?.();
    } catch (e: any) {
      setErr(e?.message || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {err && <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 text-sm">{err}</div>}
      {msg && <div className="rounded border border-green-300 bg-green-50 text-green-800 p-2 text-sm">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block mb-1">ФИО</label>
          <input value={v.name || ""} onChange={(e) => setV({ ...v, name: e.target.value })} required style={{ height: 36, fontSize: 14 }} />
        </div>

        {canChangeUsername && (
          <div>
            <label className="block mb-1">Логин</label>
            <input
              value={v.username || ""}
              onChange={(e) => setV({ ...v, username: e.target.value })}
              placeholder="уникальный логин"
              style={{ height: 36, fontSize: 14 }}
              required={mode === "create"}
            />
          </div>
        )}

        <div>
          <label className="block mb-1">E-mail</label>
          <input
            type="email"
            value={v.email || ""}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            style={{ height: 36, fontSize: 14 }}
            disabled={!canChangeEmail}
          />
          {v.email && !isValidEmail(v.email) && <div className="text-xs text-red-600 mt-1">Некорректный e-mail</div>}
        </div>

        <div>
          <label className="block mb-1">Телефон</label>
          <input value={v.phone || ""} onChange={(e) => setV({ ...v, phone: e.target.value })} style={{ height: 36, fontSize: 14 }} />
        </div>

        <div>
          <label className="block mb-1">Дата рождения</label>
          <input
            type="date"
            value={v.birthday ? v.birthday.slice(0, 10) : ""}
            onChange={(e) => setV({ ...v, birthday: e.target.value ? `${e.target.value}` : null })}
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">Telegram</label>
          <input value={v.telegram || ""} onChange={(e) => setV({ ...v, telegram: e.target.value })} style={{ height: 36, fontSize: 14 }} />
        </div>

        <div>
          <label className="block mb-1">Аватар (URL)</label>
          <input value={v.avatarUrl || ""} onChange={(e) => setV({ ...v, avatarUrl: e.target.value })} style={{ height: 36, fontSize: 14 }} />
        </div>

        <div>
          <label className="block mb-1">Классное руководство</label>
          <input value={v.classroom || ""} onChange={(e) => setV({ ...v, classroom: e.target.value })} style={{ height: 36, fontSize: 14 }} disabled={!canChangeClassroom} />
        </div>

        <div>
          <label className="block mb-1">Роль</label>
          <select
            value={v.roleSlug || ""}
            onChange={(e) => setV({ ...v, roleSlug: e.target.value })}
            className="input w-full"
            style={{ height: 36, fontSize: 14 }}
            disabled={!canChangeRole}
          >
            <option value="">— выберите —</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block mb-1">О себе</label>
          <textarea value={v.about || ""} onChange={(e) => setV({ ...v, about: e.target.value })} rows={3} />
        </div>
      </div>

      <CheckboxGrid title="Предметы" options={SUBJECTS} values={v.subjects || []} onChange={(next) => setV({ ...v, subjects: next })} />
      <CheckboxGrid title="Методические объединения" options={GROUPS} values={v.methodicalGroups || []} onChange={(next) => setV({ ...v, methodicalGroups: next })} />

      {mode === "create" && (
        <div>
          <label className="block mb-1">Начальный пароль (опционально)</label>
          <input type="password" value={v.password || ""} onChange={(e) => setV({ ...v, password: e.target.value })} style={{ height: 36, fontSize: 14 }} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={!canSubmit} style={{ padding: "6px 12px", fontSize: 14 }}>
          {loading ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
