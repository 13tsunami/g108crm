// components/Sidebar.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type DbRoleName = "Директор" | "Заместитель +" | "Заместитель" | "Педагог +" | "Педагог" | string;

interface CurrentUser {
  id: string;
  name: string;
  roles: { name: DbRoleName }[];
}

type Weather = { t: number; code?: number; cityLabel?: string };

function wmo(code?: number): string { /* ... без изменений ... */ 
  if (code == null) return "";
  if (code === 0) return "ясно";
  if ([1,2,3].includes(code)) return "переменная облачность";
  if ([45,48].includes(code)) return "туман";
  if ([51,53,55].includes(code)) return "морось";
  if ([56,57].includes(code)) return "ледяная морось";
  if ([61,63,65].includes(code)) return "дождь";
  if ([66,67].includes(code)) return "ледяной дождь";
  if ([71,73,75].includes(code)) return "снег";
  if ([77].includes(code)) return "снежные зерна";
  if ([80,81,82].includes(code)) return "ливень";
  if ([85,86].includes(code)) return "снегопад";
  if ([95].includes(code)) return "гроза";
  if ([96,99].includes(code)) return "гроза с градом";
  return "погода";
}

export default function Sidebar() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [cfg, setCfg] = useState<any>(() => {
    try { const raw = typeof window !== "undefined" ? localStorage.getItem("crm.settings") : null; return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  });

  // тянем текущего пользователя с ролями из БД
  useEffect(() => {
    const uid = process.env.NEXT_PUBLIC_USER_ID ?? "";
    fetch("/api/me", { headers: { "x-user-id": uid } })
      .then(r => r.json())
      .then((u) => {
        if (u && u.id) setMe({ id: u.id, name: u.name ?? u.fullName ?? "Профиль", roles: (u.roles ?? []).map((x: any) => ({ name: x.name as DbRoleName })) });
        else setMe({ id: "me", name: "Профиль", roles: [] });
      })
      .catch(() => setMe({ id: "me", name: "Профиль", roles: [] }));
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "crm.settings" && e.newValue) {
        try { setCfg(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => { if (cfg?.theme) document.documentElement.dataset.theme = cfg.theme; }, [cfg?.theme]);

  useEffect(() => {
    const lat = Number(cfg?.lat ?? 56.8389);
    const lon = Number(cfg?.lon ?? 60.6057);
    const cityLabel = cfg?.city ?? "Екатеринбург";
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    let aborted = false;
    fetch(url).then(r=>r.json()).then(data => {
      if (aborted) return;
      const t = data?.current?.temperature_2m; const code = data?.current?.weather_code;
      if (typeof t === "number") setWeather({ t, code, cityLabel }); else setWeather({ t: NaN, cityLabel });
    }).catch(()=>!aborted && setWeather(null));
    return () => { aborted = true; };
  }, [cfg?.lat, cfg?.lon, cfg?.city]);

  if (!me) return null;
  const avatarSrc = (cfg?.avatarUrl && String(cfg.avatarUrl).trim()) || "/avatar.png";

  return (
    <div>
      <div className="card sidebar-profile" style={{ flexDirection: "column", alignItems: "center", textAlign: "center", padding: 14 }}>
        <Image src={avatarSrc} alt="Фотография профиля" width={120} height={120} className="rounded-full" priority />
        <div style={{ marginTop: 10 }}>
          <div className="sidebar-name" style={{ lineHeight: 1.25 }}>{me.name}</div>
          {!!me.roles?.length && <div className="sidebar-role" style={{ marginTop: 2 }}>{me.roles.map(r => r.name).join(", ")}</div>}
          <div className="sidebar-role" style={{ marginTop: 6 }}>
            {weather ? `Погода — ${weather.cityLabel}: ${Number.isFinite(weather.t) ? `${Math.round(weather.t)}°C` : "—"}${weather.code != null ? `, ${wmo(weather.code)}` : ""}` : "Погода — загрузка"}
          </div>
          {cfg?.showSidebarSummary && (
            <div className="sidebar-role" style={{ marginTop: 6 }}>
              Задачи: входящие — 0, просроченные — 0
            </div>
          )}
        </div>
      </div>

      <nav>
        <ul className="nav" style={cfg?.compactNav ? { lineHeight: 1.2 } : undefined}>
          <li><Link href="/dashboard">Основное</Link></li>
          <li><Link href="/inboxTasks">Входящие / Задачи</Link></li>
          <li><Link href="/calendar">Календарь</Link></li>
          <li><Link href="/schedule">Расписание</Link></li>
          <li><Link href="/changes">Изменения в расписании</Link></li>
          <li><Link href="/teachers">Педагоги</Link></li>
          <li><Link href="/settings">Настройки</Link></li>
        </ul>
      </nav>
    </div>
  );
}
