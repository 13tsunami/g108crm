// components/ChatWrap.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatWrap() {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource("/api/realtime");
    let t: any = null;

    const refreshSoft = () => {
      if (t) clearTimeout(t);
      // сглаживаем град событий
      t = setTimeout(() => router.refresh(), 150);
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type?.startsWith?.("chat:")) refreshSoft();
      } catch {}
    };

    return () => {
      es.close();
      if (t) clearTimeout(t);
    };
  }, [router]);

  return null;
}
