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
  avatarUrl?: string | null;
  about?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  subjects?: string[];
  methodicalGroups?: string[];
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

  useEffect(() => { load(); }, []);

  return (
    <div className="section">
      <h2 className="text-xl font-semibold mb-3">Настройки профиля</h2>

      {loading && <div>Загрузка…</div>}
      {!loading && err && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3 mb-3">
          Не удалось загрузить профиль. {err}
        </div>
      )}

      {!loading && me && (
        <>
          <div className="mb-3 text-sm text-neutral-600">
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
              avatarUrl: me.avatarUrl ?? "",
              about: me.about ?? "",
              notifyEmail: !!me.notifyEmail,
              notifyTelegram: !!me.notifyTelegram,
              subjects: me.subjects ?? [],
              methodicalGroups: me.methodicalGroups ?? [],
            }}
            forbid={["role", "classroom", "password", "username"]}
            allowRoleChange={false}
            onSuccess={load}
          />

          <div style={{ height: 12 }} />
          <a href="/profile/change-password" className="btn">Сменить пароль</a>
        </>
      )}
    </div>
  );
}
