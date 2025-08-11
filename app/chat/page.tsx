// app/chat/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type SimpleUser = { id: string; name: string | null };
type Message = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string | null };
};
type ThreadListItem = {
  id: string;
  peerId: string;
  peerName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
};

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function formatRuDateTimeISO(iso: string) {
  const x = new Date(iso);
  const dd = String(x.getDate()).padStart(2, "0");
  const m = MONTHS_RU[x.getMonth()];
  const hh = String(x.getHours()).padStart(2, "0");
  const mm = String(x.getMinutes()).padStart(2, "0");
  return `${dd} ${m} ${x.getFullYear()}, ${hh}:${mm}`;
}

export default function ChatPage() {
  const meId = "me-dev";
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<SimpleUser[]>([]);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [active, setActive] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/chat/threads/list", { cache: "no-store" })
      .then(r => r.json()).then(setThreads).catch(()=>setThreads([]));
  }, []);

  async function runSearch(q: string) {
    setSearch(q);
    if (!q.trim()) { setFound([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/chat/search-users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data: SimpleUser[] = await r.json();
      setFound(data);
    } finally {
      setSearching(false);
    }
  }

  async function openWith(user: SimpleUser) {
    setFound([]);
    setSearch("");
    const r = await fetch("/api/chat/threads/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId: user.id })
    });
    if (!r.ok) { alert("Не удалось открыть чат"); return; }
    const { threadId } = await r.json();

    const list: ThreadListItem[] = await fetch("/api/chat/threads/list", { cache: "no-store" }).then(r=>r.json());
    setThreads(list);
    const t = list.find(x => x.id === threadId) || null;
    setActive(t);

    await loadMessages(threadId);
    attachSSE(threadId);
  }

  async function loadMessages(threadId: string) {
    const r = await fetch(`/api/chat/threads/${threadId}/messages`, { cache: "no-store" });
    if (r.ok) {
      const data: Message[] = await r.json();
      setMessages(data);
      queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));
    }
  }

  function attachSSE(threadId: string) {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    const es = new EventSource(`/api/chat/sse/${threadId}`);
    sseRef.current = es;
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === "message") {
          setMessages(prev => [...prev, payload.data as Message]);
          queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));
        }
      } catch {}
    };
  }

  async function send() {
    if (!active) return;
    const text = draft.trim();
    if (!text) return;
    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
      author: { id: meId, name: "Я" }
    };
    setMessages(prev => [...prev, optimistic]);
    setDraft("");
    const r = await fetch(`/api/chat/threads/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!r.ok) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      alert("Не удалось отправить сообщение");
    } else {
      const list: ThreadListItem[] = await fetch("/api/chat/threads/list", { cache: "no-store" }).then(r=>r.json());
      setThreads(list);
    }
  }

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", minHeight: 560 }}>
          <aside style={{ borderRight: "1px solid #e5e7eb", padding: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                placeholder="Поиск сотрудника"
                value={search}
                onChange={e => runSearch(e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />
              {!!found.length && (
                <div className="card" style={{ position: "absolute", top: 34, left: 0, right: 0, zIndex: 10, padding: 4, maxHeight: 240, overflowY: "auto" }}>
                  {found.map(u => (
                    <button
                      key={u.id}
                      onClick={() => openWith(u)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8 }}
                    >
                      {u.name ?? u.id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 8, fontWeight: 700 }}>Диалоги</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {threads.map(t => {
                const activeId = active?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={async () => { setActive(t); await loadMessages(t.id); attachSSE(t.id); }}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: activeId ? "#eef2ff" : "transparent"
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{t.peerName ?? t.peerId}</div>
                    {t.lastMessageText && (
                      <div style={{ color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.lastMessageText}
                      </div>
                    )}
                    {t.lastMessageAt && (
                      <div style={{ color: "#6b7280", marginTop: 4, fontSize: 11 }}>
                        {formatRuDateTimeISO(t.lastMessageAt)}
                      </div>
                    )}
                  </button>
                );
              })}
              {!threads.length && <div style={{ color:"#6b7280", padding: 8 }}>Пока нет диалогов. Найдите сотрудника выше, чтобы начать.</div>}
            </div>
          </aside>

          <section style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 560 }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>
              {active ? (active.peerName ?? active.peerId) : "Выберите собеседника"}
            </div>

            <div style={{ padding: 12, overflowY: "auto" }}>
              {!active && <div style={{ color:"#6b7280" }}>Нет сообщений</div>}
              {active && messages.map(m => (
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
                value={draft}
                onChange={e=>setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                style={{ flex: 1, height: 64, resize: "vertical" }}
                disabled={!active}
              />
              <button className="btn-primary" onClick={send} disabled={!active || !draft.trim()}>Отправить</button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
