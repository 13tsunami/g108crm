// app/teachers/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AddUserModal from "@/components/AddUserModal";
import EditUserModal from "@/components/EditUserModal";

const BRAND = "#8d2828";
const ACTIONS_WIDTH = 280;

const ROLE_RU: Record<string, string> = {
  admin: "Администратор",
  director: "Директор",
  deputy_plus: "Заместитель +",
  deputy: "Заместитель",
  teacher_plus: "Педагог +",
  teacher: "Педагог",
  archived: "В архиве",
};

type RowUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  classroom?: string | null;
  roleSlug?: string;
  role?: string | { slug: string } | null;
  subjects?: any; // может быть массив/строка/JSON/массив объектов
  methodicalGroups?: any;
  telegram?: string | null;
  avatarUrl?: string | null;
  about?: string | null;
  birthday?: string | null;
  username?: string | null;
};

type Presence = { [id: string]: string | null };

function getRoleSlug(u: RowUser): string | undefined {
  if (u.roleSlug) return u.roleSlug;
  if (typeof u.role === "string" && u.role) return u.role;
  if (u.role && typeof u.role === "object" && "slug" in u.role) return (u.role as any).slug;
  return undefined;
}
function ruRole(u: RowUser): string {
  const slug = getRoleSlug(u);
  return slug ? (ROLE_RU[slug] ?? slug) : "Педагог";
}
function isOnline(lastSeen?: string | null, thresholdMin = 5) {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Date.now() - t < thresholdMin * 60 * 1000;
}

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        height: 32,
        padding: "6px 10px",
        fontSize: 14,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: "pointer",
        ...(style || {}),
      }}
    />
  );
}
function BtnPrimary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        height: 32,
        padding: "6px 12px",
        fontSize: 14,
        borderRadius: 10,
        border: "1px solid " + BRAND,
        background: BRAND,
        color: "#fff",
        cursor: "pointer",
        ...(style || {}),
      }}
    />
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/>
    </svg>
  );
}

/* -------------------- МИНИ-ХЕЛПЕРЫ (только чтобы не падать на .join) -------------------- */
function toNameList(input: any): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    if (!input.length) return [];
    if (typeof input[0] === "string") {
      return (input as string[]).map(s => String(s).trim()).filter(Boolean);
    }
    return (input as any[])
      .map(x => x?.name ?? x?.title ?? x?.label ?? x?.value ?? x)
      .map(s => String(s ?? "").trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) return [];
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try { return toNameList(JSON.parse(raw)); } catch { /* fallthrough to CSV */ }
    }
    return raw.split(/[,;\/|]+/g).map(s => s.trim()).filter(Boolean);
  }
  const s = String(input?.name ?? input?.title ?? input?.label ?? input?.value ?? "").trim();
  return s ? [s] : [];
}

