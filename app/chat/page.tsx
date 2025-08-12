// app/chat/page.tsx
"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";

type SimpleUser = { id: string; name: string | null; email?: string | null };
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
  unreadCount?: number;
};

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const fmt = (iso: string) => {
  const x = new Date(iso);
  return `${String(x.getDate()).padStart(2,"0")} ${MONTHS_RU[x.getMonth()]} ${x.getFullYear()}, ${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`;
};

const lsKeys = (uid?: string) => ({
  threads: `chat:u:${uid ?? "anon"}:threads`,
  last: `chat:u:${uid ?? "anon"}:last`,
});

function mergeThreads(base: ThreadListItem[], incoming: ThreadListItem[]) {
  const map = new Map<string, ThreadListItem>();
  for (const t of base) map.set(t.id, t);
  for (const t of incoming) map.set(t.id, { ...(map.get(t.id) as any), ...t });
  const arr = Array.from(map.values());
  arr.sort((a,b) => (b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0) - (a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0));
  return arr;
}
function uniqueById(arr: ThreadListItem[]) {
  const seen = new Set<string>(); const out: ThreadListItem[] = [];
  for (const t of arr) if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
  return out;
}
// Доп. нормализация: если по ошибке приходят два личных треда с одним peerId — показываем самый свежий.
function dedupeByPeer(list: ThreadListItem[]) {
  const byPeer = new Map<string, ThreadListItem>();
  for (const t of list) {
    const cur = byPeer.get(t.peerId);
    if (!cur) byPeer.set(t.peerId, t);
    else {
      const curTs = cur.lastMessageAt ? Date.parse(cur.lastMessageAt) : 0;
      const nxtTs = t.lastMessageAt ? Date.parse(t.lastMessageAt) : 0;
      byPeer.set(t.peerId, nxtTs >= curTs ? t : cur);
    }
  }
  const arr = Array.from(byPeer.values());
  arr.sort((a,b) => (b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0) - (a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0));
  return arr;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [me, setMe] = useState<{ id?: string; name?: string | null } | null>(null);

  // --- поиск пользователей ---
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<SimpleUser[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // позиция дропдауна — рендерим порталом в body
  const [ddPos, setDdPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const updateDdPos = useCallback(() => {
    const el = searchInputRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setDdPos({ left: Math.round(r.left), top: Math.round(r.bottom + 6), width: Math.round(r.width) });
  }, []);
  useLayoutEffect(() => {
    if (!searchOpen) return;
    updateDdPos();
    const onScroll = () => updateDdPos();
    const onResize = () => updateDdPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [searchOpen, updateDdPos, search]);
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = searchInputRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setSearchOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  // --- список тредов и сообщений ---
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [active, setActive] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const userSseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);
  const backoffRef = useRef(1000);
  const meIdRef = useRef<string | undefined>(undefined);
  const typingCooldownRef = useRef<number>(0);
  const typingHideTimerRef = useRef<number | null>(null);

  // --- удаление (оптимистично + cooldown защиты от «воскрешения») ---
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const deletedCooldownRef = useRef<Map<string, number>>(new Map());
  const inCooldown = (id: string) => {
    const until = deletedCooldownRef.current.get(id);
    return !!until && until > Date.now();
  };
  const startCooldown = (id: string, ms = 5000) => {
    deletedCooldownRef.current.set(id, Date.now() + ms);
    window.setTimeout(() => {
      const until = deletedCooldownRef.current.get(id);
      if (until && until <= Date.now()) deletedCooldownRef.current.delete(id);
    }, ms + 50);
  };

  // --- защита от повторного ensure при быстром повторном выборе одного и того же собеседника ---
  const openInFlightRef = useRef<string | null>(null);

  function headersWithId(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...(extra ?? {}) };
    if (meIdRef.current) h["X-User-Id"] = String(meIdRef.current);
    return h;
  }

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      meIdRef.current = undefined;
      setMe(null);
      setThreads([]); setActive(null); setMessages([]);
      if (userSseRef.current) { userSseRef.current.close(); userSseRef.current = null; }
      if (pollRef.current !== null) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const uid = (session?.user as any)?.id as string | undefined;
    meIdRef.current = uid;
    setMe({ id: uid, name: session?.user?.name ?? null });
    // ➜ ДОБАВИТЬ: сохраняем uid в куку, чтобы все API (и ручные открытия URL)
// автоматически знали, кто делает запрос.
    if (uid) {
    document.cookie = `uid=${encodeURIComponent(uid)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }

    try {
      const k = lsKeys(uid);
      const cached = JSON.parse(localStorage.getItem(k.threads) || "[]");
      if (Array.isArray(cached) && cached.length) setThreads(dedupeByPeer(cached));
      const lastId = localStorage.getItem(k.last) || "";
      if (lastId && Array.isArray(cached)) {
        const t = cached.find((x: ThreadListItem) => x.id === lastId);
        if (t) setActive(t);
      }
    } catch {}

    reloadThreads();
    preloadUsers();
    attachSSE();
    startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id, session?.user?.name]);

  // синхронизация threads → localStorage (+событие для индикатора в сайдбаре)
  useEffect(() => {
    const uid = me?.id;
    if (!uid) return;
    try {
      const k = lsKeys(uid);
      localStorage.setItem(k.threads, JSON.stringify(threads));
      window.dispatchEvent(new Event("g108:chat-threads-updated"));
    } catch {}
  }, [threads, me?.id]);

  // ---------- ПОИСК ----------
  async function runSearch(q: string) {
    setSearch(q);
    const s = q.trim();
    if (!s) { setFound([]); setSearching(false); return; }

    try { searchAbortRef.current?.abort(); } catch {}
    const ac = new AbortController();
    searchAbortRef.current = ac;

    setSearching(true);
    let result: SimpleUser[] = [];
    try {
      const r = await fetch(`/api/chat/search-users?q=${encodeURIComponent(s)}`, { cache: "no-store", headers: headersWithId(), signal: ac.signal });
      if (r.ok) { const arr = await r.json(); if (Array.isArray(arr)) result = arr; }
    } catch {}

    if ((!result || result.length === 0) && allUsers && allUsers.length) {
      const needle = s.toLocaleLowerCase("ru-RU");
      result = allUsers
        .filter(u => (u.name || "").toLocaleLowerCase("ru-RU").includes(needle) || (u.email || "").toLocaleLowerCase("ru-RU").includes(needle))
        .slice(0, 20);
    }

    setFound(result);
    setSearching(false);
  }

  function pingTyping() {
    const now = Date.now();
    if (!active || now < typingCooldownRef.current) return;
    typingCooldownRef.current = now + 1500;
    fetch("/api/chat/typing", {
      method: "POST",
      headers: headersWithId({ "Content-Type": "application/json" }),
      body: JSON.stringify({ threadId: active.id }),
    }).catch(() => {});
  }

  async function reloadThreads() {
    const uid = meIdRef.current;
    const k = lsKeys(uid);

    const r = await fetch("/api/chat/threads/list", { cache: "no-store", headers: headersWithId() }).catch(() => null);

    if (r && r.ok) {
      let server: ThreadListItem[] = [];
      try { server = await r.json(); } catch {}
      const fromServer = dedupeByPeer((Array.isArray(server) ? server : []).filter(t => !inCooldown(t.id)));
      setThreads(fromServer);

      const lastId = localStorage.getItem(k.last) || "";
      if (lastId) {
        const t = fromServer.find(x => x.id === lastId) || null;
        if (t) setActive(t);
        else if (active && active.id && !fromServer.some(x => x.id === active.id)) {
          setActive(null);
          setMessages([]);
        }
      }
      return;
    }

    try {
      const cached: ThreadListItem[] = JSON.parse(localStorage.getItem(k.threads) || "[]");
      if (!threads.length && Array.isArray(cached)) setThreads(dedupeByPeer(cached.filter(t => !inCooldown(t.id))));
    } catch {}
  }

async function loadMessages(threadId: string) {
  if (inCooldown(threadId)) return;

  // важно: headersWithId() нужен, чтобы сервер применил clearedAt
  const r = await fetch(`/api/chat/threads/${threadId}/messages`, {
    cache: "no-store",
    headers: headersWithId(),
  }).catch(() => null);
  if (!r || !r.ok) return;

  const data: Message[] = await r.json();
  setMessages(data);
  queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));

  const s = await fetch(`/api/chat/threads/${threadId}/read`, {
    method: "GET",
    headers: headersWithId(),
    cache: "no-store",
  }).catch(() => null);
  if (s?.ok) {
    const json = await s.json() as { myReadAt: string | null; peerReadAt: string | null };
    setPeerReadAt(json.peerReadAt);
  }
}


  function attachSSE() {
    if (!meIdRef.current) return;
    if (userSseRef.current) { userSseRef.current.close(); userSseRef.current = null; }
    const es = new EventSource(`/api/chat/sse/user/${meIdRef.current}`);
    userSseRef.current = es;

    es.onopen = () => { backoffRef.current = 1000; };
    es.onerror = () => {
      if (userSseRef.current) { userSseRef.current.close(); userSseRef.current = null; }
      const delay = Math.min(backoffRef.current, 15000);
      window.setTimeout(() => attachSSE(), delay);
      backoffRef.current = Math.min(backoffRef.current * 2, 15000);
    };
    es.addEventListener("push", (ev: MessageEvent) => {
      try {
        const p = JSON.parse(ev.data);
        const tid = p?.threadId as string | undefined;
        if (tid && inCooldown(tid)) return;

        if (p?.type === "thread-updated") {
          reloadThreads();
          if (active?.id && tid === active.id) loadMessages(active.id);
        } else if (p?.type === "message" && tid && p.data) {
          if (active?.id === tid) {
            const m: Message = p.data;
            setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
            queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));
          } else {
            reloadThreads();
          }
        } else if (p?.type === "typing" && tid) {
          if (active?.id === tid) {
            setPeerTyping(true);
            if (typingHideTimerRef.current) window.clearTimeout(typingHideTimerRef.current);
            typingHideTimerRef.current = window.setTimeout(() => setPeerTyping(false), 3000);
          }
        }
      } catch {}
    });
  }

  function startPolling() {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      reloadThreads();
      if (active?.id) loadMessages(active.id);
    }, 2000);
  }

  async function preloadUsers() {
    if (allUsers) return;
    try {
      const r = await fetch("/api/chat/users", { cache: "no-store", headers: headersWithId() });
      if (r.ok) setAllUsers(await r.json());
    } catch {}
  }

  // ---------- ОТКРЫТИЕ ЧАТА ----------
  async function openWith(user: SimpleUser) {
    if (!user?.id) return;

    // если тред с этим собеседником уже существует — просто открываем его, без ensure
    const existing = threads.find(t => t.peerId === user.id);
    if (existing) {
      selectThread(existing);
      setSearch(""); setFound([]); setSearching(false); setSearchOpen(false);
      return;
    }

    // защита от повторного клонирования при дабл-клике/повторном выборе
    if (openInFlightRef.current === user.id) return;
    openInFlightRef.current = user.id;

    setSearch(""); setFound([]); setSearching(false); setSearchOpen(false);

    // оптимистично (временный тред)
    const optimistic: ThreadListItem = { id: `tmp_${user.id}`, peerId: user.id, peerName: user.name, lastMessageText: null, lastMessageAt: null, unreadCount: 0 };
    setThreads(prev => mergeThreads(prev, [optimistic]));
    setActive(optimistic);

    try {
      const r = await fetch("/api/chat/threads/ensure", {
        method: "POST",
        headers: headersWithId({ "Content-Type": "application/json" }),
        body: JSON.stringify({ otherUserId: user.id, otherName: user.name ?? null })
      });
      if (!r.ok) { alert("Не удалось открыть чат"); return; }
      const { threadId } = await r.json();

      const real: ThreadListItem = { ...optimistic, id: threadId };
      setActive(real);

      setThreads(prev => {
        const filtered = prev.filter(t => t.id !== optimistic.id && t.id !== threadId);
        return dedupeByPeer(uniqueById(mergeThreads(filtered, [real])));
      });

      try { localStorage.setItem(lsKeys(meIdRef.current).last, threadId); } catch {}

      const list: ThreadListItem[] = await fetch("/api/chat/threads/list", { cache: "no-store", headers: headersWithId() })
        .then(x => x.ok ? x.json() : []).catch(() => []);
      if (Array.isArray(list) && list.length) {
        const normalized = dedupeByPeer(list).filter(t => !inCooldown(t.id));
        setThreads(prev => dedupeByPeer(uniqueById(mergeThreads(prev, normalized))));
        const t = normalized.find(x => x.id === threadId) || null;
        if (t) setActive(t);
      }

      await loadMessages(threadId);
      await reloadThreads();
    } finally {
      openInFlightRef.current = null;
    }
  }

  // ---------- ОТПРАВКА (устойчиво + поддержка tmp_ треда) ----------
  async function send() {
    if (!active || sending) return;
    const text = draft.trim(); if (!text) return;

    setSending(true);
    try {
      let threadId = active.id;

      // если тред ещё временный — получаем реальный
      if (threadId.startsWith("tmp_")) {
        const r = await fetch("/api/chat/threads/ensure", {
          method: "POST",
          headers: headersWithId({ "Content-Type": "application/json" }),
          body: JSON.stringify({ otherUserId: active.peerId, otherName: active.peerName ?? null })
        });
        if (!r.ok) { alert("Не удалось открыть чат"); setSending(false); return; }
        const { threadId: realId } = await r.json();
        threadId = realId;

        setActive(prev => (prev ? { ...prev, id: realId } : prev));
        setThreads(prev => {
          const filtered = prev.filter(t => t.id !== active.id && t.id !== realId);
          return dedupeByPeer(uniqueById(mergeThreads(filtered, [{ ...active, id: realId }])));
        });
      }

      // оптимистичное сообщение
      const tempId = `tmp_${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        text,
        createdAt: new Date().toISOString(),
        author: { id: meIdRef.current || "me", name: me?.name ?? meIdRef.current ?? null },
      };
      setMessages(prev => [...prev, tempMsg]);
      setDraft("");
      queueMicrotask(() => endRef.current?.scrollIntoView({ block: "end" }));

      const r2 = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: headersWithId({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text })
      });

      if (!r2.ok) {
        // проверяем, не дошло ли фактически
        await loadMessages(threadId);
        const arrived = [...messages, tempMsg].reverse().find(m => m.author?.id === (meIdRef.current || "me") && m.text === text);
        if (!arrived) {
          // откатываем оптимизм и показываем ошибку
          setMessages(prev => prev.filter(m => m.id !== tempId));
          alert("Не удалось отправить сообщение");
          return;
        }
      }

      await loadMessages(threadId);
      await reloadThreads();

      fetch(`/api/chat/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: active.peerId, threadId })
      }).catch(() => {});
    } finally {
      setSending(false);
    }
  }

  async function markRead(threadId: string) {
    await fetch(`/api/chat/threads/${threadId}/read`, { method: "POST", headers: headersWithId() }).catch(() => {});
  }

  // ---------- ВЫБОР ТРЕДА — моментально снимаем «непрочитано» ----------
  function selectThread(t: ThreadListItem) {
    if (deleting.has(t.id) || inCooldown(t.id)) return;
    setActive(t);

    // моментально обнуляем счётчик локально — исчезают подсветка и бейдж, не ждём ответа сервера
    setThreads(prev => prev.map(x => x.id === t.id ? { ...x, unreadCount: 0 } : x));

    try { localStorage.setItem(lsKeys(meIdRef.current).last, t.id); } catch {}

    loadMessages(t.id);
    fetch(`/api/chat/threads/${t.id}/read`, { method: "POST", headers: headersWithId() })
      .then(() => reloadThreads())
      .catch(() => {});
  }

  // ---------- УДАЛЕНИЕ ----------
  async function removeThread(tid: string) {
    if (deleting.has(tid)) return;

    const okConfirm = window.confirm("Удалить диалог? Сообщения будут недоступны вам.");
    if (!okConfirm) return;

    if (tid.startsWith("tmp_")) {
      setThreads(prev => prev.filter(t => t.id !== tid));
      if (active?.id === tid) { setActive(null); setMessages([]); }
      startCooldown(tid, 2000);
      return;
    }

    setDeleting(prev => new Set(prev).add(tid));
    let snapshot: ThreadListItem[] | null = null;
    setThreads(prev => { snapshot = prev; return prev.filter(t => t.id !== tid); });
    if (active?.id === tid) { setActive(null); setMessages([]); }
    startCooldown(tid, 5000);

    try {
      const resp = await fetch(`/api/chat/threads/${tid}`, { method: "DELETE", headers: headersWithId() });
      if (!(resp.ok || resp.status === 404 || resp.status === 410)) {
        throw new Error(`DELETE failed: ${resp.status}`);
      }
      try { localStorage.removeItem(lsKeys(meIdRef.current).last); } catch {}
      await reloadThreads();
    } catch {
      if (snapshot) setThreads(snapshot);
    } finally {
      setDeleting(prev => { const next = new Set(prev); next.delete(tid); return next; });
    }
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16 }}>Нужна авторизация, чтобы использовать чаты.</section>;
  }

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", minHeight: 560 }}>
          <aside style={{ borderRight: "1px solid #e5e7eb", padding: 12 }}>
            <div style={{ color:"#374151", marginBottom: 6 }}>
              {me ? `Вы: ${me.name ?? meIdRef.current ?? "—"}` : "…"}
            </div>

            <div style={{ position: "relative" }}>
              <input
                ref={searchInputRef}
                placeholder="Поиск сотрудника"
                value={search}
                onChange={e => { setSearchOpen(true); runSearch(e.target.value); }}
                onFocus={() => { setSearchOpen(true); updateDdPos(); }}
                onKeyDown={e => { if (e.key === "Escape") { setSearchOpen(false); (e.currentTarget as HTMLInputElement).blur(); } }}
              />
              {(() => {
                const showDropdown = searchOpen && search.trim().length > 0 && (searching || found.length > 0);
                return showDropdown && ddPos && typeof document !== "undefined" && createPortal(
                  <div
                    className="card"
                    style={{
                      position: "fixed",
                      left: ddPos.left,
                      top: ddPos.top,
                      width: ddPos.width,
                      zIndex: 10000,
                      padding: 4,
                      maxHeight: 260,
                      overflowY: "auto"
                    }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    {searching && <div style={{ padding: 8, color: "#6b7280" }}>Поиск…</div>}
                    {!searching && found.length === 0 && <div style={{ padding: 8, color: "#6b7280" }}>Никого не нашли.</div>}
                    {found.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openWith(u); }}
                        style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", borderRadius:8, cursor:"pointer", background:"transparent", border:"none" }}
                        title={u.name ?? u.id}
                      >
                        {u.name ?? u.id}
                      </button>
                    ))}
                  </div>,
                  document.body
                );
              })()}
            </div>

            <div style={{ marginTop: 8, fontWeight: 700 }}>Диалоги</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {threads.map(t => {
                const isActive = active?.id === t.id;
                const unread = (t.unreadCount ?? 0) > 0;
                const isDel = deleting.has(t.id) || inCooldown(t.id);
                return (
                  <div key={t.id} style={{ position: "relative", opacity: isDel ? 0.6 : 1 }}>
                    <button
                      onClick={() => selectThread(t)}
                      disabled={isDel}
                      style={{
                        width:"100%", textAlign:"left", padding:"10px 36px 10px 12px",
                        borderRadius:12, border:"1px solid #e5e7eb",
                        background: isActive ? "#eef2ff" : unread ? "#fff7ed" : "transparent",
                        fontWeight: unread ? 700 : 400,
                        cursor: isDel ? "not-allowed" : "pointer"
                      }}>
                      <div>{t.peerName ?? t.peerId}</div>
                      {t.lastMessageText && (
                        <div style={{ color:"#374151", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {t.lastMessageText}
                        </div>
                      )}
                      {t.lastMessageAt && <div style={{ color:"#6b7280", marginTop:4, fontSize:11 }}>{fmt(t.lastMessageAt)}</div>}
                      {(t.unreadCount ?? 0) > 0 && (
                        <span style={{
                          position:"absolute", right:36, top:12, fontSize:11,
                          background:"#1d4ed8", color:"#fff", padding:"0 6px", borderRadius:9999
                        }}>{t.unreadCount}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isDel) removeThread(t.id); }}
                      title={isDel ? "Удаляется…" : "Удалить диалог"}
                      disabled={isDel}
                      style={{
                        position:"absolute", right:6, top:6,
                        width:22, height:22, borderRadius:6,
                        border:"1px solid #e5e7eb", background:"#fff",
                        cursor: isDel ? "not-allowed" : "pointer"
                      }}
                    >
                      {isDel ? "…" : "×"}
                    </button>
                  </div>
                );
              })}
              {!threads.length && <div style={{ color:"#6b7280", padding:8 }}>Пока нет диалогов. Найдите сотрудника выше, чтобы начать.</div>}
            </div>
          </aside>

          <section style={{ display:"grid", gridTemplateRows:"auto 1fr auto", minHeight:560 }}>
            <div style={{ padding:12, borderBottom:"1px solid #e5e7eb", fontWeight:700 }}>
              {active ? (active.peerName ?? active.peerId) : "Выберите собеседника"}
              {peerTyping && <span style={{ marginLeft:8, fontWeight:400, color:"#6b7280" }}>печатает…</span>}
            </div>

            <div style={{ padding:12, overflowY:"auto" }}>
              {!active && <div style={{ color:"#6b7280" }}>Нет сообщений</div>}
              {active && messages.map(m => {
                const mine = m.author?.id === meIdRef.current;
                const read = mine && peerReadAt ? Date.parse(peerReadAt) >= Date.parse(m.createdAt) : false;
                const ticks = mine ? (read ? "✓✓" : "✓") : "";
                return (
                  <div key={m.id} style={{ marginBottom:10, display:"flex", flexDirection:"column" }}>
                    <div style={{ fontWeight:700 }}>
                      {m.author?.name ?? m.author?.id ?? "—"}
                      <span style={{ color:"#6b7280", fontWeight:400 }}> · {fmt(m.createdAt)}</span>
                      {mine && <span style={{ marginLeft:8, color:"#374151" }}>{ticks}</span>}
                    </div>
                    <div style={{ whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.text}</div>
                    <div style={{ borderTop:"1px solid #e5e7eb", marginTop:8 }} />
                  </div>
                );
              })}
              {active && (() => {
                const lastMine = [...messages].reverse().find(m => m.author?.id === meIdRef.current);
                const seen = lastMine && peerReadAt ? Date.parse(peerReadAt) >= Date.parse(lastMine.createdAt) : false;
                return lastMine ? (
                  <div style={{ color:"#6b7280", fontSize:11, marginTop:6 }}>
                    {seen ? `Просмотрено: ${fmt(peerReadAt!)}` : "Отправлено"}
                  </div>
                ) : null;
              })()}
              <div ref={endRef} />
            </div>

            <div style={{ borderTop:"1px solid #e5e7eb", padding:12, display:"flex", gap:8 }}>
              <textarea
                placeholder="Напишите сообщение…"
                value={draft}
                onChange={e => { setDraft(e.target.value); pingTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } else pingTyping(); }}
                style={{ flex:1, height:64, resize:"vertical" }}
                disabled={!active}
              />
              <button className="btn-primary" onClick={send} disabled={!active || !draft.trim() || sending}>
                {sending ? "Отправка…" : "Отправить"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
