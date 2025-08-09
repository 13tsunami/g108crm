// components/TaskForm.tsx
"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";

type User = { id: string; name: string };

export default function TaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [dueDate, setDueDate] = useState("");             // YYYY-MM-DD из <input type="date">
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tagsStr, setTagsStr] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setUsers).catch(()=>setUsers([]));
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((a,b)=>a.name.localeCompare(b.name, "ru")),
    [users]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Название обязательно"); return; }
    if (!dueDate) { setError("Укажите срок"); return; }

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description ?? "",
        dueDate,                               // ключевое: dueDate, не due
        priority,
        assignees,
        tags: tagsStr.split(",").map(s=>s.trim()).filter(Boolean),
      }),
    });

    if (!res.ok) { setError("Не удалось сохранить"); return; }

    setTitle(""); setDesc(""); setDueDate(""); setPriority("normal"); setAssignees([]); setTagsStr("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} style={{ fontFamily: '"Times New Roman", serif', fontSize: 12 }}>
      {error && <div className="alert" style={{ marginBottom: 12 }}>{error}</div>}

      <label className="block mb-1">Название</label>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Сверить списки по 8А" />

      <div className="grid" style={{ gridTemplateColumns: "1fr 220px", gap: 12, marginTop: 12 }}>
        <div>
          <label className="block mb-1">Описание</label>
          <textarea rows={3} value={description} onChange={e=>setDesc(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1">Срок</label>
          <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
          <div style={{ height: 8 }} />
          <label className="block mb-1">Приоритет</label>
          <select value={priority} onChange={e=>setPriority(e.target.value as any)}>
            <option value="normal">Обычный</option>
            <option value="high">Срочный</option>
          </select>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <label className="block mb-1">Назначить</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {sortedUsers.map(u => {
          const checked = assignees.includes(u.id);
          return (
            <label key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setAssignees(prev => checked ? prev.filter(id=>id!==u.id) : [...prev, u.id])}
              />
              {u.name}
            </label>
          );
        })}
      </div>

      <label className="block mb-1">Теги (через запятую)</label>
      <input value={tagsStr} onChange={e=>setTagsStr(e.target.value)} placeholder="админ, отчёт, срочно" />

      <div style={{ height: 12 }} />
      <button type="submit" className="btn-primary">Сохранить задачу</button>
    </form>
  );
}
