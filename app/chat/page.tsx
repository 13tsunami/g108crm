// app/chat/page.tsx
"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type SimpleUser = { id: string; name: string | null; email?: string | null };
type Message = { id: string; text: string; createdAt: string; author: { id: string; name: string | null } };
type ThreadListItem = {
  id: string;
  peerId: string;
  peerName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount?: number;
};

const BRAND = "#8d2828";

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const fmt = (iso: string) => {
  const x = new Date(iso);
  return `${String(x.getDate()).padStart(2,"0")} ${MONTHS_RU[x.getMonth()]} ${x.getFullYear()}, ${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`;
};

const ls = (uid?: string) => ({ threads: `chat:u:${uid ?? "anon"}:threads`, last: `chat:u:${uid ?? "anon"}:last` });

function dedupeByPeer(list: ThreadListItem[]) {
  const byPeer = new Map<string, ThreadListItem>();
  for (const t of list) {
    const cur = byPeer.get(t.peerId);
    if (!cur) { byPeer.set(t.peerId, t); continue; }
    const a = t.lastMessageAt ? Date.parse(t.lastMessageAt) : 0;
    const b = cur.lastMessageAt ? Date.parse(cur.lastMessageAt) : 0;
    byPeer.set(t.peerId, a >= b ? t : cur);
  }
  const arr = Array.from(byPeer.values());
  arr.sort((a,b) => (b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0) - (a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0));
  return arr;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const meId = useMemo(() => (session?.user as any)?.id as string | undefined, [session?.user]);

  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [active, setActive] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // подпись «кто отправил последний» в списке тредов
  const [lastFromMe, setLastFromMe] = useState<Record<string, boolean>>({});

  // поиск по диалогу
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [hitIdx, setHitIdx] = useState(0);

  // выбранные файлы (UI только)
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // поиск людей
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<SimpleUser[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[] | null>(null);
  const [openDd, setOpenDd] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const ddPos = useRef<{ left: number; top: number; width: number } | null>(null);

  // тех
  const userSseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);
  const meIdRef = useRef<string | undefined>(undefined);
  const backoffRef = useRef(1000);
  const typingCooldownRef = useRef(0);
  const typingHideTimerRef = useRef<number | null>(null);

  // звук
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundAtRef = useRef(0);

  // скролл
  const paneRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const justOpenedRef = useRef(false);
  const isNearBottom = () => {
    const el = paneRef.current; if (!el) return true;
    return el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
  };
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => bottomRef.current?.scrollIntoView({ behavior });
  const jumpToBottomInstant = () => {
    const el = paneRef.current; if (!el) return;
    const prev = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollTop = el.scrollHeight;
    // вернуть smooth после кадра
    requestAnimationFrame(() => { el.style.scrollBehavior = prev || "smooth"; });
  };
  const scrollToMsg = (id: string) => {
    const el = msgRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  function headers(extra?: Record<string, string>) {
    const h: Record<string, string> = { ...(extra ?? {}) };
    if (meIdRef.current) h["X-User-Id"] = String(meIdRef.current);
    return h;
  }

  const styles = (
    <style>{`
      .chat-root { display: grid; grid-template-columns: 360px 1fr; min-height: 560px; }
      .threads { border-right: 1px solid #e5e7eb; font-size: 13px; }
      .thread { width: 100%; text-align: left; padding: 8px 44px 8px 12px; border-radius: 12px; border: 1px solid #e5e7eb; background: #fff; position: relative; cursor: pointer; }
      .thread + .thread { margin-top: 8px; }
      .thread--active { background: #eef2ff; border-color: #c7e3ff; }
      .thread--unread { background: #fff7ed; border-color: #fde68a; }
      .thread--unread::before { content:""; position:absolute; left:-1px; top:-1px; bottom:-1px; width:4px; background:#ef9b28; border-top-left-radius:12px; border-bottom-left-radius:12px; }
      .thread__last { color:#374151; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .thread__last--mine { text-align: right; }
      .badge { position:absolute; right:30px; top:4px; font-size:10px; background:${BRAND}; color:#fff; padding:0 5px; border-radius:9999px; } /* ещё меньше */

      .pane { display:grid; grid-template-rows: auto 1fr auto; }
      .pane-header { position:relative; padding:12px 12px 6px; border-bottom:1px solid #e5e7eb; min-height: 56px; }
      .pane-title { text-align:center; font-weight:700; }
      .pane-typing { position:absolute; right:12px; top:34px; color:#6b7280; font-size:12px; }
      .pane-search { position:absolute; right:12px; top:8px; width:220px; display:flex; gap:6px; }
      .pane-search input { width:100%; padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; outline:none; }
      .pane-search small { display:inline-block; min-width:42px; text-align:center; color:#6b7280; line-height:24px; }
      .pane-body { padding:12px; overflow:auto; height: 62vh; scroll-behavior: smooth; }
      .pane-footer { border-top:1px solid #e5e7eb; padding:12px; display:flex; gap:8px; align-items:flex-start; }

      .btn-del { position:absolute; right:6px; top:6px; width:10px; height:10px; background:${BRAND}; color:#fff; border:none; border-radius:2px; font-weight:800; line-height:10px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }

      .dd { position: fixed; background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 12px 16px rgba(0,0,0,.06), 0 4px 6px rgba(0,0,0,.04); z-index:60; max-height:260px; overflow:auto;}
      .dd-item { width:100%; text-align:left; padding:8px 10px; border:0; background:transparent; cursor:pointer; }

      .msgRow { display:flex; margin-bottom:10px; }
      .msgRow.mine { justify-content: flex-end; }
      .msgCard { max-width: 72%; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:8px 10px; display:flex; flex-direction:column; }
      .msgHead { display:flex; align-items:baseline; gap:6px; font-weight:700; }
      .msgRow.mine .msgHead { justify-content:flex-end; text-align:right; }
      .msgRow:not(.mine) .msgHead { justify-content:flex-start; text-align:left; }
      .msgMeta { color:#6b7280; font-weight:400; }
      .msgText { margin-top:6px; white-space: pre-wrap; word-break: break-word; }
      .msgSep { border-top:1px solid #e5e7eb; margin-top:8px; }

      .sendBtn { padding: 0 16px; border-radius: 10px; border: 1px solid ${BRAND}; background: ${BRAND}; color:#fff;
                 transition: transform .08s ease, box-shadow .08s ease, filter .08s ease; height: 64px; }
      .sendBtn:hover { box-shadow: 0 3px 10px rgba(0,0,0,.18); transform: translateY(-1px); filter: blur(0.2px) saturate(105%); }
      .sendBtn:active { transform: translateY(0); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
      .sendBtn:disabled { opacity:.6; cursor: default; filter:none; box-shadow:none; transform:none; }

      .plusBtn { width:40px; height:64px; border:1px dashed ${BRAND}; color:${BRAND}; background:#fff; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
      .plusBtn:hover { background: #fff5f5; }

      mark.chat-hl { background: #fef08a; padding: 0 2px; border-radius: 3px; }
      .fileChip { display:inline-flex; align-items:center; gap:6px; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px; margin-top:6px; margin-right:6px; font-size:12px; }
      .fileChip button { border:0; background:transparent; cursor:pointer; color:#6b7280; }
    `}</style>
  );

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      meIdRef.current = undefined;
      setThreads([]); setActive(null); setMessages([]);
      try { userSseRef.current?.close(); } catch {}
      userSseRef.current = null;
      if (pollRef.current !== null) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    meIdRef.current = meId;

    try {
      const cached = JSON.parse(localStorage.getItem(ls(meId).threads) || "[]");
      if (Array.isArray(cached)) setThreads(dedupeByPeer(cached));
      const last = localStorage.getItem(ls(meId).last) || "";
      if (last && Array.isArray(cached)) {
        const t = cached.find((x: ThreadListItem) => x.id === last);
        if (t) setActive(t);
      }
    } catch {}

    reloadThreads();
    preloadUsers();
    attachSSE();
    startPolling();
  }, [status, meId]);

  useEffect(() => {
    if (!meId) return;
    try {
      localStorage.setItem(ls(meId).threads, JSON.stringify(threads));
      window.dispatchEvent(new Event("g108:chat-threads-updated"));
    } catch {}
  }, [threads, meId]);

  // автопрокрутка в процессе общения (не при открытии)
  useEffect(() => {
    if (!active) return;
    if (justOpenedRef.current) return;
    const last = messages[messages.length - 1];
    const mine = last?.author?.id === meIdRef.current;
    if (mine || isNearBottom()) scrollToBottom("smooth");
  }, [messages, active?.id]);

  // поиск по диалогу
  useEffect(() => {
    if (!q.trim()) { setHits([]); setHitIdx(0); return; }
    const needle = q.toLocaleLowerCase("ru-RU");
    const ids = messages.filter(m => (m.text || "").toLocaleLowerCase("ru-RU").includes(needle)).map(m => m.id);
    setHits(ids);
    setHitIdx(0);
    if (ids.length) scrollToMsg(ids[0]);
  }, [q, messages]);

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hl = (text: string) => {
    const qt = q.trim();
    if (!qt) return text;
    const re = new RegExp(escapeRe(qt), "gi");
    return text.split(re).reduce<React.ReactNode[]>((acc, part, i, arr) => {
      acc.push(part);
      if (i < arr.length - 1) acc.push(<mark key={`hl-${i}`} className="chat-hl">{text.match(re)?.[0] ?? qt}</mark>);
      return acc;
    }, []);
  };

  async function reloadThreads() {
    const r = await fetch("/api/chat/threads/list", { cache: "no-store", headers: headers() }).catch(() => null);
    if (!r?.ok) return;
    let list: ThreadListItem[] = [];
    try { list = await r.json(); } catch {}
    setThreads(dedupeByPeer(Array.isArray(list) ? list : []));
    const last = localStorage.getItem(ls(meIdRef.current).last) || "";
    if (last) {
      const t = list.find(x => x.id === last);
      if (t) setActive(t);
    }
  }

  async function loadMessages(threadId: string) {
    justOpenedRef.current = true;
    const r = await fetch(`/api/chat/threads/${threadId}/messages`, { cache: "no-store", headers: headers() }).catch(() => null);
    if (!r?.ok) { justOpenedRef.current = false; return; }
    const data: Message[] = await r.json();
    setMessages(data);

    const last = data[data.length - 1];
    setLastFromMe(prev => ({ ...prev, [threadId]: !!last && last.author?.id === meIdRef.current }));

    const s = await fetch(`/api/chat/threads/${threadId}/read`, { method: "GET", headers: headers(), cache: "no-store" }).catch(() => null);
    if (s?.ok) {
      const json = await s.json() as { myReadAt: string | null; peerReadAt: string | null };
      setPeerReadAt(json.peerReadAt);
    }

    // сразу вниз — без плавной прокрутки
    setTimeout(() => {
      jumpToBottomInstant();
      // через кадр разрешаем «плавные» автоскроллы
      setTimeout(() => { justOpenedRef.current = false; }, 50);
    }, 0);
  }

  async function preloadUsers() {
    if (allUsers) return;
    try {
      const r = await fetch("/api/chat/users", { cache: "no-store", headers: headers() });
      if (r.ok) setAllUsers(await r.json());
    } catch {}
  }

  function playIncoming() {
    const el = audioRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < 300) return; // анти-спам
    lastSoundAtRef.current = now;
    // может быть заблокировано политикой браузера до первого взаимодействия — это ок
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  function attachSSE() {
    if (!meIdRef.current) return;
    try { userSseRef.current?.close(); } catch {}
    const es = new EventSource(`/api/chat/sse/user/${meIdRef.current}`);
    userSseRef.current = es;

    es.onopen = () => { backoffRef.current = 1000; };
    es.onerror = () => {
      try { userSseRef.current?.close(); } catch {}
      userSseRef.current = null;
      const d = Math.min(backoffRef.current, 15000);
      setTimeout(() => attachSSE(), d);
      backoffRef.current = Math.min(backoffRef.current * 2, 15000);
    };

    es.addEventListener("push", (ev: MessageEvent) => {
      try {
        const p = JSON.parse(ev.data);
        const tid: string | undefined = p?.threadId;
        if (!tid) return;

        if (p?.type === "thread-updated" || p?.type === "thread-deleted") {
          reloadThreads();
          if (active?.id === tid) loadMessages(tid);
          return;
        }

        if (p?.type === "message" && p.data) {
          const m: Message = p.data;
          const mine = m.author?.id === meIdRef.current;

          setLastFromMe(prev => ({ ...prev, [tid]: !!mine }));

          // звук только на входящие
          if (!mine) playIncoming();

          if (active?.id === tid) {
            setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
            if (!mine) fetch(`/api/chat/threads/${tid}/read`, { method: "POST", headers: headers() }).catch(() => {});
          }
          reloadThreads();
          return;
        }

        if (p?.type === "typing" && tid) {
          if (active?.id === tid) {
            setPeerTyping(true);
            if (typingHideTimerRef.current) clearTimeout(typingHideTimerRef.current);
            typingHideTimerRef.current = window.setTimeout(() => setPeerTyping(false), 3000);
          }
          return;
        }
      } catch {}
    });
  }

  function startPolling() {
    if (pollRef.current !== null) clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      reloadThreads();
      if (active?.id) loadMessages(active.id);
    }, 2000);
  }

  async function runSearch(q: string) {
    setSearch(q);
    const s = q.trim();
    if (!s) { setFound([]); setSearching(false); return; }
    setSearching(true);
    let result: SimpleUser[] = [];
    try {
      const r = await fetch(`/api/chat/search-users?q=${encodeURIComponent(s)}`, { cache: "no-store", headers: headers() });
      if (r.ok) { const arr = await r.json(); if (Array.isArray(arr)) result = arr; }
    } catch {}
    if ((!result || result.length === 0) && allUsers && allUsers.length) {
      const needle = s.toLocaleLowerCase("ru-RU");
      result = allUsers.filter(u =>
        (u.name || "").toLocaleLowerCase("ru-RU").includes(needle) ||
        (u.email || "").toLocaleLowerCase("ru-RU").includes(needle)
      ).slice(0, 20);
    }
    setFound(result);
    setSearching(false);
  }

  const placeDd = useCallback(() => {
    const el = searchRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    ddPos.current = { left: Math.round(r.left), top: Math.round(r.bottom + 6), width: Math.round(r.width) };
  }, []);
  useLayoutEffect(() => {
    if (!openDd) return;
    placeDd();
    const onResize = () => placeDd();
    const onScroll = () => placeDd();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onScroll, true); };
  }, [openDd, placeDd]);

  function openSearch() { setOpenDd(true); placeDd(); }
  function closeSearch() { setOpenDd(false); }

  useEffect(() => {
    if (!openDd) return;
    const onDown = (e: MouseEvent) => {
      const el = searchRef.current;
      const pos = ddPos.current;
      if (!el || !pos) return;
      const x = e.clientX; const y = e.clientY;
      const within = x >= pos.left && x <= pos.left + pos.width && y >= pos.top && y <= pos.top + 260;
      if (!within && !(el.contains(e.target as Node))) closeSearch();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openDd]);

  async function openWith(user: SimpleUser) {
    if (!user?.id) return;
    closeSearch(); setSearch(""); setFound([]);

    const existing = threads.find(t => t.peerId === user.id);
    if (existing) { selectThread(existing); return; }

    const r = await fetch("/api/chat/threads/ensure", {
      method: "POST", headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ otherUserId: user.id, otherName: user.name ?? null })
    }).catch(() => null);
    if (!r?.ok) { alert("Не удалось открыть чат"); return; }

    await reloadThreads();
    const fresh = await fetch("/api/chat/threads/list", { cache: "no-store", headers: headers() }).then(x => x.ok ? x.json() : []).catch(() => []) as ThreadListItem[];
    const t = (fresh || []).find(x => x.peerId === user.id) || (threads.find(x => x.peerId === user.id) ?? null);
    if (t) selectThread(t);
  }

  function selectThread(t: ThreadListItem) {
    setActive(t);
    try { localStorage.setItem(ls(meIdRef.current).last, t.id); } catch {}
    setQ(""); setHits([]); setHitIdx(0);
    setFiles([]);
    loadMessages(t.id);
    fetch(`/api/chat/threads/${t.id}/read`, { method: "POST", headers: headers() })
      .then(() => reloadThreads())
      .catch(() => {});
  }

  async function send() {
    if (!active || sending) return;
    const text = draft.trim(); if (!text) return; // логику не меняем — только текст

    setSending(true);
    try {
      const tempId = `tmp_${Date.now()}`;
      const tempMsg: Message = {
        id: tempId, text, createdAt: new Date().toISOString(),
        author: { id: meIdRef.current || "me", name: (session?.user?.name as string) ?? meIdRef.current ?? null },
      };
      setMessages(prev => [...prev, tempMsg]);
      setDraft("");
      setLastFromMe(prev => ({ ...prev, [active.id]: true }));

      const r = await fetch(`/api/chat/threads/${active.id}/messages`, {
        method: "POST", headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text })
      }).catch(() => null);

      if (!r?.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert("Не удалось отправить сообщение");
        return;
      }

      await loadMessages(active.id);
      await reloadThreads();
    } finally { setSending(false); }
  }

  async function removeThreadHard(tid: string) {
    const ok = window.confirm("Удалить диалог у обоих пользователей и стереть из базы?");
    if (!ok) return;
    const r = await fetch(`/api/chat/threads/${tid}?scope=both`, { method: "DELETE", headers: headers() }).catch(() => null);
    if (!r?.ok) { alert("Не удалось удалить диалог"); return; }
    if (active?.id === tid) { setActive(null); setMessages([]); }
    await reloadThreads();
  }

  function pingTyping() {
    const now = Date.now();
    if (!active || now < typingCooldownRef.current) return;
    typingCooldownRef.current = now + 1500;
    fetch("/api/chat/typing", {
      method: "POST", headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ threadId: active.id }),
    }).catch(() => {});
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16 }}>Нужна авторизация, чтобы использовать чаты.</section>;
  }

  return (
    <section style={{ fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial', fontSize: 14 }}>
      {styles}
      {/* звуковой элемент; положи mp3 в /public */}
      <audio ref={audioRef} src="/pressing-a-button-with-sound.mp3" preload="auto" />
      <div className="chat-root">
        <aside className="threads">
          <div style={{ padding: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => { setSearch(e.target.value); runSearch(e.target.value); }}
                onFocus={() => { setOpenDd(true); placeDd(); }}
                placeholder="Поиск сотрудника"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none" }}
              />
              {openDd && ddPos.current && (
                <div className="dd" style={{ left: ddPos.current.left, top: ddPos.current.top, width: ddPos.current.width }}>
                  {searching && <div style={{ padding: 12, color: "#6b7280" }}>Поиск…</div>}
                  {!searching && found.length === 0 && <div style={{ padding: 12, color: "#6b7280" }}>Ничего не найдено</div>}
                  {!searching && found.map(u => (
                    <button key={u.id} className="dd-item" onClick={() => openWith(u)} title={u.email || u.id}>
                      {u.name ?? u.email ?? u.id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontWeight: 700 }}>Диалоги</div>
            <div style={{ marginTop: 6 }}>
              {threads.map(t => {
                const isActive = active?.id === t.id;
                const unread = (t.unreadCount ?? 0) > 0;
                const fromMe = lastFromMe[t.id];
                const cls = `thread ${isActive ? "thread--active" : ""} ${unread && !isActive ? "thread--unread" : ""}`.trim();
                return (
                  <div key={t.id} style={{ position: "relative" }}>
                    <button className={cls} onClick={() => selectThread(t)}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: unread ? 700 : 600 }}>{t.peerName ?? t.peerId}</div>
                        {t.lastMessageAt && <div style={{ color:"#6b7280", fontSize:11 }}>{fmt(t.lastMessageAt)}</div>}
                      </div>
                      {t.lastMessageText && (
                        <div className={`thread__last ${fromMe ? "thread__last--mine" : ""}`}>
                          {fromMe === true ? "Вы: " : ""}
                          {t.lastMessageText}
                        </div>
                      )}
                      {(t.unreadCount ?? 0) > 0 && <span className="badge">{t.unreadCount}</span>}
                    </button>
                    <button className="btn-del" onClick={(e) => { e.stopPropagation(); removeThreadHard(t.id); }} title="Удалить диалог у обоих">×</button>
                  </div>
                );
              })}
              {!threads.length && <div style={{ color:"#6b7280", padding:8 }}>Пока нет диалогов. Найдите сотрудника выше, чтобы начать.</div>}
            </div>
          </div>
        </aside>

        <section className="pane">
          <div className="pane-header">
            <div className="pane-title">{active ? (active.peerName ?? active.peerId) : "Выберите собеседника"}</div>

            {/* поиск по диалогу */}
            <div className="pane-search" title="Поиск по диалогу">
              <input
                value={q}
                placeholder="поиск"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hits.length) {
                    const next = (hitIdx + 1) % hits.length;
                    setHitIdx(next);
                    scrollToMsg(hits[next]);
                  }
                }}
              />
              <small>{hits.length ? `${hitIdx + 1}/${hits.length}` : ""}</small>
              {q && <button onClick={() => { setQ(""); setHits([]); setHitIdx(0); }} title="Очистить">✕</button>}
            </div>

            {peerTyping && <div className="pane-typing">печатает…</div>}
          </div>

          <div className="pane-body" id="chat-scroll-area" ref={paneRef}>
            {!active && <div style={{ color:"#6b7280" }}>Нет сообщений</div>}
            {active && messages.map(m => {
              const mine = m.author?.id === meIdRef.current;
              const read = mine && peerReadAt ? Date.parse(peerReadAt) >= Date.parse(m.createdAt) : false;
              const ticks = mine ? (read ? "✓✓" : "✓") : "";
              const hasHit = q.trim() && (m.text || "").toLocaleLowerCase("ru-RU").includes(q.toLocaleLowerCase("ru-RU"));
              return (
                <div
                  key={m.id}
                  ref={(el) => { msgRefs.current[m.id] = el; }}  // callback ref: void
                  className={`msgRow ${mine ? "mine" : ""}`}
                  style={hasHit ? { outline: "2px solid #fde68a", borderRadius: 12 } : undefined}
                >
                  <div className="msgCard">
                    <div className="msgHead">
                      {!mine && <div>{m.author?.name ?? m.author?.id ?? "—"}</div>}
                      <div className="msgMeta">{fmt(m.createdAt)}</div>
                      {mine && <>
                        <div className="msgMeta" style={{ marginLeft:4 }}>{ticks}</div>
                        <div style={{ fontWeight:700 }}>{m.author?.name ?? m.author?.id ?? "—"}</div>
                      </>}
                    </div>
                    <div className="msgText">{hl(m.text)}</div>
                    <div className="msgSep" />
                  </div>
                </div>
              );
            })}
            {/* статус ТОЛЬКО под последним моим сообщением */}
            {active && (() => {
              const lastMine = [...messages].reverse().find(m => m.author?.id === meIdRef.current);
              const seen = lastMine && peerReadAt ? Date.parse(peerReadAt) >= Date.parse(lastMine.createdAt) : false;
              return lastMine ? (
                <div style={{ color:"#6b7280", fontSize:11, marginTop:6, textAlign:"right" }}>
                  {seen ? "Прочитано" : "Отправлено"}
                </div>
              ) : null;
            })()}
            <div ref={bottomRef} />
          </div>

          <div className="pane-footer">
            {/* плюсик — добавление файлов (UI) */}
            <button className="plusBtn" onClick={() => fileInputRef.current?.click()} title="Добавить файлы">+</button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => {
              const list = Array.from(e.target.files || []);
              setFiles(prev => [...prev, ...list]);
              e.currentTarget.value = "";
            }} />
            <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
              <textarea
                placeholder={active ? "Напишите сообщение…" : "Сначала выберите собеседника"}
                value={draft}
                onChange={e => { setDraft(e.target.value); pingTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } else pingTyping(); }}
                style={{ flex:1, height:64, resize:"vertical", padding:"10px 12px", border:"1px solid #e5e7eb", borderRadius:10, outline:"none" }}
                disabled={!active}
              />
              {!!files.length && (
                <div>
                  {files.map((f, i) => (
                    <span key={i} className="fileChip">
                      {f.name}
                      <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} aria-label="Убрать файл">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={send} disabled={!active || !draft.trim() || sending} className="sendBtn">
              {sending ? "Отправка…" : "Отправить"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