/* -------------------- СТРАНИЦА -------------------- */
export default function Page() {
  const { data } = useSession();
  const mySlug = (data?.user as any)?.role as string | undefined;
  const canManage = mySlug === "director" || mySlug === "deputy_plus";

  const [users, setUsers] = useState<RowUser[]>([]);
  const [presence, setPresence] = useState<Presence>({});
  const [details, setDetails] = useState<Record<string, RowUser>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<RowUser | null>(null);
  const [forceUser, setForceUser] = useState<{ id: string; name: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState<string>("");
  const [delLoading, setDelLoading] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [canArchive, setCanArchive] = useState(false);
  const [archLoading, setArchLoading] = useState(false);
  const [archErr, setArchErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      // Основной эндпоинт
      let r = await fetch("/api/users", { cache: "no-store" });
      let t = await r.text();
      let arr: RowUser[] = [];
      try { arr = JSON.parse(t); } catch {}

      // Фолбэк на /api/teachers (твоя ошибка 404 указывала на этот путь)
      if (!r.ok || !Array.isArray(arr)) {
        r = await fetch("/api/teachers", { cache: "no-store" });
        t = await r.text();
        try { arr = JSON.parse(t); } catch { arr = []; }
      }
      setUsers(Array.isArray(arr) ? arr : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let alive = true;

    const beat = async () => {
      try {
        let r = await fetch("/api/presence", { method: "PATCH" });
        if (r.status === 404) await fetch("/presence", { method: "PATCH" });
      } catch {}
    };

    const pull = async () => {
      try {
        let r = await fetch("/api/presence", { cache: "no-store" });
        if (r.status === 404) r = await fetch("/presence", { cache: "no-store" });
        const t = await r.text();
        let j: any = null;
        try {
          j = t ? JSON.parse(t) : null;
        } catch {}
        const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.list) ? j.list : Array.isArray(j?.users) ? j.users : [];
        if (!alive) return;
        const map: Presence = {};
        for (const it of arr) if (it && typeof it.id === "string") map[it.id] = it.lastSeen ?? null;
        setPresence(map);
      } catch {}
    };

    beat();
    pull();
    const i1 = setInterval(beat, 60_000);
    const i2 = setInterval(pull, 60_000);
    return () => {
      alive = false;
      clearInterval(i1);
      clearInterval(i2);
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const src = users.filter((u) => getRoleSlug(u) !== "archived");
    if (!s) return src;
    return src.filter((u) =>
      [
        u.name,
        ruRole(u),
        u.email ?? "",
        u.phone ?? "",
        u.classroom ?? "",
        ...toNameList(u.subjects),
        ...toNameList(u.methodicalGroups),
      ]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [users, q]);

  async function openExpand(u: RowUser) {
    const id = u.id;
    setExpandedId((prev) => (prev === id ? null : id));
    if (!details[id]) {
      try {
        // основной путь
        let r = await fetch(`/api/users/${id}`, { cache: "no-store" });
        let t = await r.text();
        let j: any = null;
        try { j = t ? JSON.parse(t) : null; } catch {}
        let payload = j?.user ?? j?.data ?? j;

        // фолбэк на /api/teachers/:id
        if (!r.ok || !payload || payload.error) {
          r = await fetch(`/api/teachers/${id}`, { cache: "no-store" });
          t = await r.text();
          j = null;
          try { j = t ? JSON.parse(t) : null; } catch {}
          payload = j?.user ?? j?.data ?? j;
        }

        if (payload && !payload.error) {
          setDetails((prev) => ({ ...prev, [id]: payload as RowUser }));
        }
      } catch {}
    }
  }

  async function doDelete() {
    // без изменений
    if (!delId || delLoading) return;
    setDelLoading(true);
    setDelErr(null);
    setCanArchive(false);
    try {
      const r = await fetch(`/api/users/${delId}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const ct = r.headers.get("content-type") || "";
      if (!r.ok) {
        const msg = ct.includes("application/json")
          ? (await r.json().catch(() => ({})))?.error || `HTTP ${r.status}`
          : `HTTP ${r.status}`;
        if (r.status === 409 || r.status === 405) setCanArchive(true);
        throw new Error(msg);
      }
      setDelOpen(false);
      setDelId("");
      await load();
    } catch (e: any) {
      setDelErr(e?.message || "Не удалось удалить");
    } finally {
      setDelLoading(false);
    }
  }

  async function doArchive() {
    // без изменений
    if (!delId || archLoading) return;
    setArchLoading(true);
    setArchErr(null);
    try {
      const r = await fetch(`/api/users/${delId}/archive`, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const ct = r.headers.get("content-type") || "";
      if (!r.ok) {
        const msg = ct.includes("application/json")
          ? (await r.json().catch(() => ({})))?.error || `HTTP ${r.status}`
          : `HTTP ${r.status}`;
        throw new Error(msg);
      }
      setDelOpen(false);
      setDelId("");
      setCanArchive(false);
      await load();
    } catch (e: any) {
      setArchErr(e?.message || "Не удалось архивировать");
    } finally {
      setArchLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>Педагоги</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Поиск: ФИО, роль, email, телефон, класс, группы, предметы"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            height: 36,
            fontSize: 14,
            width: 520,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
          }}
        />
        {canManage && (
          <>
            <BtnPrimary onClick={() => setAddOpen(true)}>Добавить</BtnPrimary>
            <Btn onClick={() => { setDelErr(null); setArchErr(null); setCanArchive(false); setDelId(""); setDelOpen(true); }}>
              Удалить
            </Btn>
          </>
        )}
        <Btn onClick={load}>{loading ? "Обновление…" : "Обновить"}</Btn>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {filtered.map((u, idx) => {
          const online = isOnline(presence[u.id]);
          const expanded = expandedId === u.id;
          const d = details[u.id] ?? u;

          const subjectsList = toNameList(d.subjects);
          const methodicalList = toNameList(d.methodicalGroups);

          return (
            <div key={u.id} style={{ padding: 8, borderTop: idx ? "1px solid #eef0f2" : "none" }}>
              <div
                style={{
                  display: "grid",
                  alignItems: "center",
                  gap: 8,
                  gridTemplateColumns: `minmax(180px,1fr) ${ACTIONS_WIDTH}px`,
                }}
              >
                <button
                  onClick={() => openExpand(u)}
                  title="Показать подробности"
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "#f5f6f7",
                    borderRadius: 9999,
                    border: "1px solid #e5e7eb",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: online ? "#16a34a" : "#ef4444",
                      lineHeight: "16px",
                    }}
                  >
                    {online ? "онлайн" : "оффлайн"}
                  </div>
                </button>

                {canManage ? (
                  <div style={{ display: "flex", justifyContent: "end", gap: 12, paddingRight: 4 }}>
                    <Btn onClick={() => setForceUser({ id: u.id, name: u.name })} title="Принудительно задать пароль">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <LockIcon /> Задать пароль
                      </span>
                    </Btn>
                    <Btn onClick={() => setEditUser(u)}>Редактировать</Btn>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {expanded && (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 12,
                    background: "rgba(255,255,255,0.6)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <div>
                        <strong>Роль:</strong> {ruRole(d)}
                      </div>
                      <div>
                        <strong>E-mail:</strong> {d.email || "—"}
                      </div>
                      <div>
                        <strong>Телефон:</strong> {d.phone || "—"}
                      </div>
                      <div>
                        <strong>Классное руководство:</strong> {d.classroom || "—"}
                      </div>
                      <div>
                        <strong>Telegram:</strong> {d.telegram || "—"}
                      </div>
                      <div>
                        <strong>Дата рождения:</strong>{" "}
                        {d.birthday ? new Date(d.birthday).toLocaleDateString() : "—"}
                      </div>
                      {d.username && (
                        <div>
                          <strong>Логин:</strong> {d.username}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div>
                        <strong>Предметы:</strong>{" "}
                        {subjectsList.length ? subjectsList.join(", ") : "—"}
                      </div>
                      <div>
                        <strong>Методические объединения:</strong>{" "}
                        {methodicalList.length ? methodicalList.join(", ") : "—"}
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {d.avatarUrl ? (
                          <img
                            src={d.avatarUrl}
                            alt=""
                            style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 9999, marginTop: 2 }}
                          />
                        ) : null}
                        <div>
                          <div>
                            <strong>О себе:</strong>
                          </div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{d.about || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && (
          <div style={{ padding: 24, color: "#6b7280" }}>Ничего не найдено</div>
        )}
      </div>

      {addOpen && <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={load}
          allowRoleChange={canManage}
        />
      )}

      {forceUser && (
        <ForcePasswordModal user={forceUser} onClose={() => setForceUser(null)} onDone={load} />
      )}

      {delOpen && (
        <div
          onClick={() => setDelOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              maxWidth: "92vw",
              padding: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setDelOpen(false)}
              style={{
                position: "absolute",
                right: 8,
                top: 6,
                border: "none",
                background: "transparent",
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
              }}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Удалить пользователя</h3>

            {delErr && (
              <div
                style={{
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: 8,
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                {delErr}
              </div>
            )}
            {archErr && (
              <div
                style={{
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: 8,
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                {archErr}
              </div>
            )}

            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Кого удалить</label>
            <select
              value={delId}
              onChange={(e) => setDelId(e.target.value)}
              disabled={delLoading || archLoading}
              style={{
                height: 38,
                fontSize: 14,
                width: "100%",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                marginBottom: 12,
              }}
            >
              <option value="">— выберите —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {ruRole(u)}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              <Btn onClick={() => setDelOpen(false)} disabled={delLoading || archLoading}>
                Отмена
              </Btn>
              {canArchive && (
                <Btn onClick={doArchive} disabled={!delId || archLoading}>
                  {archLoading ? "Архивирование…" : "Архивировать"}
                </Btn>
              )}
              <BtnPrimary onClick={doDelete} disabled={!delId || delLoading || archLoading}>
                {delLoading ? "Удаление…" : "Удалить"}
              </BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForcePasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave = !loading && pwd.length >= 6 && pwd === pwd2;

  async function save() {
    if (!canSave) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const t = await res.text();
      let j: any = null;
      try {
        j = t ? JSON.parse(t) : null;
      } catch {}
      if (!res.ok || j?.error) throw new Error(j?.error || t || `Ошибка ${res.status}`);
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "94vw",
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: "absolute",
            right: 8,
            top: 6,
            border: "none",
            background: "transparent",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Сбросить пароль</h3>
        <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
          Пользователь: <span style={{ fontWeight: 600 }}>{user.name}</span>
        </div>

        {err && (
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              padding: 8,
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            {err}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Новый пароль</label>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Минимум 6 символов"
              autoFocus
              style={{
                height: 36,
                fontSize: 14,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                width: "100%",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Повторите пароль</label>
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              style={{
                height: 36,
                fontSize: 14,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                width: "100%",
              }}
            />
            {pwd && pwd2 && pwd !== pwd2 && (
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>Пароли не совпадают</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Btn onClick={onClose}>Отмена</Btn>
          <div style={{ flex: 1 }} />
          <BtnPrimary onClick={save} disabled={!canSave}>
            {loading ? "Сохранение…" : "Сменить пароль"}
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}
