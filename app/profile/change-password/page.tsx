"use client";

import React, { useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
  // «глаз / глаз-зачёркнут» — компактные SVG
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c5.25 0 9.27 3.64 10.5 7-1.23 3.36-5.25 7-10.5 7S2.73 15.36 1.5 12C2.73 8.64 6.75 5 12 5zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 3.27 3.28 2l19 19-1.27 1.27-3.03-3.03A12.2 12.2 0 0 1 12 19c-5.25 0-9.27-3.64-10.5-7a13.7 13.7 0 0 1 5.09-6.21L2 3.27zM9.57 7.84A4 4 0 0 1 16.16 14.4l-6.59-6.56zM12 5c5.25 0 9.27 3.64 10.5 7a13.8 13.8 0 0 1-3.02 4.31l-1.43-1.43A11.5 11.5 0 0 0 21.06 12C19.83 8.64 15.8 5 12 5z" fill="currentColor"/>
    </svg>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block mb-1 text-sm">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          style={{
            paddingRight: 36,
            height: 36,
            fontSize: 14,
          }}
        />
        <button
          type="button"
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          onClick={() => setShow((s) => !s)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
          title={show ? "Скрыть пароль" : "Показать пароль"}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
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

  async function postChange(body: any) {
    // основной маршрут
    let res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // fallback на старый роут, если он есть в проекте
    if (res.status === 404) {
      res = await fetch("/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    return res;
  }

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
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok || json?.error) {
        setErr(json?.error || json?.message || text || "Не удалось изменить пароль");
        return;
      }

      setMsg("Пароль успешно изменён");
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (e: any) {
      setErr(e?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section">
      <h2 className="text-xl font-semibold mb-2">Смена пароля</h2>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 mb-2 text-sm">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded border border-green-300 bg-green-50 text-green-800 p-2 mb-2 text-sm">
          {msg}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-2" autoComplete="off">
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
          <div className="text-xs text-red-600">Пароли не совпадают</div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <a href="/settings" className="btn" style={{ padding: "6px 10px", fontSize: 14 }}>
            Назад
          </a>
          <div className="flex-1" />
          <button
            type="submit"
            className="btn-primary"
            disabled={!canSubmit}
            style={{ padding: "6px 12px", fontSize: 14 }}
          >
            {loading ? "Сохранение…" : "Изменить пароль"}
          </button>
        </div>
      </form>
    </div>
  );
}
