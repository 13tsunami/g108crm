// app/chat/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type SimpleUser = { id: string; name: string | null };
type Message = { id: string; text: string; createdAt: string; author: { id: string; name: string | null } };
type ThreadListItem = {
  id: string; peerId: string; peerName: string | null;
  lastMessageText: string | null; lastMessageAt: string | null;
  unreadCount?: number; peerReadAt?: string | null;
};

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function formatRuDateTimeISO(iso: string) {
  const x = new Date(iso); const dd = String(x.getDate()).padStart(2, "0"); const m = MONTHS_RU[x.getMonth()];
  const hh = String(x.getHours()).padStart(2, "0"); const mm = String(x.getMinutes()).padStart(2, "0");
  return `${dd} ${m} ${x.getFullYear()}, ${hh}:${mm}`;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [me, setMe] = useState<{ id?: string; name?: string | null } | null>(null);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<SimpleUser[]>([]);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [active, setActive] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  function h(): HeadersInit {
    const headers: Record<string, string> = {};
    if (me?.id) headers["X-User-Id"] = me.id;
    if (me?.name) headers["X-User-Name"] = String(me.name);
    return headers;
  }

  async function reloadThreads() {
    if (!me) return;
    const r = await fetch("/api/chat/threads/list", { cache: "no-store", headers: h() });
    if (r.ok) setThreads(await r.json());
  }

  useEffect(() => {
    if (status === "authenticated") {
      setMe({ id: (session.user as any)?.id, name: session.user?.name ?? null });
      reloadThreads();
    } else if (status === "unauthenticated") {
      setMe(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id, session?.user?.name]);

  async function runSearch(q: string) {
    setSearch(q);
    if (!q.trim() || !me) { setFound([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/chat/search-users?q=${encodeURIComponent(q)}`, { cache: "no-store", headers: h() });
      if (!r.ok) { setFound([]); return; }
      const txt = await r.text();
      if (!txt) { setFound([]); return; }
      let data: any;
      try { data = JSON.parse(txt); } catch { setFound([]); return; }
      setFound(Array.isArray(data) ? data : []);
    } catch {
      setFound([]);
    } finally {
      setSearching(false);
    }
  }

  async function openWith(user: SimpleUser) {
    if (!me) return;
    setFound([]); setSearch("");
    const r = await fetch("/api/chat/threads/ensure", {
      method: "POST", headers: { "Content-Type": "application/json", ...h() },
      body: JSON.stringify({ otherUserId: user.id })
    });
    if (!r.ok) { alert("Не удалось открыть чат"); return; }
    const { threadId } = await r.json();

    await reloadThreads();
    const list: ThreadListItem[] = await fetch("/api/chat/threads/list", { cache: "no-store", headers: h() }).then(x=>x.json());
    const t = list.find(x => x.id === threadId) || null;
    setActive(t);
    await loadMessages(threadId);
    attachSSE(threadId);
    await markRead(threadId);
    await reloadThreads();
  }

  async function loadMessages(threadId: string) {
    seenIdsRef.current.clear();
    const r = await fetch(`/api/chat/threads/${threadId}/messages`, { cache: "no-store" });
    if (r.ok) {
      const data: Message[] = await r.json();
      data.forEach(m => seenIdsRef.current.add(m.id));
      setMessages(data);
      queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));
      const s = await fetch(`/api/chat/threads/${threadId}/read`, { headers: h(), cache: "no-store" });
      if (s.ok) {
        const json = await s.json() as { myReadAt: string | null; peerReadAt: string | null };
        setPeerReadAt(json.peerReadAt);
      }
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
          const m = payload.data as Message;
          if (seenIdsRef.current.has(m.id)) return;
          seenIdsRef.current.add(m.id);
          setMessages(prev => [...prev, m]);
          queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));
        } else if (payload.type === "read") {
          const rd = payload.data as { userId: string; readAt: string };
          if (active && rd && rd.userId === active.peerId) setPeerReadAt(rd.readAt);
        }
      } catch {}
    };
  }

  async function send() {
    if (!active || !me) return;
    const text = draft.trim(); if (!text) return;
    const optimistic: Message = { id: `tmp_${Date.now()}`, text, createdAt: new Date().toISOString(), author: { id: me.id || "me", name: me.name ?? null } };
    setMessages(prev => [...prev, optimistic]); setDraft("");
    const r = await fetch(`/api/chat/threads/${active.id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json", ...h() }, body: JSON.stringify({ text })
    });
    if (!r.ok) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      alert("Не удалось отправить сообщение");
    } else {
      await loadMessages(active.id);
      await reloadThreads();
    }
  }

  async function markRead(threadId: string) {
    await fetch(`/api/chat/threads/${threadId}/read`, { method: "POST", headers: h() });
  }

  async function deleteThread(tid: string) {
    if (!confirm("Удалить диалог?")) return;
    const r = await fetch(`/api/chat/threads/${tid}`, { method: "DELETE", headers: h() });
    if (r.ok) {
      if (active?.id === tid) { setActive(null); setMessages([]); }
      await reloadThreads();
    } else {
      alert("Не удалось удалить диалог");
    }
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16 }}>Нужна авторизация, чтобы использовать чаты.</section>;
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
                <div className="card" style={{ position: "absolute", top: 34, left: 0, right: 0, zIndex: 50, padding: 4, maxHeight: 240, overflowY: "auto" }}>
                  {found.map(u => (
                    <div
                      key={u.id}
                      onMouseDown={() => openWith(u)}
                      role="button"
                      tabIndex={-1}
                      style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                    >
                      {u.name ?? u.id}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 8, fontWeight: 700 }}>Диалоги</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {threads.map(t => {
                const activeId = active?.id === t.id;
                const unread = (t.unreadCount ?? 0) > 0;
                return (
                  <div key={t.id} style={{ position: "relative" }}>
                    <button
                      onClick={async () => { setActive(t); await loadMessages(t.id); attachSSE(t.id); await markRead(t.id); await reloadThreads(); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "10px 36px 10px 12px",
                        borderRadius: 12, border: "1px solid #e5e7eb",
                        background: activeId ? "#eef2ff" : unread ? "#fff7ed" : "transparent",
                        fontWeight: unread ? 700 as any : 400
                      }}
                    >
                      <div>{t.peerName ?? t.peerId}</div>
                      {t.lastMessageText && <div style={{ color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.lastMessageText}</div>}
                      {t.lastMessageAt && <div style={{ color: "#6b7280", marginTop: 4, fontSize: 11 }}>{formatRuDateTimeISO(t.lastMessageAt)}</div>}
                      {unread && <span style={{ position:"absolute", right: 36, top: 12, fontSize: 11, background:"#1d4ed8", color:"#fff", padding:"0 6px", borderRadius: 9999 }}>{t.unreadCount}</span>}
                    </button>
                    <button onClick={() => deleteThread(t.id)} title="Удалить диалог"
                      style={{ position: "absolute", right: 6, top: 6, width: 22, height: 22, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" }}>×</button>
                  </div>
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
              {active && messages.map(m => {
                const mine = m.author?.id === me?.id;
                let ticks = "";
                if (mine) {
                  const read = peerReadAt && Date.parse(peerReadAt) >= Date.parse(m.createdAt);
                  ticks = read ? "✓✓" : "✓";
                }
                return (
                  <div key={m.id} style={{ marginBottom: 10, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>
                      {m.author?.name ?? m.author?.id ?? "—"} <span style={{ color:"#6b7280", fontWeight: 400 }}>· {formatRuDateTimeISO(m.createdAt)}</span>
                      {mine && <span style={{ marginLeft: 8, color: "#374151" }}>{ticks}</span>}
                    </div>
                    <div style={{ whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.text}</div>
                    <div style={{ borderTop:"1px solid #e5e7eb", marginTop: 8 }} />
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", padding: 12, display: "flex", gap: 8 }}>
              <textarea placeholder="Напишите сообщение…" value={draft} onChange={e=>setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                style={{ flex: 1, height: 64, resize: "vertical" }} disabled={!active} />
              <button className="btn-primary" onClick={send} disabled={!active || !draft.trim()}>Отправить</button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
