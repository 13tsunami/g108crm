// components/ChatThreadsPrefetch.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

function keys(uid?: string) {
  const id = uid ?? "anon";
  return { threads: `chat:u:${id}:threads` };
}

export default function ChatThreadsPrefetch() {
  const { data, status } = useSession();
  const uid = (data?.user as any)?.id as string | undefined;
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !uid) return;

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        acRef.current?.abort();
        const ac = new AbortController();
        acRef.current = ac;

        const r = await fetch("/api/chat/threads/list", {
          cache: "no-store",
          signal: ac.signal,
          headers: { "X-User-Id": uid }, // <-- КРИТИЧНО
        });
        if (!r.ok) return;
        const list = await r.json();

        try {
          localStorage.setItem(keys(uid).threads, JSON.stringify(list));
          window.dispatchEvent(new Event("g108:chat-threads-updated"));
        } catch {}
      } catch {}
    };

    tick();
    const id = window.setInterval(tick, 10000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      acRef.current?.abort();
    };
  }, [status, uid]);

  return null;
}
