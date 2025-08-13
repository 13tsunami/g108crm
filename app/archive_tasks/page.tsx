// app/archive_tasks/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Task = {
  id: string;
  seq?: number | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: "high" | "normal" | string;
  hidden?: boolean;
  assignedTo?: Array<{ type?: "user"; id: string }>;
  assignees?: Array<{ userId: string; status?: string; doneAt?: string | null }>;
  createdById?: string | null;
};

type SimpleUser = {
  id: string;
  name: string | null;
  role?: string | null;
  methodicalGroups?: string | null;
};

const BRAND = "#8d2828";
const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtRuDate(iso?: string | null) {
  if (!iso) return "—";
  const x = new Date(iso);
  if (isNaN(+x)) return "—";
  const dd = String(x.getDate()).padStart(2,"0");
  const mm = MONTHS_RU[x.getMonth()];
  return `${dd} ${mm} ${x.getFullYear()}`;
}
function tsOf(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export default function ArchiveTasksPage() {
  const { data: session, status } = useSession();
  const meId = (session?.user as any)?.id as string | undefined;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"chronology" | "date" | "alpha" | "seq">("chronology");
  const [asc, setAsc] = useState<boolean>(true);
  const [createdByFilter, setCreatedByFilter] = useState<string>("__all__");

  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadUsers();
    loadTasks();

    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") loadTasks();
    }, 10000);

    const onVis = () => { if (document.visibilityState === "visible") loadTasks(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status]);

  async function loadUsers() {
    try {
      const rChat = await fetch("/api/chat/users?includeSelf=1&limit=2000", { cache: "no-store" });
      const base = rChat.ok ? await rChat.json() : [];
      const byId = new Map<string, SimpleUser>();
      if (Array.isArray(base)) {
        base.forEach((u: any) => {
          if (!u?.id) return;
          byId.set(u.id, { id: u.id, name: u.name ?? null });
        });
      }
      try {
        const rUsers = await fetch("/api/users", { cache: "no-store" });
        if (rUsers.ok) {
          const extras = await rUsers.json();
          if (Array.isArray(extras)) {
            extras.forEach((e: any) => {
              if (!e?.id) return;
              const prev = byId.get(e.id) ?? { id: e.id, name: e.name ?? null };
              byId.set(e.id, { ...prev, name: prev.name ?? e.name ?? null });
            });
          }
        }
      } catch {}
      setUsers(Array.from(byId.values()));
    } catch {
      setUsers([]);
    }
  }

  async function loadTasks() {
    try {
      const r = await fetch("/api/tasks", { cache: "no-store" });
      if (!r.ok) { setTasks([]); return; }
      const list = await r.json();
      setTasks(Array.isArray(list) ? list : []);
    } catch {
      setTasks([]);
    }
  }

  const usersById = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach(u => { if (u.id) m.set(u.id, u.name || u.id); });
    return m;
  }, [users]);

  function myDoneAssignee(t: Task) {
    if (!meId) return null;
    if (!Array.isArray(t.assignees)) return null;
    return t.assignees.find(a => a.userId === meId && a.status === "done") || null;
  }

  const mineArchived = useMemo(() => {
    if (!meId) return [];
    return tasks.filter(t => !!myDoneAssignee(t));
  }, [tasks, meId]);

  const createdByOptions = useMemo(() => {
    const set = new Set<string>();
    mineArchived.forEach(t => { if (t.createdById) set.add(t.createdById); });
    return ["__all__", ...Array.from(set)];
  }, [mineArchived]);

  const view = useMemo(() => {
    let arr = [...mineArchived];

    if (createdByFilter !== "__all__") {
      arr = arr.filter(t => (t.createdById || null) === createdByFilter);
    }

    const q = search.trim().toLocaleLowerCase("ru-RU");
    if (q) {
      arr = arr.filter(t => {
        const inText =
          (t.title || "").toLocaleLowerCase("ru-RU").includes(q) ||
          (t.description || "").toLocaleLowerCase("ru-RU").includes(q);
        const inAssignees = (t.assignees || []).some(a => {
          const name = usersById.get(a.userId) || a.userId;
          return name.toLocaleLowerCase("ru-RU").includes(q);
        });
        return inText || inAssignees;
      });
    }

    switch (sort) {
      case "chronology":
      case "seq":
        arr.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        break;
      case "date":
        arr.sort((a, b) => tsOf(a.dueDate) - tsOf(b.dueDate));
        break;
      case "alpha":
        arr.sort((a, b) => (a.title || "").localeCompare((b.title || ""), "ru"));
        break;
    }
    if (!asc) arr.reverse();
    return arr;
  }, [mineArchived, createdByFilter, search, sort, asc, usersById]);

  async function unarchive(taskId: string) {
    if (!meId) { alert("Не удалось определить текущего пользователя"); return; }
    const r = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/assignees/${encodeURIComponent(meId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(`Не удалось разархивировать: ${t || r.status}`);
      return;
    }
    await loadTasks();
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16, fontFamily: '"Times New Roman", serif', fontSize: 12 }}>Нужна авторизация, чтобы смотреть архив.</section>;
  }

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12, padding: 12 }}>
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px 200px 120px", gap: 8, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по заголовку, описанию, назначенным…"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none" }}
          />
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            title="Назначивший"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none", background: "#fff" }}
          >
            <option value="__all__">Все назначившие</option>
            {createdByOptions.filter(x => x !== "__all__").map((id) => (
              <option key={id} value={id}>{usersById.get(id) || id}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            title="Сортировка"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none", background: "#fff" }}
          >
            <option value="chronology">По хронологии добавления</option>
            <option value="date">По дате</option>
            <option value="alpha">По алфавиту</option>
            <option value="seq">По номеру</option>
          </select>
          <button
            type="button"
            onClick={() => setAsc(v => !v)}
            title={asc ? "По возрастанию" : "По убыванию"}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800
            }}
          >
            {asc ? "↑ возр." : "↓ убыв."}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column-reverse", gap: 8 }}>
        {view.length === 0 && (
          <div className="card" style={{ padding: 12, color: "#6b7280" }}>
            Архив пуст.
          </div>
        )}

        {view.map((t) => {
          const expanded = expandedId === t.id;
          const urgent = (t.priority || "normal") === "high";

          const assignees = (t.assignees || []).map(a => ({
            id: a.userId,
            name: usersById.get(a.userId) || a.userId,
            status: a.status || "open",
            doneAt: a.doneAt || null
          }));

          return (
            <div key={t.id} className="card" style={{ borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : t.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 12
                }}
                aria-expanded={expanded}
                aria-controls={`arch-${t.id}`}
              >
                <span style={{ fontWeight: 800, fontSize: 15, color: urgent ? "#c1121f" : "#111827" }}>
                  №{t.seq ?? "—"} · {t.title}
                </span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  назначил: {t.createdById ? (usersById.get(t.createdById) || t.createdById) : "—"}
                </span>
              </button>

              {expanded && (
                <div id={`arch-${t.id}`} style={{ padding: "0 12px 12px 12px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      Срок: {fmtRuDate(t.dueDate)}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {urgent && (
                        <span style={{ fontSize: 11, background: BRAND, color: "#fff", borderRadius: 999, padding: "2px 8px" }}>
                          срочно
                        </span>
                      )}
                      {t.hidden && (
                        <span title="Эта задача не публикуется в общем календаре" style={{ fontSize: 11, color: "#6b7280", border: "1px dashed #c4c4c4", padding: "2px 8px", borderRadius: 999 }}>
                          вне календаря
                        </span>
                      )}
                    </div>
                  </div>

                  {assignees.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Кому назначено:</div>
                      {assignees.map((a, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: 11,
                            border: "1px solid #e5e7eb",
                            padding: "2px 8px",
                            borderRadius: 999,
                            marginRight: 6,
                            marginTop: 4
                          }}
                          title={a.status === "done" && a.doneAt ? `выполнено: ${fmtRuDate(a.doneAt)}` : ""}
                        >
                          {a.name}
                          {a.status === "done" ? " — выполнено" : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Тело задачи — в рамочке */}
                  {t.description && (
                    <div
                      style={{
                        marginTop: 8,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        border: "1px solid #e5e7eb",
                        background: "#fcfcfc",
                        borderRadius: 10,
                        padding: "8px 10px"
                      }}
                    >
                      {t.description}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => unarchive(t.id)}
                      style={{
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 10,
                        border: "1px solid #111827",
                        background: "#111827",
                        color: "#fff",
                        cursor: "pointer"
                      }}
                    >
                      Разархивировать
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
        .card:hover { border-color: #d1d5db; }
      `}</style>
    </section>
  );
}
