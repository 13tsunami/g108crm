"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

/** ====== ВИЗУАЛ ====== */
const BRAND = "#8d2828";
const BORDER = "#e5e7eb";
const TEXT_1 = "#111827";
const TEXT_2 = "#6b7280";
const BG = "#ffffff";
const BG_SOFT = "#fafafa";
const BG_TODAY = "#fff5f5";     // подсветка «сегодня»
const BG_SELECTED = "#fff9f5";  // подсветка выбранного дня
const BG_WEEKEND = "#fcfcff";   // лёгкая подсветка выходных
const OK = "#22c55e";           // зелёная галочка

/** ====== ТИПЫ ====== */
type TaskAssignee = { userId?: string; status?: string | null; user?: { id: string } | null };
type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;         // ISO
  priority?: "high" | "normal" | string | null;
  hidden?: boolean | null;
  createdById?: string | null;
  seq?: number | null;
  assignees?: TaskAssignee[];
};

type SimpleUser = { id: string; name: string | null; role?: string | null; roleSlug?: string | null };
type FilterMode = "assigned_to_me" | "created_by_me" | "all";

/** ====== ДАТЫ/ХЕЛПЕРЫ ====== */
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function ymd(d: Date) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 10);
}
function ruMonthYear(d: Date) {
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}
function ruDayMonth(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
function mondayOf(dateISO: string) {
  const d = new Date(dateISO);
  const dow = (d.getDay() + 6) % 7; // Пн=0
  const m = new Date(d);
  m.setDate(d.getDate() - dow);
  return m;
}
function weekCellsByISO(dateISO: string) {
  const monday = mondayOf(dateISO);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return { iso: ymd(x), day: x.getDate(), js: x };
  });
}
function monthCells(year: number, month: number) {
  const start = new Date(year, month, 1);
  const firstDow = (start.getDay() + 6) % 7; // Пн=0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { iso: string | null; day: number | null; js?: Date }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ iso: null, day: null });
  for (let d = 1; d <= days; d++) {
    const cur = new Date(year, month, d);
    cells.push({ iso: ymd(cur), day: d, js: cur });
  }
  while (cells.length % 7) cells.push({ iso: null, day: null });
  return cells;
}
function toYMDFromISO(dt?: string | null) {
  if (!dt) return null;
  try { return ymd(new Date(dt)); } catch { return null; }
}
function weekRangeLabel(dateISO: string) {
  const s = mondayOf(dateISO);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${ruMonthYear(e)}`;
  }
  return `${ruDayMonth(s)} — ${ruDayMonth(e)} ${e.getFullYear()}`;
}
function orderKey(t: Task) {
  const pr = (t.priority === "high" ? 0 : 1);
  const seq = t.seq ?? Number.MAX_SAFE_INTEGER;
  const id = t.id || "";
  return { pr, seq, id };
}
function assigneeIds(t: Task): string[] {
  const out = new Set<string>();
  if (Array.isArray(t.assignees)) {
    for (const a of t.assignees) {
      const uid = a.userId ?? a.user?.id;
      if (uid) out.add(String(uid));
    }
  }
  return Array.from(out);
}
function isDoneByViewer(t: Task, meId?: string) {
  if (!meId || !Array.isArray(t.assignees)) return false;
  const me = t.assignees.find(a => (a.userId ?? a.user?.id) === meId);
  return !!me && (me.status === "done");
}
function byDayMap(tasks: Task[]) {
  const m = new Map<string, Task[]>();
  for (const t of tasks) {
    const day = toYMDFromISO(t.dueDate);
    if (!day) continue;
    const list = m.get(day) ?? [];
    list.push(t);
    m.set(day, list);
  }
  for (const [k, list] of m) {
    list.sort((a, b) => {
      const A = orderKey(a); const B = orderKey(b);
      if (A.pr !== B.pr) return A.pr - B.pr;
      if (A.seq !== B.seq) return A.seq - B.seq;
      return A.id.localeCompare(B.id);
    });
  }
  return m;
}

/** ====== КОМПОНЕНТ ====== */
export default function CalendarWithAdd() {
  const { data: session } = useSession();
  const meId = (session?.user as any)?.id as string | undefined;

  // пользователи — для имён и проверки «кто назначил»
  const [users, setUsers] = React.useState<SimpleUser[]>([]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/users", { cache: "no-store" });
        const j = r.ok ? (await r.json()) as SimpleUser[] : [];
        if (alive) setUsers(Array.isArray(j) ? j : []);
      } catch {
        if (alive) setUsers([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // состояние
  const [view, setView] = React.useState<"week" | "month">("week"); // старт — НЕДЕЛЯ
  const [cursor, setCursor] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = React.useState(ymd(new Date()));
  const [filter, setFilter] = React.useState<FilterMode>("assigned_to_me");
  const [q, setQ] = React.useState(""); // поиск по маске

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [reload, setReload] = React.useState(0);
  const [actionBusy, setActionBusy] = React.useState<string | null>(null); // id задачи, которую «выполняем»

  // всплывашка по клику на задачу
  const [popover, setPopover] = React.useState<{ open: boolean; task?: Task | null; anchor?: DOMRect | null }>(
    { open: false, task: null, anchor: null }
  );
  function openTaskPopover(e: React.MouseEvent, t: Task) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ open: true, task: t, anchor: rect });
  }
  function closePopover() { setPopover({ open: false, task: null, anchor: null }); }

  // закрытие по Esc
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") closePopover(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ====== Загрузка задач ======
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/tasks", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const arr = (await r.json()) as Task[];
        if (!alive) return;
        const normalized = (Array.isArray(arr) ? arr : []).map((t) => ({
          ...t,
          priority: (t.priority === "high" ? "high" : "normal") as "high" | "normal",
          hidden: !!t.hidden,
        }));
        setTasks(normalized);
      } catch {
        if (alive) setTasks([]);
      }
    })();
    return () => { alive = false; };
  }, [reload]);

  // ====== Навигация стрелками ======
  function shiftLeft() {
    if (view === "week") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      const iso = ymd(d);
      setSelectedDate(iso);
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    }
  }
  function shiftRight() {
    if (view === "week") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7);
      const iso = ymd(d);
      setSelectedDate(iso);
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    }
  }

  // ====== Фильтрация ======
  const filtered = React.useMemo(() => {
    const base = tasks.filter(t => {
      if (t.hidden) return false;                  // ⛔ скрытые НЕ показываем в календаре
      if (isDoneByViewer(t, meId)) return false;  // не показываем мои «выполнено»
      if (!t.dueDate) return false;               // календарь только по датам
      return true;
    });

    let arr: Task[] = base;
    if (filter === "assigned_to_me" && meId) {
      arr = base.filter(t => assigneeIds(t).includes(meId));
    } else if (filter === "created_by_me" && meId) {
      arr = base.filter(t => t.createdById === meId);
    }

    const qq = q.trim().toLowerCase();
    if (!qq) return arr;

    return arr.filter(t => {
      const title = (t.title ?? "").toLowerCase();
      const desc  = (t.description ?? "").toLowerCase();
      return title.includes(qq) || desc.includes(qq);
    });
  }, [tasks, meId, filter, q]);

  // ====== Гриды ======
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthGrid = React.useMemo(() => monthCells(year, month), [year, month]);
  const weekGrid  = React.useMemo(() => weekCellsByISO(selectedDate), [selectedDate]);

  const mapByDay = React.useMemo(() => byDayMap(filtered), [filtered]);

  // ====== Действия ======
  async function markDone(t: Task) {
    if (!meId) return;
    try {
      setActionBusy(t.id);
      const res = await fetch(`/api/tasks/${t.id}/assignees/${meId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        alert(`Не удалось отметить выполненной${txt ? `: ${txt}` : ""}`);
        return;
      }
      setReload(v => v + 1);
      closePopover();
    } finally {
      setActionBusy(null);
    }
  }

  // ====== UI ======
  const headerLabel = view === "week" ? weekRangeLabel(selectedDate) : ruMonthYear(new Date(year, month, 1));

  return (
    <div style={{ fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial', fontSize: 13, padding: 14 }}>
      <style>{`
        .btn {
          height: 32px; padding: 0 12px; border-radius: 10px;
          border: 1px solid ${BORDER}; background: #fff; cursor: pointer;
        }
        .btn-primary {
          height: 32px; padding: 0 12px; border-radius: 10px;
          border: 1px solid ${BRAND}; background: ${BRAND}; color: #fff; cursor: pointer; font-weight: 700;
        }
        .btn-outline {
          height: 32px; padding: 0 12px; border-radius: 10px;
          border: 1px solid ${BRAND}; background: #fff; color: ${BRAND}; cursor: pointer; font-weight: 700;
        }
        .input {
          height: 32px; padding: 0 10px; border-radius: 10px; border: 1px solid ${BORDER}; outline: none; background: #fff;
        }
      `}</style>

      {/* Хедер */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button className="btn" onClick={shiftLeft}>‹</button>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{headerLabel}</div>
        <button className="btn" onClick={shiftRight}>›</button>

        <div style={{ marginLeft: 16, display: "flex", gap: 6 }}>
          <button className={view === "week" ? "btn-primary" : "btn"} onClick={() => setView("week")}>
            Неделя
          </button>
          <button className={view === "month" ? "btn-primary" : "btn"} onClick={() => setView("month")}>
            Месяц
          </button>
        </div>

        <div style={{ marginLeft: 16, display: "inline-flex", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <SegBtn active={filter==="assigned_to_me"} onClick={() => setFilter("assigned_to_me")}>Назначенные мне</SegBtn>
          <SegBtn active={filter==="created_by_me"} onClick={() => setFilter("created_by_me")}>Назначенные мной</SegBtn>
          <SegBtn active={filter==="all"} onClick={() => setFilter("all")}>Все задачи</SegBtn>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Поиск по задачам…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input"
            style={{ width: 320 }}
          />
        </div>
      </div>

      {/* Сетка */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, alignItems: "start" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontWeight: 800, textAlign: "center", padding: 6, color: TEXT_1 }}>
            {w}
          </div>
        ))}

        {(view === "week" ? weekGrid : monthGrid).map((c, i) => (
          <DayCell
            key={i}
            iso={c.iso}
            day={c.day}
            jsDate={c.js}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            mapByDay={mapByDay}
            onTaskClick={openTaskPopover}
          />
        ))}
      </div>

      {/* POPUP по клику на задачу */}
      {popover.open && popover.task && (
        <SmartPopover anchor={popover.anchor} onClose={closePopover}>
          <TaskDetailsCard
            task={popover.task}
            users={users}
            filter={filter}
            meId={meId}
            actionBusy={actionBusy}
            onMarkDone={markDone}
            onClose={closePopover}
          />
        </SmartPopover>
      )}
    </div>
  );
}

