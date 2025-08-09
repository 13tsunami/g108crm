// app/settings/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type SettingsState = {
  city: string;
  lat: string;
  lon: string;
  avatarUrl: string;            // ссылка, которую подхватит сайдбар
  showSidebarSummary: boolean;
  compactNav: boolean;
  theme: "light" | "dark";
  phone: string;
};

const LS_KEY = "crm.settings";
const DEFAULT_AVATAR = "/avatar.png";

function sanitizeUrl(u: unknown): string {
  const s = (typeof u === "string" ? u : "").trim();
  return s ? s : DEFAULT_AVATAR;
}

function load(): SettingsState {
  const base: SettingsState = {
    city: "Екатеринбург",
    lat: "56.8389",
    lon: "60.6057",
    avatarUrl: DEFAULT_AVATAR,
    showSidebarSummary: false,
    compactNav: false,
    theme: "dark",
    phone: "",
  };

  if (typeof window === "undefined") return base;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) ?? {};
    return {
      city: s.city ?? base.city,
      lat: s.lat ?? base.lat,
      lon: s.lon ?? base.lon,
      avatarUrl: sanitizeUrl(s.avatarUrl),
      showSidebarSummary: !!s.showSidebarSummary,
      compactNav: !!s.compactNav,
      theme: s.theme === "light" ? "light" : "dark",
      phone: typeof s.phone === "string" ? s.phone : "",
    };
  } catch {
    return base;
  }
}

export default function SettingsPage() {
  const [state, setState] = useState<SettingsState>(load());
  const [savedUI, setSavedUI] = useState<null | "ok" | "err">(null);
  const [uploading, setUploading] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<null | "ok" | "err" | "dup" | "unauth">(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  function persist(next: SettingsState = state) {
    try {
      const fixed: SettingsState = { ...next, avatarUrl: sanitizeUrl(next.avatarUrl) };
      localStorage.setItem(LS_KEY, JSON.stringify(fixed));
      window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY, newValue: JSON.stringify(fixed) }));
      setSavedUI("ok");
    } catch {
      setSavedUI("err");
    } finally {
      setTimeout(() => setSavedUI(null), 1500);
    }
  }

  async function onUpload() {
    if (!fileRef.current?.files?.[0]) return;
    const file = fileRef.current.files[0];
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const next = { ...state, avatarUrl: sanitizeUrl(data.url) };
      setState(next);
      persist(next);
    } catch {
      // оставляем состояние как есть
    } finally {
      setUploading(false);
    }
  }

  async function savePhone() {
    setPhoneStatus(null);
    try {
      const uid = process.env.NEXT_PUBLIC_USER_ID;
      const res = await fetch("/api/user/phone", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid ? String(uid) : "",
        },
        body: JSON.stringify({ phone: state.phone }),
      });
      if (res.status === 401) return setPhoneStatus("unauth");
      if (res.status === 409) return setPhoneStatus("dup");
      if (!res.ok) return setPhoneStatus("err");
      setPhoneStatus("ok");
      persist({ ...state });
    } catch {
      setPhoneStatus("err");
    } finally {
      setTimeout(() => setPhoneStatus(null), 1800);
    }
  }

  return (
    <div className="section">
      <h1>Настройки</h1>
      <p>Аватар, погода и поведение интерфейса. Телефон сохраняется в базу. Палитра не меняется.</p>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h2>Аватар</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input ref={fileRef} type="file" accept="image/*" />
          <button className="btn-primary" onClick={onUpload} disabled={uploading}>
            {uploading ? "Загрузка…" : "Загрузить"}
          </button>
        </div>
        <p style={{ marginTop: 8 }}>Файл сохраняется в /public/uploads; ссылку подхватит сайдбар.</p>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h2>Локализация и погода</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label>
            Город (подпись)
            <input value={state.city} onChange={(e) => setState({ ...state, city: e.target.value })} />
          </label>
          <label>
            Широта
            <input inputMode="decimal" value={state.lat} onChange={(e) => setState({ ...state, lat: e.target.value })} />
          </label>
          <label>
            Долгота
            <input inputMode="decimal" value={state.lon} onChange={(e) => setState({ ...state, lon: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h2>Интерфейс</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={state.showSidebarSummary}
              onChange={(e) => setState({ ...state, showSidebarSummary: e.target.checked })}
            />
            Сводка задач в сайдбаре
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={state.compactNav}
              onChange={(e) => setState({ ...state, compactNav: e.target.checked })}
            />
            Компактная навигация
          </label>
          <label>
            Тема
            <select value={state.theme} onChange={(e) => setState({ ...state, theme: e.target.value as "light" | "dark" })}>
              <option value="dark">Тёмная</option>
              <option value="light">Светлая</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h2>Номер телефона</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr auto" }}>
          <input
            placeholder="+7XXXXXXXXXX"
            value={state.phone}
            onChange={(e) => setState({ ...state, phone: e.target.value.replace(/[^\d+]/g, "") })}
          />
          <button className="btn-primary" onClick={savePhone}>Сохранить телефон</button>
        </div>
        <div style={{ marginTop: 8 }}>
          {phoneStatus === "ok" && "Сохранено в базе"}
          {phoneStatus === "dup" && "Такой телефон уже используется"}
          {phoneStatus === "unauth" && "Не указан пользователь (x-user-id)"}
          {phoneStatus === "err" && "Ошибка сохранения"}
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button className="btn-primary" onClick={() => persist()}>Сохранить и применить</button>
        <button
          onClick={() => {
            const def = load();
            setState(def);
            persist(def);
          }}
        >
          Сбросить
        </button>
        {savedUI === "ok" && <span style={{ marginLeft: 8 }}>Сохранено</span>}
        {savedUI === "err" && <span style={{ marginLeft: 8 }}>Ошибка сохранения</span>}
      </div>
    </div>
  );
}
