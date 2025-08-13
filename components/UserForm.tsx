"use client";

import React, { useMemo, useState } from "react";

type Props = {
  mode: "self" | "create" | "edit";
  initialValues: {
    id?: string;
    name: string;
    username?: string;
    email?: string;
    phone?: string;
    classroom?: string;
    roleSlug?: string;
    birthday?: string | null;
    telegram?: string;
    about?: string;
    notifyEmail?: boolean;
    notifyTelegram?: boolean;
    password?: string; // только при создании
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

function isValidEmail(s?: string) {
  if (!s) return true;
  return /\S+@\S+\.\S+/.test(s);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ fontSize: 13, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        height: 36,
        fontSize: 14,
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        outline: "none",
        background: "#fff",
        ...(props.style || {}),
      }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        fontSize: 14,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        outline: "none",
        background: "#fff",
        ...(props.style || {}),
      }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        height: 36,
        fontSize: 14,
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        outline: "none",
        background: "#fff",
        ...(props.style || {}),
      }}
    />
  );
}

/** Переключатель-«пилюля» (без чекбоксов). */
function PillToggle({
  active,
  children,
  onClick,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        borderRadius: 9999,
        border: "1px solid " + (active ? "#c7e3ff" : "#e5e7eb"),
        background: active ? "#f7fbff" : "#fff",
        padding: "4px 10px",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function UserForm({ mode, initialValues, forbid = [], allowRoleChange = true, onSuccess }: Props) {
  const [v, setV] = useState({ ...initialValues });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isCreate = mode === "create";
  const canChangeRole = allowRoleChange && !forbid.includes("role");
  const canChangeClassroom = !forbid.includes("classroom");
  const canChangeEmail = !forbid.includes("email");
  const canChangeUsername = !forbid.includes("username");
  const canSetPassword = isCreate && !forbid.includes("password");

  const submitPath =
    mode === "create" ? "/api/users" : mode === "edit" ? `/api/users/${v.id}` : "/api/profile";
  const method = mode === "create" ? "POST" : "PATCH";

  const canSubmit = useMemo(() => {
    if (!v.name?.trim()) return false;
    if (v.email && !isValidEmail(v.email)) return false;
    return true;
  }, [v.name, v.email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setErr(null);
    setMsg(null);

    const body: any = {
      name: v.name?.trim(),
      username: canChangeUsername ? (v.username?.trim() || null) : undefined,
      email: canChangeEmail ? (v.email?.trim() || null) : undefined,
      phone: v.phone?.trim() || null,
      classroom: canChangeClassroom ? (v.classroom?.trim() || null) : undefined,
      roleSlug: canChangeRole ? (v.roleSlug || undefined) : undefined,
      birthday: v.birthday || null,
      telegram: v.telegram?.trim() || null,
      about: v.about?.trim() || null,
      notifyEmail: !!v.notifyEmail,
      notifyTelegram: !!v.notifyTelegram,
      password: canSetPassword ? (v.password || undefined) : undefined,
    };

    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    try {
      const res = await fetch(submitPath, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Ошибка сохранения (${res.status})`);
      }

      setMsg(isCreate ? "Пользователь создан" : "Изменения сохранены");
      onSuccess?.();
    } catch (e: any) {
      setErr(e?.message || "Не удалось сохранить");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      {(err || msg) && (
        <div
          style={{
            color: err ? "#b91c1c" : "#166534",
            background: err ? "#fef2f2" : "#ecfdf5",
            border: "1px solid " + (err ? "#fecaca" : "#bbf7d0"),
            borderRadius: 10,
            padding: 8,
            fontSize: 13,
          }}
        >
          {err || msg}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <Field label="ФИО">
          <Input value={v.name || ""} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>

        <Field label="Логин">
          <Input
            value={v.username || ""}
            onChange={(e) => setV({ ...v, username: e.target.value })}
            disabled={!canChangeUsername}
            placeholder={canChangeUsername ? "например, ivanov" : "недоступно"}
          />
        </Field>

        <Field label="E-mail">
          <Input
            type="email"
            value={v.email || ""}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            disabled={!canChangeEmail}
          />
          {!isValidEmail(v.email) && (
            <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>Неверный e-mail</div>
          )}
        </Field>

        <Field label="Телефон">
          <Input value={v.phone || ""} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>

        <Field label="Кабинет">
          <Input
            value={v.classroom || ""}
            onChange={(e) => setV({ ...v, classroom: e.target.value })}
            disabled={!canChangeClassroom}
          />
        </Field>

        <Field label="Роль">
          <Select
            value={v.roleSlug || ""}
            onChange={(e) => setV({ ...v, roleSlug: e.target.value || undefined })}
            disabled={!canChangeRole}
          >
            <option value="">—</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Дата рождения">
          <Input
            type="date"
            value={v.birthday ?? ""}
            onChange={(e) => setV({ ...v, birthday: e.target.value || null })}
          />
        </Field>

        <Field label="Telegram">
          <Input
            value={v.telegram || ""}
            onChange={(e) => setV({ ...v, telegram: e.target.value })}
          />
        </Field>

        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="О себе">
            <Textarea
              rows={3}
              value={v.about || ""}
              onChange={(e) => setV({ ...v, about: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#374151" }}>Уведомления:</div>
        <PillToggle active={!!v.notifyEmail} onClick={() => setV({ ...v, notifyEmail: !v.notifyEmail })} title="E-mail">
          E-mail {v.notifyEmail ? "вкл" : "выкл"}
        </PillToggle>
        <PillToggle
          active={!!v.notifyTelegram}
          onClick={() => setV({ ...v, notifyTelegram: !v.notifyTelegram })}
          title="Telegram"
        >
          Telegram {v.notifyTelegram ? "вкл" : "выкл"}
        </PillToggle>
      </div>

      {canSetPassword && (
        <Field label="Начальный пароль (опционально)">
          <Input
            type="password"
            value={(v as any).password || ""}
            onChange={(e) => setV({ ...v, password: e.target.value })}
          />
        </Field>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            height: 36,
            padding: "6px 12px",
            fontSize: 14,
            borderRadius: 10,
            border: "1px solid #8d2828",
            background: "#8d2828",
            color: "#fff",
            cursor: loading ? "default" : "pointer",
            filter: loading ? "grayscale(0.2)" : "none",
          }}
        >
          {loading ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
