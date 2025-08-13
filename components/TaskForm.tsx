"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";

type SimpleUser  = { id: string; name: string | null; role?: string | null; methodicalGroups?: string | null; subjects?: any };
type SimpleGroup = { id: string; name: string };
type SimpleSubject = { name: string; count?: number };
type Candidate   = { type: "user" | "group" | "role" | "subject"; id: string; name: string };

const BRAND = "#8d2828";

/* -------------------- ДАТЫ -------------------- */
const todayLocalYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const toIsoDate = (d: string) => (d ? `${d}T00:00:00.000Z` : null);

/* -------------------- ХЕЛПЕРЫ -------------------- */
const splitGroups = (s?: string | null) =>
  !s ? [] : s.split(/[,;]+/).map(x => x.trim()).filter(Boolean);

const norm = (s?: string | null) =>
  (s ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, " ")
    .trim();

function parseSubjects(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  const s = String(raw ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[") || s.startsWith("{")) {
    try { return parseSubjects(JSON.parse(s)); } catch { /* ignore */ }
  }
  return s.split(/[,;\/|]+/g).map((x) => x.trim()).filter(Boolean);
}

/** Канонизация ролей — строго по ТЗ */
function canonicalRole(label?: string | null): string | null {
  const s = norm(label);
  if (s === "директор" || s === "director") return "Директор";
  if (s === "заместитель+" || s === "заместитель плюс" || s === "deputy+" || s === "deputy_plus") return "Заместитель+";
  if (s === "заместитель" || s === "deputy") return "Заместитель";
  if (s === "педагог+" || s === "teacher+" || s === "teacher_plus" || s === "учитель+" || s === "педагог плюс") return "Педагог +";
  if (s === "педагог" || s === "teacher" || s === "учитель") return "Педагог";
  return null;
}

/* -------------------- МОДАЛКА -------------------- */
function Modal(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  width?: number;
}) {
  if (!props.open) return null;
  return createPortal(
    <div
      onClick={props.onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: props.width ?? 520,
          maxWidth: "94vw",
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 16px 40px rgba(0,0,0,0.2)"
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{props.title}</div>
        <div>{props.children}</div>
        {props.actions && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>{props.actions}</div>}
      </div>
    </div>,
    document.body
  );
}

/* -------------------- КОМПОНЕНТ -------------------- */
export default function TaskForm(props: {
  users: SimpleUser[];
  groups?: SimpleGroup[]; // опционально: если нет — подтянем из API
  onCreated: () => void;
}) {
  const { users, onCreated } = props;
  const { data: session } = useSession();
  const meId   = (session?.user as any)?.id as string | undefined;
  const meName = (session?.user as any)?.name as string | undefined;

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [noCalendar, setNoCalendar] = useState(false);

  // вложения (заглушка)
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // модалка «введите описание»
  const [needDescOpen, setNeedDescOpen] = useState(false);
  const [tmpDesc, setTmpDesc] = useState("");

  // роли/группы/предметы для пикера
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [groupsLocal, setGroupsLocal] = useState<SimpleGroup[]>(props.groups ?? []);
  const [dbGroupIds, setDbGroupIds] = useState<Set<string>>(new Set());
  const [subjectsLocal, setSubjectsLocal] = useState<SimpleSubject[]>([]);

  const todayStr = useMemo(() => todayLocalYMD(), []);

  // собрать роли из users (канонизированные)
  useEffect(() => {
    const setR = new Set<string>();
    (users || []).forEach(u => {
      const canon = canonicalRole(u.role);
      if (canon) setR.add(canon);
    });
    setRoles(Array.from(setR).sort((a,b)=>a.localeCompare(b,"ru")).map(n => ({ id: n, name: n })));
  }, [users]);

  // группы: если не пришли пропом — грузим из /api/groups; плюс fallback из methodicalGroups
  useEffect(() => {
    let alive = true;
    (async () => {
      const list: SimpleGroup[] = [];
      try {
        const r = await fetch("/api/groups?limit=5000", { cache: "no-store" });
        if (r.ok) {
          const arr = await r.json() as SimpleGroup[];
          if (alive && Array.isArray(arr)) {
            setGroupsLocal(arr);
            setDbGroupIds(new Set(arr.map(g => g.id)));
            return;
          }
        }
      } catch {}
      // fallback из users.methodicalGroups (без id)
      const setG = new Set<string>();
      (users || []).forEach(u => splitGroups(u.methodicalGroups).forEach(g => setG.add(g)));
      for (const name of Array.from(setG).sort((a,b)=>a.localeCompare(b,"ru"))) list.push({ id: name, name });
      if (alive) {
        setGroupsLocal(list);
        setDbGroupIds(new Set()); // нет айдишников БД
      }
    })();
    return () => { alive = false; };
  }, [props.groups, users]);

  // предметы — грузим из /api/subjects; fallback из users.subjects
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/subjects", { cache: "no-store" });
        if (r.ok) {
          const arr = await r.json() as Array<{ name: string; count?: number }>;
          if (alive && Array.isArray(arr)) { setSubjectsLocal(arr); return; }
        }
      } catch {}
      // fallback
      const setS = new Set<string>();
      (users || []).forEach(u => parseSubjects(u.subjects).forEach(s => setS.add(s)));
      const list = Array.from(setS).sort((a,b)=>a.localeCompare(b,"ru")).map(name => ({ name }));
      if (alive) setSubjectsLocal(list);
    })();
    return () => { alive = false; };
  }, [users]);

  // кандидаты в пикере
  const allCandidates = useMemo<Candidate[]>(() => {
    const us: Candidate[] = (users || []).map((u) => ({ type: "user", id: u.id, name: u.name || u.id }));
    if (meId && !us.some((u) => u.id === meId)) us.unshift({ type: "user", id: meId, name: meName || "Я" });
    const gs: Candidate[] = (groupsLocal || []).map((g) => ({ type: "group", id: g.id, name: g.name || g.id }));
    const rs: Candidate[] = (roles || []).map((r) => ({ type: "role", id: r.id, name: r.name }));
    const ss: Candidate[] = (subjectsLocal || []).map((s) => ({ type: "subject", id: s.name, name: s.name }));
    return [...us, ...gs, ...rs, ...ss];
  }, [users, groupsLocal, roles, subjectsLocal, meId, meName]);

  // состояние пикера
  const [assignees, setAssignees] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Candidate[]>([]);
  const [openDd, setOpenDd] = useState(false);

  function runSearch(q: string) {
    setQuery(q);
    const s = q.trim().toLocaleLowerCase("ru-RU");
    if (!s) { setFound([]); return; }
    const sel = new Set(assignees.map((a) => `${a.type}:${a.id}`));
    const res = allCandidates
      .filter((c) => c.name.toLocaleLowerCase("ru-RU").includes(s))
      .filter((c) => !sel.has(`${c.type}:${c.id}`))
      .slice(0, 60);
    setFound(res);
  }
  function addAssignee(a: Candidate) {
    setAssignees((prev) => (prev.some((x) => x.type === a.type && x.id === a.id) ? prev : [...prev, a]));
    setQuery(""); setFound([]); setOpenDd(false);
  }
  function removeAssignee(a: Candidate) {
    setAssignees((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)));
  }

  // кэши для предпросмотра (чтобы не дёргать одно и то же)
  const groupMembersCache = useRef<Map<string, string[]>>(new Map());
  const subjectMembersCache = useRef<Map<string, string[]>>(new Map());

  // разворачиваем выбранные элементы в userId (roles + groups + subjects), с кэшем
  async function expandAssigneesToUserIds(): Promise<string[]> {
    const userIds = new Set<string>();

    // явные пользователи
    assignees.filter((a) => a.type === "user").forEach((a) => userIds.add(a.id));

    // роли — локально из users.role
    const chosenRolesN = assignees.filter((a) => a.type === "role").map((a) => canonicalRole(a.id)).filter(Boolean) as string[];
    if (chosenRolesN.length) {
      (users || []).forEach((u) => {
        const canon = canonicalRole(u.role);
        if (canon && chosenRolesN.includes(canon)) userIds.add(u.id);
      });
    }
    // автор, если его роль подходит
    if (meId) {
      const meRoleCanon = canonicalRole(users.find(u => u.id === meId)?.role);
      if (meRoleCanon && chosenRolesN.includes(meRoleCanon)) userIds.add(meId);
    }

    // группы — предпочтительно через API (из БД), иначе fallback по methodicalGroups
    const chosenGroups = assignees.filter((a) => a.type === "group");
    const apiGroups = chosenGroups.filter(g => dbGroupIds.has(g.id));
    const localGroups = chosenGroups.filter(g => !dbGroupIds.has(g.id)).map(g => norm(g.id));

    // API-группы (с кэшем)
    for (const g of apiGroups) {
      const cached = groupMembersCache.current.get(g.id);
      if (cached) {
        cached.forEach(id => userIds.add(id));
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(`/api/groups/${g.id}/members`, { cache: "no-store" });
        if (r.ok) {
          // eslint-disable-next-line no-await-in-loop
          const arr = await r.json() as string[];
          if (Array.isArray(arr)) {
            groupMembersCache.current.set(g.id, arr);
            arr.forEach(id => userIds.add(String(id)));
          }
        }
      } catch {}
    }
    // fallback-группы (по строкам у пользователей)
    if (localGroups.length) {
      (users || []).forEach((u) => {
        const mg = splitGroups(u.methodicalGroups).map(norm);
        if (mg.some(g => localGroups.includes(g))) userIds.add(u.id);
      });
    }
    // автор, если его группы подходят (fallback-логика)
    if (meId && localGroups.length) {
      const meGroups = splitGroups(users.find(u => u.id === meId)?.methodicalGroups).map(norm);
      if (meGroups.length && localGroups.some(g => meGroups.includes(g))) userIds.add(meId);
    }

    // предметы — через API /subjects/:name/members (кэш) + fallback
    const chosenSubjects = assignees.filter((a) => a.type === "subject").map(a => a.id);
    for (const s of chosenSubjects) {
      const cached = subjectMembersCache.current.get(s);
      if (cached) {
        cached.forEach(id => userIds.add(id));
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(`/api/subjects/${encodeURIComponent(s)}/members`, { cache: "no-store" });
        if (r.ok) {
          // eslint-disable-next-line no-await-in-loop
          const arr = await r.json() as string[];
          if (Array.isArray(arr)) {
            subjectMembersCache.current.set(s, arr);
            arr.forEach(id => userIds.add(String(id)));
            continue;
          }
        }
        // локальный fallback на случай не-200
        (users || []).forEach((u) => {
          if (parseSubjects(u.subjects).includes(s)) userIds.add(u.id);
        });
      } catch {
        (users || []).forEach((u) => {
          if (parseSubjects(u.subjects).includes(s)) userIds.add(u.id);
        });
      }
    }
    // автор, если его предмет подходит (fallback)
    if (meId && chosenSubjects.length) {
      const me = users.find(u => u.id === meId);
      const mine = parseSubjects(me?.subjects);
      if (chosenSubjects.some(s => mine.includes(s))) userIds.add(meId);
    }

    return Array.from(userIds);
  }

  // ПРЕДПРОСМОТР — счётчик и брейкдаун (ролей/групп/предметов/пользователей)
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTotal, setPreviewTotal] = useState<number>(0);

  const recomputePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const ids = await expandAssigneesToUserIds();
      setPreviewTotal(ids.length);
    } finally {
      setPreviewLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignees, users, meId]);

  useEffect(() => {
    void recomputePreview();
  }, [assignees, recomputePreview]);

  // сабмит
  async function createTask() {
    // защита: срок не раньше сегодняшнего
    const todayStr = todayLocalYMD();
    if (!due || due < todayStr) { alert("Срок не может быть раньше сегодняшнего дня."); return; }

    const assigneeUserIds = await expandAssigneesToUserIds();
    const payload = {
      title,
      description: description || "",
      dueDate: toIsoDate(due),
      priority,
      hidden: !!noCalendar,           // поле для ограничения по календарю (позже доделаем)
      assigneeUserIds,
      createdById: meId || null,
      // attachmentsMeta: files.map(f => ({ name: f.name, size: f.size, type: f.type })), // заглушка, сервер пока игнорирует
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

    // reset
    setTitle(""); setDesc(""); setDue(""); setPriority("normal"); setNoCalendar(false);
    setAssignees([]); setQuery(""); setFound([]); setFiles([]);
    setPreviewTotal(0);
    onCreated();
  }

  function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!description.trim()) {
      setTmpDesc(description);
      setNeedDescOpen(true);
      return;
    }
    void createTask();
  }

  return (
    <>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Название</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none" }}/>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Описание</label>
          <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={4}
            placeholder="Кратко опишите задачу…"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none", resize: "vertical" }}/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Срок</label>
            <input type="date" value={due} min={todayStr} onChange={(e) => setDue(e.target.value)} required
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none" }}/>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Приоритет</label>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="radio" name="prio" checked={priority==="normal"} onChange={() => setPriority("normal")} /> обычный
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="radio" name="prio" checked={priority==="high"} onChange={() => setPriority("high")} /> срочно
              </label>
            </div>
          </div>
        </div>

        {/* ПРИКРЕПЛЕНИЕ ФАЙЛОВ — заглушка */}
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Файлы (пока заглушка)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: `1px solid ${BRAND}`,
                background: BRAND,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Выбрать файлы
            </button>
            {!!files.length && (
              <div style={{ marginTop: 2, border: "1px solid #f3f4f6", borderRadius: 8, padding: 8, background: "#fff" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Будут прикреплены позже:</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {files.map((f) => (
                    <li key={f.name} style={{ fontSize: 12 }}>
                      {f.name} <span style={{ color: "#6b7280" }}>({Math.round(f.size/1024)} КБ)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Кому назначить</label>
          <Chips
            assignees={assignees}
            setAssignees={setAssignees}
            found={found}
            setFound={setFound}
            openDd={openDd}
            setOpenDd={setOpenDd}
            allCandidates={allCandidates}
            query={query}
            setQuery={setQuery}
          />
          {/* Предпросмотр — итог уникальных исполнителей */}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>
              Предпросмотр: {previewLoading ? "подсчёт…" : `${previewTotal} исполнител${previewTotal % 10 === 1 && previewTotal % 100 !== 11 ? "ь" : "ей"}`}
            </span>
            <button
              type="button"
              onClick={() => void recomputePreview()}
              style={{ height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12 }}
            >
              Обновить
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <input id="noCal" type="checkbox" checked={noCalendar} onChange={(e) => setNoCalendar(e.currentTarget.checked)} />
          <label htmlFor="noCal">не размещать в календаре</label>
        </div>

        <div style={{ height: 4 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit"
            style={{ height: 36, padding: "0 14px", borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff", cursor: "pointer" }}>
            Сохранить задачу
          </button>
          <button type="button"
            onClick={() => { setTitle(""); setDesc(""); setDue(""); setPriority("normal"); setNoCalendar(false); setAssignees([]); setQuery(""); setFound([]); setFiles([]); setPreviewTotal(0); }}
            style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}>
            Очистить
          </button>
        </div>
      </form>

      {/* Модалка «внесите описание» */}
      <Modal
        open={needDescOpen}
        onClose={() => setNeedDescOpen(false)}
        title="Добавьте описание задачи"
        actions={
          <>
            <button
              onClick={() => setNeedDescOpen(false)}
              style={{ height: 32, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
            >
              Отмена
            </button>
            <button
              onClick={() => {
                const v = tmpDesc.trim();
                if (!v) return;
                setDesc(v);            // только переносим текст в основное поле
                setNeedDescOpen(false); // закрываем модалку, без автосабмита
              }}
              style={{ height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${BRAND}`, background: BRAND, color: "#fff", cursor: "pointer" }}
            >
              Сохранить
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 8 }}>
          Для постановки задачи нужно кратко описать, что требуется сделать.
        </div>
        <textarea
          value={tmpDesc}
          onChange={(e) => setTmpDesc(e.target.value)}
          rows={5}
          placeholder="Введите описание…"
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, outline: "none", resize: "vertical" }}
        />
      </Modal>
    </>
  );
}

/* -------------------- ПИКЕР (chips + dropdown) -------------------- */
function Chips(props: {
  assignees: Candidate[];
  setAssignees: React.Dispatch<React.SetStateAction<Candidate[]>>;
  found: Candidate[];
  setFound: React.Dispatch<React.SetStateAction<Candidate[]>>;
  openDd: boolean;
  setOpenDd: React.Dispatch<React.SetStateAction<boolean>>;
  allCandidates: Candidate[];
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { assignees, setAssignees, found, setFound, openDd, setOpenDd, allCandidates, query, setQuery } = props;
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [ddPos, setDdPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const updateDdPos = () => {
    const el = chipsRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDdPos({ left: Math.round(r.left), top: Math.round(r.bottom + 6), width: Math.round(r.width) });
  };

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
  }, [openDd, query, assignees]);

  useEffect(() => {
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
    const sel = new Set(assignees.map((a) => `${a.type}:${a.id}`));
    const res = allCandidates
      .filter((c) => c.name.toLocaleLowerCase("ru-RU").includes(s))
      .filter((c) => !sel.has(`${c.type}:${c.id}`))
      .slice(0, 60);
    setFound(res);
  }
  function addAssignee(a: Candidate) {
    setAssignees((prev) => (prev.some((x) => x.type === a.type && x.id === a.id) ? prev : [...prev, a]));
    setQuery(""); setFound([]); setOpenDd(false); inputRef.current?.focus();
  }
  function removeAssignee(a: Candidate) {
    setAssignees((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)));
    inputRef.current?.focus();
  }

  return (
    <>
      <div
        ref={chipsRef}
        onClick={() => inputRef.current?.focus()}
        style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, border: "1px solid #e5e7eb", borderRadius: 10, minHeight: 40, cursor: "text" }}
      >
        {assignees.map((a) => (
          <span
            key={`${a.type}:${a.id}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}
            title={a.type === "group" ? "Группа" : a.type === "role" ? "Роль" : a.type === "subject" ? "Предмет" : "Пользователь"}
          >
            {a.name}
            {a.type === "group" ? " (группа)" : a.type === "role" ? " (роль)" : a.type === "subject" ? " (предмет)" : ""}
            <button type="button" onClick={() => removeAssignee(a)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "#6b7280" }} aria-label="Убрать">×</button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setOpenDd(true); runSearch(e.target.value); }}
          onFocus={() => { setOpenDd(true); updateDdPos(); }}
          placeholder="Поиск: ФИО, группа, роль или предмет"
          style={{ flex: "1 0 180px", minWidth: 120, border: "none", outline: "none", padding: "6px 8px" }}
        />
      </div>

      {openDd && query.trim() && ddPos && typeof document !== "undefined" && createPortal(
        <div
          className="card"
          style={{ position: "fixed", left: ddPos.left, top: ddPos.top, width: ddPos.width, zIndex: 10000, padding: 4, maxHeight: 260, overflowY: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {found.length === 0 && (<div style={{ padding: 8, color: "#6b7280" }}>Никого не нашли.</div>)}
          {found.map((x) => (
            <button
              key={`${x.type}:${x.id}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addAssignee(x); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "none" }}
              title={x.name}
            >
              {x.name}{x.type === "group" ? " — группа" : x.type === "role" ? " — роль" : x.type === "subject" ? " — предмет" : ""}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
