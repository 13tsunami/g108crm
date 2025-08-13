"use client";

import React, { useState } from "react";

const BORDER = "#e5e7eb";
const BRAND = "#8d2828";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c5.25 0 9.27 3.64 10.5 7-1.23 3.36-5.25 7-10.5 7S2.73 15.36 1.5 12C2.73 8.64 6.75 5 12 5zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor"/>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 3.27 3.28 2l19 19-1.27 1.27-3.03-3.03A12.2 12.2 0 0 1 12 19c-5.25 0-9.27-3.64-10.5-7a13.7 13.7 0 0 1 5.09-6.21L2 3.27zM9.57 7.84A4 4 0 0 1 16.16 14.4l-6.59-6.56zM12 5c5.25 0 9.27-3.64 10.5 7a13.8 13.8 0 0 1-3.02 4.31l-1.43-1.43A11.5 11.5 0 0 0 21.06 12C19.83 8.64 15.8 5 12 5z" fill="currentColor"/>
    </svg>
  );
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
        border: `1px solid ${BORDER}`,
        outline: "none",
        background: "#fff",
        ...(props.style || {}),
      }}
    />
  );
}

function PasswordInput({
  label, value, onChange, autoComplete, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <div style={{ position: "relative" }}>
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          style={{ paddingRight: 40 }}
        />
        <button
          type="button"
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          onClick={() => setShow((s) => !s)}
          title={show ? "Скрыть пароль" : "Показать пароль"}
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 32, height: 32,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </Field>
  );
}

async function postChange(body: any) {
  let res = await fetch("/api/profile/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 404) {
    res = await fetch("/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return res;
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit =
    !loading &&
    currentPassword.trim().length >= 1 &&
    newPassword.trim().length >= 6 &&
    newPassword === newPassword2;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await postChange({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok || json?.error) {
        setErr(json?.error || json?.message || text || "Не удалось изменить пароль");
        return;
      }

      setMsg("Пароль успешно изменён");
      setCurrentPassword(""); setNewPassword(""); setNewPassword2("");
    } catch (e: any) {
      setErr(e?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ padding: 12 }}>
      <div style={{
        border: `1px solid ${BORDER}`, borderRadius: 12, background: "#fff", padding: 16,
      }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>Смена пароля</h2>

        {err && (
          <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 8, fontSize: 13, marginBottom: 10 }}>
            {err}
          </div>
        )}
        {msg && (
          <div style={{ borderRadius: 10, border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#166534", padding: 8, fontSize: 13, marginBottom: 10 }}>
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <PasswordInput
            label="Текущий пароль"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="Введите текущий пароль"
          />
          <PasswordInput
            label="Новый пароль"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="Минимум 6 символов"
          />
          <PasswordInput
            label="Повторите новый пароль"
            value={newPassword2}
            onChange={setNewPassword2}
            autoComplete="new-password"
            placeholder="Повтор нового пароля"
          />
          {newPassword && newPassword2 && newPassword !== newPassword2 && (
            <div style={{ fontSize: 12, color: "#b91c1c" }}>Пароли не совпадают</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <a href="/settings" style={{
              height: 36, padding: "0 10px", fontSize: 14, borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", textDecoration: "none", color: "#111827", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              Назад
            </a>
            <div style={{ flex: 1 }} />
            <button type="submit" disabled={!canSubmit} style={{
              height: 36, padding: "0 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff", cursor: canSubmit ? "pointer" : "default", filter: canSubmit ? "none" : "grayscale(0.2)",
            }}>
              {loading ? "Сохранение…" : "Изменить пароль"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