/** День (ячейка сетки) с подсветкой сегодня/выбранного/выходных */
function DayCell(props: {
  iso: string | null;
  day: number | null;
  jsDate?: Date;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  mapByDay: Map<string, Task[]>;
  onTaskClick: (e: React.MouseEvent, t: Task) => void;
}) {
  const { iso, day, jsDate, selectedDate, setSelectedDate, mapByDay, onTaskClick } = props;
  const todayIso = ymd(new Date());
  const isToday = iso && iso === todayIso;
  const isSelected = iso && iso === selectedDate;

  const isWeekend = jsDate ? [0,6].includes(jsDate.getDay()) : false; // вс=0, сб=6
  const list = (iso ? (mapByDay.get(iso) ?? []) : []) as Task[];

  return (
    <div
      onClick={() => { if (iso) setSelectedDate(iso); }}
      style={{
        border: `1px solid ${isToday ? BRAND : BORDER}`,
        padding: 10,
        background: iso ? (isSelected ? BG_SELECTED : isToday ? BG_TODAY : (isWeekend ? BG_WEEKEND : BG)) : BG,
        borderRadius: 12,
        transition: "background 120ms ease",
        cursor: iso ? "pointer" : "default",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, color: TEXT_2, marginBottom: 6 }}>
        {day ?? ""}
      </div>
      <div>
        {list.map((t) => (
          <TaskPill key={t.id} t={t} onClick={onTaskClick} />
        ))}
      </div>
    </div>
  );
}

