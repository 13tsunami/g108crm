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
  const d = String(x.getDate()).padStart(2,"0");
  const m = MONTHS_RU[x.getMonth()];
  const Y = x.getFullYear();
  const hh = String(x.getHours()).padStart(2,"0");
  const mm = String(x.getMinutes()).padStart(2,"0");
  return `${d} ${m} ${Y}, ${hh}:${mm}`;
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

// серверный источник истины "кто я"
async function fetchMeFromServer(): Promise<{ id: string; name: string | null } | null> {
  try {
    const r = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.id) return { id: String(j.id), name: j?.name ?? null };
  } catch {}
  return null;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const sessionUserName = (session?.user?.name as string) ?? null;
  const sessionUserId = useMemo(() => (session?.user as any)?.id as string | undefined, [session?.user]);

  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [active, setActive] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [lastFromMe, setLastFromMe] = useState<Record<string, boolean>>({});

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [hitIdx, setHitIdx] = useState(0);

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<SimpleUser[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[] | null>(null);
  const [openDd, setOpenDd] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const ddPos = useRef<{ left: number; top: number; width: number } | null>(null);

  const userSseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);
  const meIdRef = useRef<string | undefined>(undefined);
  const backoffRef = useRef(1000);
  const typingCooldownRef = useRef(0);
  const typingHideTimerRef = useRef<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundAtRef = useRef(0);

  const paneRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      .glass {
        background: rgba(255,255,255,0.55);
        backdrop-filter: saturate(180%) blur(10px);
        -webkit-backdrop-filter: saturate(180%) blur(10px);
        border: 1px solid rgba(229,231,235,0.8);
        border-radius: 12px;
      }

      .chat-root { display: grid; grid-template-columns: 380px 1fr; min-height: 560px; gap: 12px; }
      .threads { border-right: 0; font-size: 13px; padding: 12px; }

      .block { padding: 12px; }
      .block + .block { margin-top: 12px; }
      .blockTitle { font-weight: 800; margin-bottom: 8px; }

      /* плитка диалога — выше, аккуратнее, с кнопкой удаления */
      .thread {
        width: 100%;
        text-align: left;
        padding: 14px 72px 14px 12px;   /* больше воздуха и отступ справа под значки */
        min-height: 76px;               /* ~1.5× выше */
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        background: #fff;
        position: relative;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
      }
      .thread + .thread { margin-top: 8px; }
      .thread:hover { transform: translateY(-1px); border-color: #c7e3ff; }
      .thread--active { background: #eef6ff; border-color: #c7e3ff; }
      .thread--unread { background: #fff7ed; border-color: #fde68a; }
      .thread--unread::before {
        content:""; position:absolute; left:-1px; top:-1px; bottom:-1px; width:4px;
        background:#ef9b28; border-top-left-radius:12px; border-bottom-left-radius:12px;
      }
      .thread__name { font-weight: 700; }
      .thread__last { color:#374151; overflow:hidden; display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .thread__last--mine { text-align: right; }

      /* индикатор непрочитанного не перекрывается */
      .badge {
        position:absolute; right: 44px; top: 8px;
        font-size: 11px; background:${BRAND}; color:#fff;
        padding: 0 7px; line-height: 20px; min-width: 22px; text-align:center;
        border-radius:9999px; box-shadow:0 1px 4px rgba(0,0,0,.12); font-weight: 800;
      }

      /* аккуратная кнопка удаления, видна при hover */
      .btn-del {
        position:absolute; right: 8px; top: 8px;
        width: 26px; height: 26px; border-radius: 8px;
        border: 1px solid #e5e7eb; background: rgba(255,255,255,0.85);
        display:inline-flex; align-items:center; justify-content:center;
        cursor:pointer; color:#6b7280; opacity: 0; transition: opacity 120ms ease, background 120ms ease;
      }
      .thread:hover .btn-del, .btn-del:focus-visible { opacity: 1; }
      .btn-del:hover { background: #fff; }
      .btn-del svg { width: 14px; height: 14px; }

      /* правая часть */
      .pane { padding: 12px; display:grid; grid-template-rows: auto 1fr auto; gap: 12px; }
      .pane-header { padding: 10px 12px; position:relative; min-height: 56px; display:flex; align-items:center; }
      .pane-title { flex:1; text-align:center; font-weight:700; }
      .pane-typing { position:absolute; right:12px; bottom:8px; color:#6b7280; font-size:12px; }
      .pane-search { position:absolute; right:12px; top:8px; width:220px; display:flex; gap:6px; }
      .pane-search input { width:100%; padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; outline:none; background:#fff; }
      .pane-search small { display:inline-block; min-width:42px; text-align:center; color:#6b7280; line-height:24px; }

      .pane-body { padding: 10px 12px; overflow: auto; height: 62vh; }
      .pane-footer { padding: 10px 12px; display:flex; gap:8px; align-items:flex-start; }

      .dd { position: fixed; background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 12px 16px rgba(0,0,0,.06), 0 4px 6px rgba(0,0,0,.04); z-index:60; max-height:260px; overflow:auto;}
      .dd-item { width:100%; text-align:left; padding:8px 10px; border:0; background:transparent; cursor:pointer; }

      /* сообщения */
      .msgRow { display:flex; margin-bottom:10px; }
      .msgRow.mine { justify-content: flex-end; }
      .msgCard {
        max-width: 72%;
        background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:8px 10px; display:flex; flex-direction:column;
        backdrop-filter: blur(2px);
      }
      .msgRow:not(.mine) .msgCard { background: rgba(169, 231, 255, 1); }
      .msgRow.mine .msgCard { background: #e6ffea; }

      .msgHead { display:flex; align-items:baseline; gap:6px; font-weight:700; }
      .msgRow.mine .msgHead { justify-content:flex-end; text-align:right; }
      .msgRow:not(.mine) .msgHead { justify-content:flex-start; text-align:left; }
      .msgAuthor { font-weight: 800; }
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

  // зачистка старой dev-куки uid (если вдруг ставилась ранее)
  useEffect(() => { document.cookie = "uid=; Max-Age=0; path=/"; }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (status === "loading") return;

      if (status !== "authenticated") {
        meIdRef.current = undefined;
        setThreads([]); setActive(null); setMessages([]);
        try { userSseRef.current?.close(); } catch {}
        userSseRef.current = null;
        if (pollRef.current !== null) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }

      // подтверждаем id через сервер; если /api/auth/me недоступен — fallback на session.user.id
      const meSrv = await fetchMeFromServer();
      const uid = meSrv?.id ?? sessionUserId;
      if (cancelled) return;

      meIdRef.current = uid;

      if (!meIdRef.current) {
        setThreads([]); setActive(null); setMessages([]);
        try { userSseRef.current?.close(); } catch {}
        userSseRef.current = null;
        if (pollRef.current !== null) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }

      try {
        const cached = JSON.parse(localStorage.getItem(ls(meIdRef.current).threads) || "[]");
        if (Array.isArray(cached)) setThreads(dedupeByPeer(cached));
        const last = localStorage.getItem(ls(meIdRef.current).last) || "";
        if (last && Array.isArray(cached)) {
          const t = cached.find((x: ThreadListItem) => x.id === last);
          if (t) setActive(t);
        }
      } catch {}

      reloadThreads();
      preloadUsers();
      attachSSE();
      startPolling();
    };

    boot();
    return () => { cancelled = true; };
  }, [status, sessionUserId]);

  useEffect(() => {
    const uid = meIdRef.current;
    if (!uid) return;
    try {
      localStorage.setItem(ls(uid).threads, JSON.stringify(threads));
      window.dispatchEvent(new Event("g108:chat-threads-updated"));
    } catch {}
  }, [threads]);

  useEffect(() => {
    if (!active) return;
    const last = messages[messages.length - 1];
    const mine = last?.author?.id === meIdRef.current;
    if (mine || isNearBottom()) scrollToBottom("smooth");
  }, [messages, active?.id]);

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
    if (!meIdRef.current) return;
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
    if (!meIdRef.current) return;
    const r = await fetch(`/api/chat/threads/${threadId}/messages`, { cache: "no-store", headers: headers() }).catch(() => null);
    if (!r?.ok) return;
    const data: Message[] = await r.json();
    setMessages(data);

    const last = data[data.length - 1];
    setLastFromMe(prev => ({ ...prev, [threadId]: !!last && last.author?.id === meIdRef.current }));

    const s = await fetch(`/api/chat/threads/${threadId}/read`, { method: "GET", headers: headers(), cache: "no-store" }).catch(() => null);
    if (s?.ok) {
      const json = await s.json() as { myReadAt: string | null; peerReadAt: string | null };
      setPeerReadAt(json.peerReadAt);
    }

    setTimeout(() => { jumpToBottomInstant(); }, 0);
  }

  async function preloadUsers() {
    if (!meIdRef.current || allUsers) return;
    try {
      const r = await fetch("/api/chat/users", { cache: "no-store", headers: headers() });
      if (r.ok) setAllUsers(await r.json());
    } catch {}
  }

  function playIncoming() {
    const el = audioRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < 300) return;
    lastSoundAtRef.current = now;
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
      if (!meIdRef.current) return;
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
    if (!meIdRef.current) return;
    const text = draft.trim(); if (!text) return;

    setSending(true);
    try {
      const tempId = `tmp_${Date.now()}`;
      const tempMsg: Message = {
        id: tempId, text, createdAt: new Date().toISOString(),
        author: { id: meIdRef.current, name: sessionUserName },
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
    if (!meIdRef.current) return;
    const now = Date.now();
    if (!active || now < typingCooldownRef.current) return;
    typingCooldownRef.current = now + 1500;
    fetch("/api/chat/typing", {
      method: "POST", headers: headers({ "Content-Type": "application/json" } ),
      body: JSON.stringify({ threadId: active.id }),
    }).catch(() => {});
  }

  if (status !== "authenticated") {
    return <section style={{ padding: 16 }}>Нужна авторизация, чтобы использовать чаты.</section>;
  }

  return (
    <section style={{ fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial', fontSize: 14 }}>
      {styles}
      <audio ref={audioRef} src="/pressing-a-button-with-sound.mp3" preload="auto" />
      <div className="chat-root">
        {/* ЛЕВАЯ КОЛОНКА */}
        <aside className="threads">
          {/* Поиск — glass */}
          <div className="block glass">
            <div className="blockTitle">Поиск</div>
            <div style={{ position: "relative" }}>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => { setSearch(e.target.value); runSearch(e.target.value); }}
                onFocus={() => { setOpenDd(true); placeDd(); }}
                placeholder="Поиск сотрудника"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none", background:"#fff" }}
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
          </div>

          {/* Диалоги — glass */}
          <div className="block glass">
            <div className="blockTitle">Диалоги</div>
            <div>
              {threads.map(t => {
                const isActive = active?.id === t.id;
                const unread = (t.unreadCount ?? 0) > 0;
                const fromMe = lastFromMe[t.id];
                const cls = `thread ${isActive ? "thread--active" : ""} ${unread && !isActive ? "thread--unread" : ""}`.trim();
                return (
                  <div key={t.id} style={{ position: "relative" }}>
                    <button className={cls} onClick={() => selectThread(t)}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                        <div className="thread__name">{t.peerName ?? t.peerId}</div>
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

                    {/* аккуратная кнопка удаления; не перекрывает badge */}
                    <button
                      className="btn-del"
                      onClick={(e) => { e.stopPropagation(); removeThreadHard(t.id); }}
                      title="Удалить диалог у обоих"
                      aria-label="Удалить диалог"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
              {!threads.length && <div style={{ color:"#6b7280", padding:8 }}>Пока нет диалогов. Найдите сотрудника выше, чтобы начать.</div>}
            </div>
          </div>
        </aside>

        {/* ПРАВАЯ КОЛОНКА */}
        <section className="pane">
          <div className="pane-header glass">
            <div className="pane-title">{active ? (active.peerName ?? active.peerId) : "Выберите собеседника"}</div>

            {/* поиск по текущему диалогу */}
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

          <div className="pane-body glass" id="chat-scroll-area" ref={paneRef}>
            {!active && <div style={{ color:"#6b7280" }}>Нет сообщений</div>}
            {active && messages.map(m => {
              const mine = m.author?.id === meIdRef.current;
              const read = mine && peerReadAt ? Date.parse(peerReadAt) >= Date.parse(m.createdAt) : false;
              const ticks = mine ? (read ? "✓✓" : "✓") : "";
              const hasHit = q.trim() && (m.text || "").toLocaleLowerCase("ru-RU").includes(q.toLocaleLowerCase("ru-RU"));
              const authorName = m.author?.name ?? m.author?.id ?? "—";
              return (
                <div
                  key={m.id}
                  ref={(el) => { msgRefs.current[m.id] = el; }}
                  className={`msgRow ${mine ? "mine" : ""}`}
                  style={hasHit ? { outline: "2px solid #fde68a", borderRadius: 12 } : undefined}
                >
                  <div className="msgCard">
                    <div className="msgHead">
                      <div className="msgAuthor">{authorName}</div>
                      {/* дата у ВСЕХ — сразу после ФИО */}
                      <div className="msgMeta">{fmt(m.createdAt)}</div>
                      {/* галочки — только у моих, сразу после даты */}
                      {mine && <div className="msgMeta" style={{ marginLeft:4 }}>{ticks}</div>}
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

          <div className="pane-footer glass">
            <button className="plusBtn" onClick={() => fileInputRef.current?.click()} title="Добавить файлы">+</button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                setFiles(prev => [...prev, ...list]);
                e.currentTarget.value = "";
              }}
            />
            <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
              <textarea
                placeholder={active ? "Напишите сообщение…" : "Сначала выберите собеседника"}
                value={draft}
                onChange={e => { setDraft(e.target.value); pingTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } else pingTyping(); }}
                style={{ flex:1, height:64, resize:"vertical", padding:"10px 12px", border:"1px solid #e5e7eb", borderRadius:10, outline:"none", background:"#fff" }}
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
            <button onClick={send} disabled={!active || !draft.trim() || sending || !meIdRef.current} className="sendBtn">
              {sending ? "Отправка…" : "Отправить"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
