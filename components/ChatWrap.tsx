// components/ChatWrap.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export default function ChatWrap() {
  const { data, status } = useSession();
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1000);

  useEffect(() => {
    if (status !== "authenticated") {
      try { esRef.current?.close(); } catch {}
      esRef.current = null;
      return;
    }
    const uid = (data?.user as any)?.id as string | undefined;
    if (!uid) return;

    const connect = () => {
      try { esRef.current?.close(); } catch {}
      const es = new EventSource(`/api/chat/sse/user/${uid}`);
      esRef.current = es;

      es.onopen = () => { backoffRef.current = 1000; };
      es.onerror = () => {
        try { esRef.current?.close(); } catch {}
        esRef.current = null;
        const wait = Math.min(backoffRef.current, 15000);
        setTimeout(connect, wait);
        backoffRef.current = Math.min(backoffRef.current * 2, 15000);
      };

      es.addEventListener("push", (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data);
          // дать знать всем заинтересованным (сайдбар/индикатору/страницам)
          window.dispatchEvent(new CustomEvent("g108:sse-push", { detail: payload }));
        } catch {
          /* ignore */
        }
      });
    };

    connect();
    return () => { try { esRef.current?.close(); } catch {} };
  }, [status, data?.user]);

  return null;
}