/** Пилюля задачи (компактная) */
function TaskPill({ t, onClick }: { t: Task; onClick: (e: React.MouseEvent, t: Task) => void }) {
  const urgent = t.priority === "high";
  return (
    <button
      type="button"
      onClick={(e) => onClick(e, t)}
      title={t.title}
      style={{
        width: "100%",
        textAlign: "left",
        border: `1px solid ${urgent ? BRAND : BORDER}`,
        background: urgent ? `${BRAND}0D` : BG_SOFT,
        color: TEXT_1,
        borderRadius: 10,
        padding: "6px 8px",
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 6,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {t.title}
    </button>
  );
}

/** Карточка деталей в поповере (бренд-стиль + рамка текста, авто-рост) */
function TaskDetailsCard(props: {
  task: Task;
  users: SimpleUser[];
  filter: FilterMode;
  meId?: string;
  actionBusy: string | null;
  onMarkDone: (t: Task) => void;
  onClose: () => void;
}) {
  const { task: t, users, filter, meId, actionBusy, onMarkDone } = props;

  const assignedBy = React.useMemo(() => {
    if (!t.createdById) return null;
    return users.find(x => x.id === t.createdById) || null;
  }, [t, users]);

  const canMarkDone = React.useMemo(() => {
    if (!t || !meId) return false;
    const my = t.assignees?.find(a => (a.userId ?? a.user?.id) === meId);
    return !!my && my.status !== "done";
  }, [t, meId]);

  const showAssigneesList = filter === "created_by_me" && Array.isArray(t.assignees) && t.assignees.length > 0;
  const assigneesResolved = React.useMemo(() => {
    if (!Array.isArray(t.assignees)) return [];
    return t.assignees.map(a => {
      const id = a.userId ?? a.user?.id ?? "";
      const u = users.find(x => x.id === id);
      return { id, name: u?.name ?? id, done: a.status === "done" };
    });
  }, [t, users]);

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{t.title}</div>

      <Row label="Назначил">
        <span style={{ fontWeight: 700, color: TEXT_1 }}>
          {assignedBy?.name ?? "неизвестно"}
        </span>
      </Row>

      <Row label="Срок">
        <span>{t.dueDate ? new Date(t.dueDate).toLocaleDateString("ru-RU") : "не задан"}</span>
      </Row>

      <Row label="Приоритет">
        <span style={{ color: t.priority === "high" ? BRAND : TEXT_1 }}>
          {t.priority === "high" ? "срочный" : "обычный"}
        </span>
      </Row>

      {!!t.description && (
        <div
          style={{
            marginTop: 8,
            border: `1px solid ${BORDER}`,
            background: BG_SOFT,
            borderRadius: 10,
            padding: 10,
            color: TEXT_1,
            whiteSpace: "pre-wrap",
            lineHeight: 1.35,
          }}
        >
          {t.description}
        </div>
      )}

      {showAssigneesList && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: TEXT_2, marginBottom: 6 }}>Исполнители</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {assigneesResolved.map(a => (
              <span
                key={a.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid " + (a.done ? OK : BORDER),
                  background: a.done ? "#f0fdf4" : "#fff",
                  color: TEXT_1,
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
                title={a.done ? "выполнил(а)" : "в работе"}
              >
                {a.name} {a.done && <span style={{ color: OK }}>✓</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <ButtonLink href={`/inboxTasks?focus=${encodeURIComponent(t.id)}`} onClick={props.onClose}>
          Открыть в «Задачах»
        </ButtonLink>
        {canMarkDone && (
          <button
            className="btn-primary"
            onClick={() => void onMarkDone(t)}
            disabled={actionBusy === t.id}
          >
            {actionBusy === t.id ? "Отмечаем…" : "Выполнить"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Стилизованная ссылка-кнопка под бренд */
function ButtonLink(props: { href: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={props.href}
      onClick={props.onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 32,
        padding: "0 12px",
        borderRadius: 10,
        border: `1px solid ${BRAND}`,
        background: "#fff",
        color: BRAND,
        cursor: "pointer",
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {props.children}
    </Link>
  );
}

/** Ряд «лейбл — значение» для поповера */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12, color: TEXT_2, marginTop: 2 }}>
      <div style={{ minWidth: 90 }}>{label}:</div>
      <div style={{ color: TEXT_1 }}>{children}</div>
    </div>
  );
}

/** Сегмент-переключатель */
function SegBtn(props: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        padding: "6px 10px",
        border: 0,
        background: props.active ? BRAND : "#fff",
        color: props.active ? "#fff" : TEXT_1,
        fontWeight: 700,
        cursor: "pointer",
        borderRight: `1px solid ${BORDER}`,
      }}
    >
      {props.children}
    </button>
  );
}

/**
 * Умный поповер: авто-позиционирование по anchor-rect, ловит края окна и двигается так,
 * чтобы целиком помещаться на экране. Без фиксированных высот — растёт по контенту.
 */
function SmartPopover(props: {
  anchor?: DOMRect | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 });

  React.useLayoutEffect(() => {
    const pad = 12; // отступ от краёв
    const anchor = props.anchor;
    const el = ref.current;
    if (!anchor || !el) return;

    // базовая позиция — под якорем, слева по левому краю
    let left = anchor.left;
    let top = anchor.bottom + 6;

    // получим размер после рендера
    const { innerWidth: vw, innerHeight: vh } = window;
    const rect = el.getBoundingClientRect();

    // если вылезает вправо — прилипнем к правому краю с отступом
    if (left + rect.width + pad > vw) {
      left = Math.max(pad, vw - rect.width - pad);
    }
    // если вылезает вниз — попробуем отрисовать над якорем
    if (top + rect.height + pad > vh) {
      const above = anchor.top - 6 - rect.height;
      top = Math.max(pad, above);
    }
    // если всё равно вылезает вверх — закрепим по верху
    if (top < pad) top = pad;
    if (left < pad) left = pad;

    setPos({ left, top });
  }, [props.anchor, props.children]);

  React.useEffect(() => {
    const onDown = () => props.onClose();
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [props]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 10000,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
        padding: 12,
        minWidth: 320,
        maxWidth: 520,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* «хвостик» треугольник показываем только если есть место сверху — это косметика, не строгая */}
      {props.anchor && props.anchor.bottom + 10 <= pos.top && (
        <div
          style={{
            position: "absolute", bottom: -6, left: 16, width: 12, height: 12,
            background: "#fff", borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`,
            transform: "rotate(45deg)"
          }}
        />
      )}
      {props.children}
    </div>
  );
}
