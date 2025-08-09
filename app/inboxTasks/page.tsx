// app/inboxTasks/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import TaskForm from "@/components/TaskForm";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  hidden: boolean;
  priority: "high" | "normal";
};

function tsOf(d: string | null) {
  if (!d) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(d); return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}
function formatRu(d: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, "0");
  const m = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"][x.getMonth()];
  return `${dd} ${m} ${x.getFullYear()}`;
}

export default function InboxTasksPage() {
  const [tab, setTab] = useState<"inbox" | "tasks">("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const load = () => fetch("/api/tasks").then(r=>r.json()).then(setTasks).catch(()=>setTasks([]));
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => [...tasks].sort((a,b)=>tsOf(a.dueDate)-tsOf(b.dueDate)), [tasks]);

  return (
    <section style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setTab("inbox")} className={tab === "inbox" ? "btn-primary" : "btn"}>Входящие</button>
        <button onClick={() => setTab("tasks")} className={tab === "tasks" ? "btn-primary" : "btn"}>Задачи</button>
      </div>

      {tab === "inbox" && <div className="card" style={{ padding: 16 }}>Потоки пока не подключены.</div>}

      {tab === "tasks" && (
        <div className="grid" style={{ gridTemplateColumns: "380px 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Новая задача</h3>
            <TaskForm onCreated={load} />
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 12, fontWeight: 700, fontSize: 18 }}>Все задачи</div>
            {sorted.map((t, i) => (
              <div key={t.id} style={{ padding: 12, borderTop: i ? "1px solid #e5e7eb" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: t.priority === "high" ? "#c1121f" : "#111" }}>{t.title}</div>
                  <div style={{ whiteSpace: "nowrap", color: "#374151" }}>{formatRu(t.dueDate)}</div>
                </div>
                {t.description && <div style={{ marginTop: 6 }}>{t.description}</div>}
              </div>
            ))}
            {!sorted.length && <div style={{ padding: 12 }}>Задач пока нет</div>}
          </div>
        </div>
      )}
    </section>
  );
}
