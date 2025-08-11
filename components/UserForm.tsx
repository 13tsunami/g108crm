"use client";

import React, { useMemo, useState } from "react";

type Props = {
  mode: "self" | "create" | "edit";
  initialValues: {
    id?: string;
    name: string;
    email?: string;           // <-- EMAIL
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
  forbid?: ("role" | "classroom" | "password" | "email")[]; // <-- EMAIL forbid
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
  if (!s) return true; // поле не обязательно
  return /\S+@\S+\.\S+/.test(s);
}

export default function UserForm({
  mode,
  initialValues,
  forbid = [],
  allowRoleChange = true,
  onSuccess,
}: Props) {
  const [v, setV] = useState({ ...initialValues });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isCreate = mode === "create";
  const isSelf = mode === "self";
  const canChangeRole = allowRoleChange && !forbid.includes("role");
  const canChangeClassroom = !forbid.includes("classroom");
  const canChangeEmail = !forbid.includes("email");            // <-- EMAIL

  const submitPath =
    mode === "create"
      ? "/api/users"
      : mode === "edit"
      ? `/api/users/${v.id}`
      : "/api/profile";

  const method = mode === "create" ? "POST" : mode === "edit" ? "PATCH" : "PATCH";

  const canSubmit = useMemo(() => {
    if (!v.name?.trim()) return false;
    if (v.email && !isValidEmail(v.email)) return false;       // <-- EMAIL
    return !loading;
  }, [v.name, v.email, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErr(null);
    setMsg(null);

    const body: any = {
      name: v.name?.trim(),
      email: v.email?.trim() || null,                           // <-- EMAIL
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
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}
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
      {err && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 text-sm">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded border border-green-300 bg-green-50 text-green-800 p-2 text-sm">
          {msg}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block mb-1">ФИО</label>
          <input
            value={v.name || ""}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            required
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">E-mail</label>
          <input
            type="email"
            value={v.email || ""}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            style={{ height: 36, fontSize: 14 }}
            disabled={!canChangeEmail}
          />
          {v.email && !isValidEmail(v.email) && (
            <div className="text-xs text-red-600 mt-1">Некорректный e-mail</div>
          )}
        </div>

        <div>
          <label className="block mb-1">Телефон</label>
          <input
            value={v.phone || ""}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">Дата рождения</label>
          <input
            type="date"
            value={v.birthday ? v.birthday.slice(0, 10) : ""}
            onChange={(e) =>
              setV({ ...v, birthday: e.target.value ? `${e.target.value}` : null })
            }
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">Telegram</label>
          <input
            value={v.telegram || ""}
            onChange={(e) => setV({ ...v, telegram: e.target.value })}
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">Аватар (URL)</label>
          <input
            value={v.avatarUrl || ""}
            onChange={(e) => setV({ ...v, avatarUrl: e.target.value })}
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">Классное руководство</label>
          <input
            value={v.classroom || ""}
            onChange={(e) => setV({ ...v, classroom: e.target.value })}
            style={{ height: 36, fontSize: 14 }}
            disabled={!canChangeClassroom}
          />
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
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block mb-1">О себе</label>
          <textarea
            value={v.about || ""}
            onChange={(e) => setV({ ...v, about: e.target.value })}
            rows={3}
          />
        </div>

        <div>
          <label className="block mb-1">Предметы (через запятую)</label>
          <input
            value={(v.subjects || []).join(", ")}
            onChange={(e) =>
              setV({ ...v, subjects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
            }
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div>
          <label className="block mb-1">Методические объединения (через запятую)</label>
          <input
            value={(v.methodicalGroups || []).join(", ")}
            onChange={(e) =>
              setV({
                ...v,
                methodicalGroups: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            style={{ height: 36, fontSize: 14 }}
          />
        </div>

        <div className="flex items-center gap-4 md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!v.notifyEmail}
              onChange={(e) => setV({ ...v, notifyEmail: e.target.checked })}
            />
            Уведомления на e-mail
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!v.notifyTelegram}
              onChange={(e) => setV({ ...v, notifyTelegram: e.target.checked })}
            />
            Уведомления в Telegram
          </label>
        </div>

        {isCreate && (
          <div className="md:col-span-2">
            <label className="block mb-1">Начальный пароль (опционально)</label>
            <input
              type="password"
              value={v.password || ""}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              style={{ height: 36, fontSize: 14 }}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={!canSubmit} style={{ padding: "6px 12px", fontSize: 14 }}>
          {loading ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
