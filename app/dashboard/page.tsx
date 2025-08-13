// app/dashboard/page.tsx
"use client";

import * as React from "react";

const BRAND = "#8d2828";
const BORDER = "#e5e7eb";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        background: "#fff",
        padding: 16,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>{title}</h2>
      {children}
    </div>
  );
}

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        height: 36,
        padding: "0 12px",
        fontSize: 14,
        borderRadius: 10,
        border: `1px solid ${BORDER}`,
        background: "#fff",
        cursor: "pointer",
        ...(style || {}),
      }}
    />
  );
}

function BtnPrimary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        height: 36,
        padding: "0 12px",
        fontSize: 14,
        borderRadius: 10,
        border: `1px solid ${BRAND}`,
        background: BRAND,
        color: "#fff",
        cursor: "pointer",
        ...(style || {}),
      }}
    />
  );
}

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ padding: 12, display: "grid", gap: 16 }}>
      <Card title="Быстрые действия">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <BtnPrimary onClick={() => alert("Новая задача")}>Новая задача</BtnPrimary>
          <Btn onClick={() => (window.location.href = "/teachers")}>Добавить пользователя</Btn>
          <Btn onClick={() => alert("Импорт расписания")}>Импорт расписания</Btn>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Входящие за сегодня">
          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              background: "#fafafa",
            }}
          >
            Проверить отчёты по 9А
          </div>
          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 12,
              background: "#fafafa",
            }}
          >
            Согласовать замену уроков
          </div>
        </Card>

        <Card title="Ближайшие события">
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: 12,
                background: "#fafafa",
              }}
            >
              Педсовет — {today}
            </div>
            <div
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: 12,
                background: "#fafafa",
              }}
            >
              Собрание 9А — через 2 дня
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
