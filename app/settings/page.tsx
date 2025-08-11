"use client";

import { useEffect, useState } from "react";
import { SUBJECTS_2025_RU, METHODICAL_GROUPS_108 } from "@/lib/edu";

type Me = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  classroom?: string | null;
  about?: string | null;
  avatarUrl?: string | null;
  telegram?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  role?: string | null;
  subjects?: string[];
  methodicalGroups?: string[];
  groups?: string[];
};

function MultiSelectList({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  columns?: 1 | 2 | 3;
}) {
  const set = new Set(value);
  function toggle(opt: string) {
    const next = new Set(value);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange([...next]);
  }
  return (
    <div
      className="rounded border p-2"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
        gap: 8,
        maxHeight: 240,
        overflow: "auto",
      }}
    >
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center gap-2">
          <input type="checkbox" checked={set.has(opt)} onChange={() => toggle(opt)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [classroom, setClassroom] = useState("");
  const [about, setAbout] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [mGroups, setMGroups] = useState<string[]>([]);

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [pErr, setPErr] = useState<string | null>(null);
  const [pOk, setPOk] = useState<string | null>(null);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        const j: Me = await r.json();
        setMe(j);
        setPhone(j.phone ?? "");
        setClassroom(j.classroom ?? "");
        setAbout(j.about ?? "");
        setTelegram(j.telegram ?? "");
        setAvatarUrl(j.avatarUrl ?? "");
        setNotifyEmail(j.notifyEmail ?? true);
        setNotifyTelegram(j.notifyTelegram ?? false);
        setSubjects(Array.isArray(j.subjects) ? j.subjects : []);
        setMGroups(Array.isArray(j.methodicalGroups) ? j.methodicalGroups : (Array.isArray(j.groups) ? j.groups : []));
      } catch {
        setErr("Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile() {
    setErr(null); setOk(null);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || null,
          classroom: classroom || null,
          about: about || null,
          telegram: telegram || null,
          avatarUrl: avatarUrl || null,
          notifyEmail,
          notifyTelegram,
          subjects,
          methodicalGroups: mGroups,
          groups: mGroups, // дубль для совместимости
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setOk("Профиль обновлён");
    } catch {
      setErr("Не удалось сохранить изменения");
    }
  }

  async function changePassword() {
    setPErr(null); setPOk(null);
    if (!newPass || newPass !== newPass2) return setPErr("Пароли не совпадают");
    try {
      const r = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      });
      if (!r.ok) {
        const t = await r.json().catch(() => ({}));
        throw new Error(t?.error || "Ошибка");
      }
      setPOk("Пароль изменён");
      setOldPass(""); setNewPass(""); setNewPass2("");
    } catch (e: any) { setPErr(e?.message || "Не удалось изменить пароль"); }
  }

  if (loading) return <div className="p-6">Загрузка…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!me) return null;

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Настройки профиля</h1>
        <div className="text-neutral-600">
          Телефон, кабинет, контакты, предметы/МО, описание и пароль можно менять самостоятельно. ФИО, email и роль — через администратора.
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Телефон</label>
            <input className="input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7XXXXXXXXXX" />
          </div>
          <div>
            <label className="label">Классное руководство / кабинет</label>
            <input className="input w-full" value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="например, 9Б / каб. 203" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Telegram</label>
            <input className="input w-full" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Ссылка на фото (аватар)</label>
            <input className="input w-full" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div>
          <label className="label">О себе</label>
          <textarea className="input w-full" rows={5} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Кратко о себе, достижения, расписание приёма…" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Предметы</label>
            <MultiSelectList options={SUBJECTS_2025_RU} value={subjects} onChange={setSubjects} />
          </div>
          <div>
            <label className="label">Методические объединения</label>
            <MultiSelectList options={METHODICAL_GROUPS_108} value={mGroups} onChange={setMGroups} />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            <span>Уведомления на email</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={notifyTelegram} onChange={(e) => setNotifyTelegram(e.target.checked)} />
            <span>Уведомления в Telegram</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={saveProfile}>Сохранить</button>
          {ok && <div className="text-green-600 self-center">{ok}</div>}
          {err && <div className="text-red-600 self-center">{err}</div>}
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h2 className="text-lg font-semibold">Смена пароля</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <input className="input w-full" type={showOld ? "text" : "password"} placeholder="Текущий пароль" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
            <button type="button" className="btn" onClick={() => setShowOld((v) => !v)}>{showOld ? "Скрыть" : "Показать"}</button>
          </div>
          <div className="flex items-center gap-2">
            <input className="input w-full" type={showNew ? "text" : "password"} placeholder="Новый пароль" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button type="button" className="btn" onClick={() => setShowNew((v) => !v)}>{showNew ? "Скрыть" : "Показать"}</button>
          </div>
          <div>
            <input className="input w-full" type={showNew ? "text" : "password"} placeholder="Повторите новый пароль" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn" onClick={changePassword}>Изменить пароль</button>
          {pOk && <div className="text-green-600 self-center">{pOk}</div>}
          {pErr && <div className="text-red-600 self-center">{pErr}</div>}
        </div>
      </div>
    </div>
  );
}
