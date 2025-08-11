"use client";

import React, { useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  classroom: string | null;
  about?: string | null;
  telegram?: string | null;
  avatarUrl?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  role: string | null;
  subjects?: string[];
  methodicalGroups?: string[];
  groups?: string[];
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!canceled) setMe(j as Profile);
      } catch (e) {
        console.error("profile load error:", e);
        if (!canceled) setMe(null);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const canSave = useMemo(() => !!me && !saving, [me, saving]);

  async function saveProfile() {
    if (!me) return;
    setSaving(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: me.phone,
          classroom: me.classroom,
          about: (me as any).about ?? null,
          telegram: (me as any).telegram ?? null,
          avatarUrl: (me as any).avatarUrl ?? null,
          notifyEmail: (me as any).notifyEmail ?? true,
          notifyTelegram: (me as any).notifyTelegram ?? false,
          subjects: (me as any).subjects ?? [],
          methodicalGroups: (me as any).methodicalGroups ?? [],
          groups: (me as any).groups ?? [],
        }),
      });
      if (!r.ok) throw new Error(await safeText(r));
      const j = (await r.json()) as Profile;
      setMe(j);
    } catch (e: any) {
      alert(`Не удалось сохранить профиль: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwdMsg(null);
    if (!oldPwd || !newPwd) {
      setPwdMsg("Укажите текущий и новый пароли.");
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg("Новый пароль должен быть не короче 6 символов.");
      return;
    }
    if (newPwd !== newPwd2) {
      setPwdMsg("Пароли не совпадают.");
      return;
    }
    setPwdBusy(true);
    try {
      const r = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const ok = r.ok;
      const j = await safeJson(r);
      if (!ok) throw new Error(j?.error || "Ошибка смены пароля");
      setPwdMsg("Пароль изменён.");
      setOldPwd("");
      setNewPwd("");
      setNewPwd2("");
    } catch (e: any) {
      setPwdMsg(e?.message ?? "Ошибка смены пароля");
    } finally {
      setPwdBusy(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!me) return <div style={{ padding: 24 }}>Не удалось загрузить профиль</div>;

  return (
    <div style={{ padding: 24, maxWidth: 800, fontFamily: "Times New Roman, serif", fontSize: 12 }}>
      <h2 style={{ margin: "0 0 16px" }}>Профиль</h2>

      <section style={card}>
        <div style={row}>
          <label style={label}>ФИО</label>
          <input style={input} value={me.name ?? ""} disabled />
        </div>
        <div style={row}>
          <label style={label}>Email</label>
          <input style={input} value={me.email ?? ""} disabled />
        </div>
        <div style={row}>
          <label style={label}>Телефон</label>
          <input
            style={input}
            value={me.phone ?? ""}
            onChange={(e) => setMe({ ...(me as Profile), phone: e.target.value })}
          />
        </div>
        <div style={row}>
          <label style={label}>Класс</label>
          <input
            style={input}
            value={me.classroom ?? ""}
            onChange={(e) => setMe({ ...(me as Profile), classroom: e.target.value })}
          />
        </div>
        {"about" in me && (
          <div style={row}>
            <label style={label}>О себе</label>
            <textarea
              style={{ ...input, height: 80, resize: "vertical" }}
              value={(me as any).about ?? ""}
              onChange={(e) => setMe({ ...(me as Profile), about: e.target.value })}
            />
          </div>
        )}
        <div style={{ textAlign: "right" }}>
          <button onClick={saveProfile} disabled={!canSave} style={buttonPrimary}>
            Сохранить профиль
          </button>
        </div>
      </section>

      <h2 style={{ margin: "24px 0 16px" }}>Смена пароля</h2>
      <section style={card}>
        <div style={row}>
          <label style={label}>Текущий пароль</label>
          <input
            style={input}
            type="password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div style={row}>
          <label style={label}>Новый пароль</label>
          <input
            style={input}
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div style={row}>
          <label style={label}>Подтверждение</label>
          <input
            style={input}
            type="password"
            value={newPwd2}
            onChange={(e) => setNewPwd2(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {pwdMsg && <div style={{ color: "#b00", marginBottom: 12 }}>{pwdMsg}</div>}
        <div style={{ textAlign: "right" }}>
          <button onClick={changePassword} disabled={pwdBusy} style={buttonSecondary}>
            Изменить пароль
          </button>
        </div>
      </section>
    </div>
  );
}

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,.08)",
  border: "1px solid rgba(0,0,0,.06)",
};

const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, marginBottom: 12 };
const label: React.CSSProperties = { alignSelf: "center", color: "#222" };
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d0d7de",
  borderRadius: 8,
  padding: "8px 10px",
  outline: "none",
};
const buttonPrimary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #0a66c2",
  background: "#0a66c2",
  color: "#fff",
  cursor: "pointer",
};
const buttonSecondary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #555",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
};
