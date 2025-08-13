// components/TaskForm.tsx
"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";

type SimpleUser  = { id: string; name: string | null; role?: string | null };
type SimpleGroup = { id: string; name: string };
type Candidate   = { type: "user" | "group"; id: string; name: string };

const BRAND = "#8d2828";

export default function TaskForm(props: {
  users: SimpleUser[];
  groups: SimpleGroup[];
  onCreated: () => void;
}) {
  const { users, groups, onCreated } = props;
  const { data: session } = useSession();
  const meId   = (session?.user as any)?.id as string | undefined;
  const meName = (session?.user as any)?.name as string | undefined; // ⬅︎

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [noCalendar, setNoCalendar] = useState(false);

  const [assignees, setAssignees] = useState<Candidate[]>([]);

  const allCandidates = useMemo<Candidate[]>(() => {
    const us: Candidate[] = (users || []).map(u => ({ type: "user", id: u.id, name: u.name || u.id }));
    // ⬅︎ если API по какой-то причине не вернул меня — добавим сами
    if (meId && !us.some(u => u.id === meId)) {
      us.unshift({ type: "user", id: meId, name: meName || "Я" });
    }
    const gs: Candidate[] = (groups || []).map(g => ({ type: "group", id: g.id, name: g.name || g.id }));
    return [...us, ...gs];
  }, [users, groups, meId, meName]); // ⬅︎ добавили зависимости

  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Candidate[]>([]);
  const [openDd, setOpenDd] = useState(false);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [ddPos, setDdPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const updateDdPos = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDdPos({ left: Math.round(r.left), top: Math.round(r.bottom + 6), width: Math.round(r.width) });
  }, []);

  useLayoutEffect(() => {
    if (!openDd) return;
    updateDdPos();
    const onScroll = () => updateDdPos();
    const onResize = () => updateDdPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [openDd, updateDdPos, query, assignees]);

  React.useEffect(() => {
    if (!openDd) return;
    const onDown = (e: MouseEvent) => {
      const el = chipsRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpenDd(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openDd]);

  function runSearch(q: string) {
    setQuery(q);
    const s = q.trim().toLocaleLowerCase("ru-RU");
    if (!s) { setFound([]); return; }
    const sel = new Set(assignees.map(a => `${a.type}:${a.id}`));
    const res = allCandidates
      .filter(c => c.name.toLocaleLowerCase("ru-RU").includes(s))
      .filter(c => !sel.has(`${c.type}:${c.id}`))
      .slice(0, 40);
    setFound(res);
  }

  function addAssignee(a: Candidate) {
    setAssignees(prev => prev.some(x => x.type === a.type && x.id === a.id) ? prev : [...prev, a]);
    setQuery("");
    setFound([]);
    setOpenDd(false);
    inputRef.current?.focus();
  }

  function removeAssignee(a: Candidate) {
    setAssignees(prev => prev.filter(x => !(x.type === a.type && x.id === a.id)));
    inputRef.current?.focus();
  }

  function toIsoDate(d: string) {
    if (!d) return null;
    return `${d}T00:00:00.000Z`;
  }

  async function resolveGroupMembers(groupId: string): Promise<string[]> {
    const tryUrls = [
      `/api/groups/${encodeURIComponent(groupId)}/members`,
      `/api/group-members?groupId=${encodeURIComponent(groupId)}`,
      `/api/groups/resolve?ids=${encodeURIComponent(groupId)}`
    ];
    for (const url of tryUrls) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const data = await r.json();
        if (Array.isArray(data)) {
          if (data.length && typeof data[0] === "string") return data as string[];
          return (data as any[]).map(x => x.userId || x.id).filter(Boolean);
        }
        if (data && Array.isArray(data.members)) {
          const m = data.members as any[];
          return m.map(x => x.userId || x.id).filter(Boolean);
        }
      } catch {}
    }
    return [];
  }

  async function expandAssigneesToUserIds(): Promise<string[]> {
    const userIds = new Set<string>();
    assignees.filter(a => a.type === "user").forEach(a => userIds.add(a.id));
    const groupsSel = assignees.filter(a => a.type === "group");
    for (const g of groupsSel) {
      const members = await resolveGroupMembers(g.id);
      members.forEach(id => userIds.add(id));
    }
    return Array.from(userIds);
  }

  async function submit() {
    const assigneeUserIds = await expandAssigneesToUserIds();
    const payload = {
      title,
      description: description || "",
      dueDate: toIsoDate(due),
      priority,
      hidden: !!noCalendar,
      assigneeUserIds,
      createdById: meId || null,
    };

    const r = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      alert(`Не удалось сохранить задачу${txt ? `: ${txt}` : ""}`);
      return;
    }

    setTitle(""); setDesc(""); setDue(""); setPriority("normal"); setNoCalendar(false);
    setAssignees([]); setQuery(""); setFound([]);
    onCreated();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: "grid", gap: 10 }}>
      <div>
        <label style={{ display: "block", marginBottom: 4 }}>Название</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none" }}
        />
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 4 }}>Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none", resize: "vertical" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Срок</label>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            required
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Приоритет</label>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="prio" checked={priority==="normal"} onChange={() => setPriority("normal")} />
              обычный
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="prio" checked={priority==="high"} onChange={() => setPriority("high")} />
              срочно
            </label>
          </div>
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 4 }}>Кому назначить</label>

        <div
          ref={chipsRef}
          onClick={() => inputRef.current?.focus()}
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            padding: 6,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            minHeight: 40,
            cursor: "text"
          }}
        >
          {assignees.map(a => (
            <span
              key={`${a.type}:${a.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px",
                fontSize: 12
              }}
              title={a.type === "group" ? "Группа" : "Пользователь"}
            >
              {a.name}{a.type === "group" ? " (группа)" : ""}
              <button
                type="button"
                onClick={() => removeAssignee(a)}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "#6b7280" }}
                aria-label="Убрать"
              >
                ×
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setOpenDd(true); runSearch(e.target.value); }}
            onFocus={() => { setOpenDd(true); updateDdPos(); }}
            placeholder="Поиск: ФИО или группа"
            style={{ flex: "1 0 180px", minWidth: 120, border: "none", outline: "none", padding: "6px 8px" }}
          />
        </div>

        {openDd && query.trim() && ddPos && typeof document !== "undefined" && createPortal(
          <div
            className="card"
            style={{
              position: "fixed",
              left: ddPos.left, top: ddPos.top, width: ddPos.width,
              zIndex: 10000, padding: 4, maxHeight: 260, overflowY: "auto"
            }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            {found.length === 0 && (
              <div style={{ padding: 8, color: "#6b7280" }}>Никого не нашли.</div>
            )}
            {found.map(x => (
              <button
                key={`${x.type}:${x.id}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addAssignee(x); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "none" }}
                title={x.name}
              >
                {x.name}{x.type === "group" ? " — группа" : ""}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <input
          id="noCal"
          type="checkbox"
          checked={noCalendar}
          onChange={(e) => setNoCalendar(e.currentTarget.checked)}
        />
        <label htmlFor="noCal">не размещать в календаре</label>
      </div>

      <div style={{ height: 4 }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          style={{
            height: 36, padding: "0 14px",
            borderRadius: 10, border: `1px solid ${BRAND}`,
            background: BRAND, color: "#fff", cursor: "pointer"
          }}
        >
          Сохранить задачу
        </button>
        <button
          type="button"
          onClick={() => { setTitle(""); setDesc(""); setDue(""); setPriority("normal"); setNoCalendar(false); setAssignees([]); setQuery(""); setFound([]); }}
          style={{
            height: 36, padding: "0 14px",
            borderRadius: 10, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer"
          }}
        >
          Очистить
        </button>
      </div>

      <style jsx>{`
        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }
      `}</style>
    </form>
  );
}
