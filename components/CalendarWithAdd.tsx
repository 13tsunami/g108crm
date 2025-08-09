// components/CalendarWithAdd.tsx
"use client";

import React from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;              // YYYY-MM-DD
  priority: "high" | "normal";
};

const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function ruMonthYear(d: Date) {
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export default function CalendarWithAdd() {
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [view, setView] = React.useState<"month" | "week">("month");
  const [date, setDate] = React.useState(ymd(new Date()));
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<"normal" | "high">("normal");
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    fetch("/api/tasks").then(r=>r.json()).then(setTasks).catch(()=>setTasks([]));
  }, [reload]);

  async function addTask() {
    if (!title.trim() || !date) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description,
        dueDate: date,
        hidden: false,
        priority,
        assignees: [],
        tags: [],
      }),
    });
    if (res.ok) { setTitle(""); setDescription(""); setReload(v=>v+1); }
  }

  const year = cursor.getFullYear(); const month = cursor.getMonth();

  const monthCells = React.useMemo(() => {
    const start = new Date(year, month, 1);
    const firstDow = (start.getDay() + 6) % 7; // понедельник=0
    const days = new Date(year, month + 1, 0).getDate();
    const cells: { iso: string | null; day: number | null }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ iso: null, day: null });
    for (let d = 1; d <= days; d++) {
      const cur = new Date(year, month, d);
      cells.push({ iso: ymd(cur), day: d });
    }
    while (cells.length % 7) cells.push({ iso: null, day: null });
    return cells;
  }, [year, month]);

  function weekOf(selectedISO: string) {
    const d = new Date(selectedISO);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(monday); x.setDate(monday.getDate() + i);
      return { iso: ymd(x), day: x.getDate() };
    });
  }
  const weekCells = React.useMemo(() => weekOf(date), [date]);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <button className="btn" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
      <div style={{ fontWeight: 700, fontSize: 20 }}>{ruMonthYear(new Date(year, month, 1))}</div>
      <button className="btn" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>

      <div style={{ marginLeft: 16 }}>
        <button className={view==="month"?"btn-primary":"btn"} onClick={()=>setView("month")}>Месяц</button>
        <button className={view==="week"?"btn-primary":"btn"} onClick={()=>setView("week")} style={{ marginLeft: 6 }}>Неделя</button>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Название" value={title} onChange={(e)=>setTitle(e.target.value)} style={{ width: 280 }} />
        <select value={priority} onChange={(e)=>setPriority(e.target.value as any)}>
          <option value="normal">Обычный</option>
          <option value="high">Срочный</option>
        </select>
        <button className="btn-primary" onClick={addTask}>Добавить</button>
      </div>
    </div>
  );

  const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 };
  const cellStyle: React.CSSProperties = { border: "1px solid #ddd", minHeight: view==="month"?120:220, padding: 8, background: "#fff" };
  const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 6 };
  const itemStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  function renderCells(cells: { iso: string | null; day: number | null }[]) {
    return (
      <>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontWeight: 700, textAlign: "center", padding: 6 }}>{w}</div>
        ))}
        {cells.map((c, i) => {
          const dayTasks = c.iso ? tasks.filter(t => t.dueDate === c.iso) : [];
          return (
            <div key={i} style={cellStyle}>
              <div style={titleStyle}>{c.day ?? ""}</div>
              <div style={{ maxHeight: view==="month"?88:188, overflowY: "auto" }}>
                {dayTasks.map((t) => (
                  <div key={t.id} title={t.description ?? ""} style={{ ...itemStyle, color: t.priority === "high" ? "#c1121f" : "#111" }}>
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div style={{ fontFamily: '"Times New Roman", serif', fontSize: 12, padding: 10 }}>
      {header}
      <div style={gridStyle}>
        {view === "month" ? renderCells(monthCells) : renderCells(weekCells)}
      </div>
    </div>
  );
}
