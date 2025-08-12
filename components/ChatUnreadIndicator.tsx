// components/ChatUnreadIndicator.tsx
"use client";

import { useEffect, useState } from "react";

export default function ChatUnreadIndicator({
  asText = false,
}: { asText?: boolean }) {
  const [count, setCount] = useState<number>(0);

  async function load() {
    try {
      const r = await fetch("/api/chat/unread-count", { cache: "no-store" });
      const { count } = await r.json();
      setCount(count ?? 0);
    } catch {}
  }

  useEffect(() => {
    load();
    const es = new EventSource("/api/realtime");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type?.startsWith("chat:")) {
          // любое чат-событие — обновим счётчик
          load();
        }
      } catch {}
    };
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    const t = setInterval(load, 60_000);
    return () => {
      es.close();
      document.removeEventListener("visibilitychange", vis);
      clearInterval(t);
    };
  }, []);

  if (!count) return null;

  // вариант «как текст»: " (3)"
  if (asText) return <span>&nbsp;({count})</span>;

  // компактный бейдж
  return (
    <span
      aria-label={`${count} непрочитанных`}
      style={{
        display: "inline-block",
        minWidth: 16,
        padding: "0 6px",
        borderRadius: 999,
        background: "#ef4444",
        color: "#fff",
        fontSize: 11,
        lineHeight: "18px",
        textAlign: "center",
        marginLeft: 6,
      }}
    >
      {count}
    </span>
  );
}
