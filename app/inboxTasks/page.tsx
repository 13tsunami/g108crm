"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import TaskForm from "@/components/TaskForm";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: "high" | "normal" | string;
  hidden?: boolean;
  assignedTo?: Array<{ type?: "user"; id: string }>;
  assignees?: Array<{ userId: string; status?: string; doneAt?: string | null }>;
  createdBy?: string | null;
  createdById?: string | null;
  seq?: number;
};

type SimpleUser = {
  id: string;
  name: string | null;
  role?: string | null;
  methodicalGroups?: string | null;
};

type SimpleGroup = { id: string; name: string };

type ProgressPayload = {
  ok: boolean;
  total: number;
  done: number;
  open: number;
  assignees: Array<{ userId: string; name: string; status: string; doneAt: string | null }>;
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

function mapRoleStrict(slugOrRaw?: string | null): string | null {
  const s = (slugOrRaw ?? "")
    .toLowerCase()
    .replace(/\s*\+\s*/g, "+")
    .trim();

  if (s === "director" || s === "директор") return "Директор";
  if (s === "deputy_plus" || s === "deputy+" || s === "заместитель+" || s === "заместитель плюс") return "Заместитель+";
  if (s === "deputy" || s === "заместитель") return "Заместитель";
  if (s === "teacher_plus" || s === "teacher+" || s === "учитель+" || s === "педагог+" || s === "педагог плюс")
    return "Педагог +";
  if (s === "teacher" || s === "учитель" || s === "педагог") return "Педагог";
  return null;
}

function mgToString(mg: unknown): string | null {
  if (Array.isArray(mg)) {
    const vals = mg.map((x) => String(x ?? "").trim()).filter(Boolean);
    return vals.length ? vals.join(", ") : null;
  }
  if (typeof mg === "string") {
    const s = mg.trim();
    return s.length ? s : null;
  }
  return null;
}

export default function InboxTasksPage() {
  const { data: session, status } = useSession();
  const meId = (session?.user as any)?.id as string | undefined;

  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [groups, setGroups] = useState<SimpleGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"toMe" | "byMe">("toMe");
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressData, setProgressData] = useState<ProgressPayload | null>(null);
  const pollRef = useRef<number | null>(null);

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
              const roleLabel = mapRoleStrict(e.roleSlug) ?? mapRoleStrict(e.role);
              byId.set(e.id, {
                id: e.id,
                name: prev.name ?? e.name ?? null,
                role: roleLabel ?? undefined,
                methodicalGroups: mgToString(e.methodicalGroups) ?? undefined,
              });
            });
          }
        }
      } catch {}
      setUsers(Array.from(byId.values()));
    } catch {
      setUsers([]);
    }
  }

  async function loadGroups() {
    const endpoints = ["/api/groups", "/api/chat/groups", "/api/user-groups"];
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) {
          const list = await r.json();
          if (Array.isArray(list)) { setGroups(list); return; }
        }
      } catch {}
    }
    setGroups([]);
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

  useEffect(() => {
    if (status !== "authenticated") return;
    loadUsers();
    loadGroups();
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

  const usersById = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach(u => { if (u.id) m.set(u.id, u.name || u.id); });
    return m;
  }, [users]);

  const sorted = useMemo(() => {
    return [...tasks].sort((a,b) => tsOf(a.dueDate) - tsOf(b.dueDate));
  }, [tasks]);

  function assigneeIdsOf(t: Task): string[] {
    if (Array.isArray(t.assignedTo) && t.assignedTo.length > 0) {
      return t.assignedTo.filter(a => !a.type || a.type === "user").map(a => a.id).filter(Boolean);
    }
    if (Array.isArray(t.assignees) && t.assignees.length > 0) {
      return t.assignees.map(a => a.userId).filter(Boolean);
    }
    return [];
  }
  function myAssigneeStatus(t: Task, myId?: string | null): string | null {
    if (!myId) return null;
    const rec = (t.assignees || []).find(a => a.userId === myId);
    return rec?.status ?? null;
  }
  function assigneeNamesOf(t: Task): string[] {
    return assigneeIdsOf(t).map(id => usersById.get(id) || id);
  }

  const toMeList = useMemo(() => {
    if (!meId) return [];
    return sorted.filter(t => assigneeIdsOf(t).includes(meId) && myAssigneeStatus(t, meId) !== "done");
  }, [sorted, meId]);
  const byMeList = useMemo(() => {
    if (!meId) return [];
    return sorted.filter(t => t.createdById === meId || t.createdBy === meId || (t.createdBy as any) === meId);
  }, [sorted, meId]);
  const view = tab === "toMe" ? toMeList : byMeList;

  useEffect(() => { setExpandedId(null); }, [tab]);

  // синхронизация счётчика «Назначенные мне» в localStorage + событие для сайдбара
  useEffect(() => {
    if (!meId) return;
    try {
      localStorage.setItem(`tasks:u:${meId}:toMeCount`, String(toMeList.length));
      window.dispatchEvent(new Event("g108:tasks-count-updated"));
    } catch {}
  }, [toMeList.length, meId]);

  function goClarify(assignerId?: string | null, seq?: number) {
    if (!assignerId) {
      alert("Не удалось определить автора задачи — «Уточнить» станет доступно после миграции createdById.");
      return;
    }
    const msg = `Добрый день, ${usersById.get(assignerId) || ""}, уточнение по задаче №${seq ?? "—"}`;
    try { localStorage.setItem("chat_prefill", msg); } catch {}
    const url = `/chat?to=${encodeURIComponent(assignerId)}&prefill=1`;
    window.location.href = url;
  }

  async function markDone(taskId: string) {
    if (!meId) { alert("Не удалось определить текущего пользователя"); return; }
    const r = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/assignees/${encodeURIComponent(meId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(`Не удалось отметить «Выполнено»: ${t || r.status}`);
      return;
    }
    await loadTasks();
  }

  async function fetchProgress(taskId: string) {
    setProgressLoading(true);
    setProgressData(null);
    try {
      const r = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/progress`, { cache: "no-store" });
      if (r.ok) {
        const data = (await r.json()) as ProgressPayload;
        setProgressData(data);
      } else {
        setProgressData(null);
      }
    } catch {
      setProgressData(null);
    } finally {
      setProgressLoading(false);
    }
  }

  function openProgress(taskId: string) {
    setProgressFor(taskId);
    fetchProgress(taskId);
  }
  function closeProgress() {
    setProgressFor(null);
    setProgressData(null);
    setProgressLoading(false);
  }

  async function editTask(task: Task) {
    const title = window.prompt("Название задачи:", task.title);
    if (!title) return;

    const description = task.description ?? "";
    const dueDateInput = (window.prompt("Срок (ISO, напр. 2025-08-15):", task.dueDate ?? "") || task.dueDate) ?? null;
    const hidden = window.confirm("Скрыть из календаря? ОК — скрыть, Отмена — оставить как есть.")
      ? true
      : (task.hidden ?? false);
    const priority = window.confirm("Сделать срочной? ОК — срочно, Отмена — обычная.")
      ? "high"
      : (task.priority ?? "normal");

    const r = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, dueDate: dueDateInput, hidden, priority }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(`Не удалось сохранить: ${t || r.status}`);
      return;
    }
    await loadTasks();
  }

  async function removeTask(taskId: string) {
    const ok = window.confirm("Удалить задачу без возможности восстановления?");
    if (!ok) return;
    const r = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 404 && r.status !== 410) {
      const t = await r.text().catch(() => "");
      alert(`Не удалось удалить: ${t || r.status}`);
      return;
    }
    await loadTasks();
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16, fontFamily: '"Times New Roman", serif', fontSize: 12 }}>Нужна авторизация, чтобы работать с задачами.</section>;
  }

  const toMeCount = toMeList.length;

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Новая задача</div>
          <TaskForm users={users} groups={groups} onCreated={() => loadTasks()} />
        </div>

        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setTab("toMe")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: tab === "toMe" ? "1px solid #e5e7eb" : "1px solid transparent",
                  background: tab === "toMe" ? "#f9fafb" : "transparent",
                  cursor: "pointer",
                  fontWeight: 800
                }}
              >
                <span>Назначенные мне</span>
                {toMeCount > 0 && (
                  <span
                    aria-label={`${toMeCount} задач`}
                    title={`${toMeCount} задач`}
                    style={{
                      fontSize: 11,
                      lineHeight: "18px",
                      minWidth: 22,
                      textAlign: "center",
                      padding: "0 6px",
                      borderRadius: 9999,
                      background: BRAND,
                      color: "#fff"
                    }}
                  >
                    {toMeCount > 99 ? "99+" : toMeCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTab("byMe")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: tab === "byMe" ? "1px solid #e5e7eb" : "1px solid transparent",
                  background: tab === "byMe" ? "#f9fafb" : "transparent",
                  cursor: "pointer",
                  fontWeight: 800
                }}
              >
                Мои назначения
              </button>
            </div>

            <Link
              href="/archive_tasks"
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                textDecoration: "none",
                color: "#111827",
                fontWeight: 800
              }}
            >
              Архив выполненных задач
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column-reverse",
              gap: 8,
              overflowY: "auto",
              padding: 12,
              maxHeight: "70vh"
            }}
          >
            {view.length === 0 && (
              <div style={{ padding: 12, color: "#6b7280" }}>Задач пока нет</div>
            )}

            {view.map((t) => {
              const urgent = (t.priority || "normal") === "high";
              const expanded = expandedId === t.id;
              const mine = meId ? assigneeIdsOf(t).includes(meId) : false;
              const byMe = meId ? t.createdById === meId : false;

              return (
                <div
                  key={t.id}
                  className="tile"
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "#fff",
                    transition: "background 120ms ease, border-color 120ms ease"
                  }}
                >
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
                    aria-controls={`task-${t.id}`}
                  >
                    <span style={{ fontWeight: 800, fontSize: 15, color: urgent ? "#c1121f" : "#111827" }}>
                      №{t.seq ?? "—"} · {t.title}
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {t.createdById ? `назначил: ${usersById.get(t.createdById) || t.createdById}` : "назначивший: —"}
                    </span>
                  </button>

                  {expanded && (
                    <div id={`task-${t.id}`} style={{ padding: "0 12px 12px 12px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "#374151" }}>{fmtRuDate(t.dueDate)}</div>
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

                      {(() => {
                        const names = assigneeNamesOf(t);
                        return names.length > 0 ? (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Кому назначено:</div>
                            {names.map((n, i) => (
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
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}

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

                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        {tab === "byMe" && byMe && (
                          <>
                            <button
                              type="button"
                              onClick={() => editTask(t)}
                              style={{
                                height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb",
                                background: "#fff", cursor: "pointer"
                              }}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTask(t.id)}
                              style={{
                                height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${BRAND}`,
                                background: BRAND, color: "#fff", cursor: "pointer"
                              }}
                            >
                              Удалить
                            </button>
                            <button
                              type="button"
                              onClick={() => openProgress(t.id)}
                              style={{
                                height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #111827",
                                background: "#111827", color: "#fff", cursor: "pointer"
                              }}
                            >
                              Выполнили на данный момент
                            </button>
                          </>
                        )}

                        {tab === "toMe" && mine && (
                          <>
                            <button
                              type="button"
                              onClick={() => markDone(t.id)}
                              style={{
                                height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #10b981",
                                background: "#10b981", color: "#fff", cursor: "pointer"
                              }}
                            >
                              Выполнено
                            </button>
                            <button
                              type="button"
                              onClick={() => goClarify(t.createdById, t.seq)}
                              style={{
                                height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb",
                                background: "#fff", cursor: "pointer"
                              }}
                            >
                              Уточнить
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
        .tile:hover { background: #fafafa; border-color: #d1d5db; }
      `}</style>

      {progressFor && (
        <div
          onClick={closeProgress}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 16, width: 520, maxWidth: "90vw" }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Выполнили на данный момент</div>

            {progressLoading && (<div style={{ color: "#6b7280" }}>Загрузка...</div>)}

            {!progressLoading && progressData && progressData.ok && (
              <>
                <div style={{ marginBottom: 10, color: "#374151" }}>
                  Готово: <b>{progressData.done}</b> из <b>{progressData.total}</b>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 160px", padding: "8px 10px", background: "#f9fafb", fontWeight: 700 }}>
                    <div>Исполнитель</div>
                    <div>Статус</div>
                    <div>Когда</div>
                  </div>
                  <div>
                    {progressData.assignees.map((a, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 160px", padding: "8px 10px", borderTop: "1px solid #e5e7eb" }}>
                        <div>{a.name}</div>
                        <div style={{ color: a.status === "done" ? "#10b981" : "#6b7280" }}>
                          {a.status === "done" ? "выполнено" : "в работе"}
                        </div>
                        <div style={{ color: "#6b7280" }}>
                          {a.doneAt ? fmtRuDate(a.doneAt) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!progressLoading && !progressData && (
              <div style={{ color: "#6b7280" }}>Не удалось получить данные прогресса.</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                type="button"
                onClick={closeProgress}
                style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
