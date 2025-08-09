// app/dashboard/page.tsx
"use client";

import * as React from "react";

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="app-dashboard">
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Быстрые действия</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={() => alert("Новая задача")}>
            Новая задача
          </button>
          <button onClick={() => alert("Добавить пользователя")}>Добавить пользователя</button>
          <button onClick={() => alert("Импорт расписания")}>Импорт расписания</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginBottom: 10 }}>Входящие за сегодня</h2>
          <div className="section" style={{ padding: 12, marginBottom: 8 }}>Проверить отчёты по 9А</div>
          <div className="section" style={{ padding: 12 }}>Согласовать замену уроков</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginBottom: 10 }}>Ближайшие события</h2>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="section" style={{ padding: 12 }}>Педсовет — {today}</div>
            <div className="section" style={{ padding: 12 }}>Собрание 9А — через 2 дня</div>
          </div>
        </div>
      </div>
    </div>
  );
}
