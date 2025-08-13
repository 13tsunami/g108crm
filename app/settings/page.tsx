"use client";

import React, { useEffect, useState } from "react";
import UserForm from "@/components/UserForm";

type MeDTO = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  classroom: string | null;
  role: string | null;
  birthday: string | null;
  telegram?: string | null;
  about?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
};

export default function SettingsPage() {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const text = await res.text();
      const data: any = text ? JSON.parse(text) : null;
      if (!res.ok || data?.error) throw new Error(data?.error || `/api/profile ${res.status}`);
      setMe(data);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>Настройки профиля</h2>

      {loading && <div>Загрузка…</div>}
      {!loading && err && (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            padding: 12,
            marginBottom: 12,
          }}
        >
          Не удалось загрузить профиль. {err}
        </div>
      )}

      {!loading && me && (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: "#4b5563" }}>
            Роль, классное руководство и логин меняются руководством в разделе «Педагоги».
          </div>

          <UserForm
            mode="self"
            initialValues={{
              id: me.id,
              name: me.name ?? "",
              username: me.username ?? "",
              email: me.email ?? "",
              phone: me.phone ?? "",
              classroom: me.classroom ?? "",
              roleSlug: me.role ?? undefined,
              birthday: me.birthday,
              telegram: me.telegram ?? "",
              about: me.about ?? "",
              notifyEmail: !!me.notifyEmail,
              notifyTelegram: !!me.notifyTelegram,
            }}
            forbid={["role", "classroom", "password", "username"]}
            allowRoleChange={false}
            onSuccess={load}
          />

          <div style={{ height: 12 }} />
          <a
            href="/profile/change-password"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 36,
              padding: "0 12px",
              fontSize: 14,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              textDecoration: "none",
              color: "#111827",
            }}
          >
            Сменить пароль
          </a>
        </>
      )}
    </div>
  );
}
