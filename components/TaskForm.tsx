// components/TaskForm.tsx
"use client";

import { useMemo, useState, FormEvent } from "react";

type SimpleUser = { id: string; name: string; role?: string | null };

export default function TaskForm({
  onCreated,
  users: usersProp,
}: {
  onCreated: () => void;
  users?: SimpleUser[] | { users?: SimpleUser[] } | null | undefined;
}) {
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [by, setBy] = useState("Евжик И.С.");
  const [tagsStr, setTagsStr] = useState("");

  // Нормализуем входной проп в массив
  const users: SimpleUser[] = useMemo(() => {
    // если пришёл объект вида { users: [...] }
    const maybe = (usersProp as any)?.users ?? usersProp;
    return Array.isArray(maybe) ? maybe : [];
  }, [usersProp]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [users]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      title,
      description,
      due,
      by,
      tags: tagsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Не удалось сохранить задачу: ${txt}`);
    }
    onCreated();
    setTitle("");
    setDesc("");
    setDue("");
    setTagsStr("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block mb-1">Название</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div>
        <label className="block mb-1">Описание</label>
        <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ margin: "12px 0" }}>
        <div>
          <label className="block mb-1">Срок</label>
          <input required type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1">Назначил</label>
          <input value={by} onChange={(e) => setBy(e.target.value)} />
        </div>
      </div>

      {/* Пример выпадающего выбора исполнителя (если потребуется) */}
      {sortedUsers.length > 0 && (
        <div>
          <label className="block mb-1">Исполнитель</label>
          <select onChange={(e) => setBy(e.target.value)} value={by}>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="block mb-1">Теги (через запятую)</label>
      <input
        value={tagsStr}
        onChange={(e) => setTagsStr(e.target.value)}
        placeholder="админ, отчёт, срочно"
      />

      <div style={{ height: 12 }} />
      <button type="submit" className="btn-primary">
        Сохранить задачу
      </button>
    </form>
  );
}
