// app/inboxTasks/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TaskForm from "@/components/TaskForm";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  hidden: boolean;
  priority: "high" | "normal";
};

type SimpleUser = { id: string; name: string | null };
type Message = {
  id: string;
  text: string;
  createdAt: string; // ISO
  author: { id: string; name: string | null };
};

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function formatRuDate(d: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, "0");
  const m = MONTHS_RU[x.getMonth()];
  return `${dd} ${m} ${x.getFullYear()}`;
}
function tsOf(d: string | null) {
  if (!d) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(d);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}
function formatRuDateTimeISO(iso: string) {
  const x = new Date(iso);
  const dd = String(x.getDate()).padStart(2, "0");
  const m = MONTHS_RU[x.getMonth()];
  const hh = String(x.getHours()).padStart(2, "0");
  const mm = String(x.getMinutes()).padStart(2, "0");
  return `${dd} ${m} ${x.getFullYear()}, ${hh}:${mm}`;
}

export default function InboxTasksPage() {
  const [tab, setTab] = useState<"inbox" | "tasks">("inbox");

  // ==== Чаты ====
  const meId = "me-dev"; // временно, пока не прикручен next-auth
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [q, setQ] = useState("");
  const [peer, setPeer] = useState<SimpleUser | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/users?excludeMe=1", { cache: "no-store" })
      .then(r => r.json())
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u => (u.name ?? "").toLowerCase().includes(s));
  }, [users, q]);

  async function ensureThreadAndOpen(u: SimpleUser) {
    setPeer(u);
    setMessages([]);
    setThreadId(null);
    const r = await fetch("/api/threads/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId: u.id, meId })
    });
    if (!r.ok) { alert("Не удалось открыть чат"); return; }
    const data = await r.json(); // { threadId }
    setThreadId(data.threadId);
  }

  useEffect(() => {
    if (!threadId) return;
    let stop = false;
    const load = async () => {
      const r = await fetch(`/api/threads/${threadId}/messages`, { cache: "no-store" });
      if (r.ok) {
        const data: Message[] = await r.json();
        if (!stop) {
          setMessages(data);
          queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));
        }
      }
    };
    load();
    const t = setInterval(load, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [threadId]);

  async function sendMessage() {
    const text = newMsg.trim();
    if (!text || !threadId) return;
    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
      author: { id: meId, name: "Я" }
    };
    setMessages(prev => [...prev, optimistic]);
    setNewMsg("");
    const r = await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, authorId: meId })
    });
    if (!r.ok) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      alert("Не удалось отправить сообщение");
    }
  }

  // ==== Задачи (как было) ====
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (tab !== "tasks") return;
    fetch("/api/tasks").then(r=>r.json()).then(setTasks).catch(()=>setTasks([]));
  }, [tab]);
  const sortedTasks = useMemo(() => [...tasks].sort((a,b)=>tsOf(a.dueDate)-tsOf(b.dueDate)), [tasks]);

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setTab("inbox")} className={tab === "inbox" ? "btn-primary" : ""}>Входящие</button>
        <button onClick={() => setTab("tasks")} className={tab === "tasks" ? "btn-primary" : ""}>Задачи</button>
      </div>

      {tab === "inbox" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", minHeight: 520 }}>
            <aside style={{ borderRight: "1px solid #e5e7eb", padding: 12 }}>
              <input
                placeholder="Поиск сотрудника"
                value={q}
                onChange={e=>setQ(e.target.value)}
                style={{ marginBottom: 8, width: "100%" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredUsers.map(u => {
                  const active = peer?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => ensureThreadAndOpen(u)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: active ? "#eef2ff" : "transparent"
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{u.name ?? u.id}</div>
                    </button>
                  );
                })}
                {!filteredUsers.length && <div style={{ color:"#6b7280", padding: 8 }}>Пользователи не найдены</div>}
              </div>
            </aside>

            <section style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 520 }}>
              <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>
                {peer ? (peer.name ?? peer.id) : "Выберите собеседника слева"}
              </div>

              <div style={{ padding: 12, overflowY: "auto" }}>
                {!threadId && <div style={{ color:"#6b7280" }}>Нет сообщений</div>}
                {threadId && messages.map(m => (
                  <div key={m.id} style={{ marginBottom: 10, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>
                      {m.author?.name ?? m.author?.id ?? "—"} <span style={{ color:"#6b7280", fontWeight: 400 }}>· {formatRuDateTimeISO(m.createdAt)}</span>
                    </div>
                    <div style={{ whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.text}</div>
                    <div style={{ borderTop:"1px solid #e5e7eb", marginTop: 8 }} />
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", padding: 12, display: "flex", gap: 8 }}>
                <textarea
                  placeholder="Напишите сообщение…"
                  value={newMsg}
                  onChange={e=>setNewMsg(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  style={{ flex: 1, height: 64, resize: "vertical" }}
                  disabled={!threadId}
                />
                <button className="btn-primary" onClick={sendMessage} disabled={!threadId || !newMsg.trim()}>Отправить</button>
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="grid" style={{ gridTemplateColumns: "380px 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Новая задача</h3>
            <TaskForm onCreated={() => fetch("/api/tasks").then(r=>r.json()).then(setTasks)} />
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 12, fontWeight: 700, fontSize: 18 }}>Все задачи</div>
            {sortedTasks.map((t, i) => (
              <div key={t.id} style={{ padding: 12, borderTop: i ? "1px solid #e5e7eb" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: t.priority === "high" ? "#c1121f" : "#111" }}>{t.title}</div>
                  <div style={{ whiteSpace: "nowrap", color: "#374151" }}>{formatRuDate(t.dueDate)}</div>
                </div>
                {t.description && <div style={{ marginTop: 6 }}>{t.description}</div>}
              </div>
            ))}
            {!sortedTasks.length && <div style={{ padding: 12 }}>Задач пока нет</div>}
          </div>
        </div>
      )}
    </section>
  );
}
