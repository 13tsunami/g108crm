// components/ChatUnreadIndicator.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type ThreadListItem = {
  id: string;
  unreadCount?: number | null;
};

type Props = {
  /** нарисовать просто текстовый бейдж (в сайдбаре он inline) */
  asText?: boolean;
  /** если передать — компонент не делает fetch, просто рисует число */
  count?: number | null;
};

export default function ChatUnreadIndicator({ asText, count: externalCount }: Props) {
  const { data: session, status } = useSession();
  const [count, setCount] = useState<number>(externalCount ?? 0);
  const uid = useMemo(() => (session?.user as any)?.id as string | undefined, [session?.user]);

  async function refresh() {
    if (!uid) { setCount(0); return; }
    try {
      const r = await fetch("/api/chat/threads/list", {
        cache: "no-store",
        headers: { "X-User-Id": uid },
      }).catch(() => null);
      if (!r?.ok) return;
      const list = (await r.json()) as ThreadListItem[];
      const total = (list || []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0);
      setCount(total);
    } catch {
      /* no-op */
    }
  }

  useEffect(() => {
    if (typeof externalCount === "number") { setCount(externalCount); return; }
    if (status !== "authenticated") { setCount(0); return; }
    refresh();

    const onThreadsUpdated = () => refresh();
    const onSsePush = () => refresh();
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };

    window.addEventListener("g108:chat-threads-updated", onThreadsUpdated as any);
    window.addEventListener("g108:sse-push", onSsePush as any);
    window.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("g108:chat-threads-updated", onThreadsUpdated as any);
      window.removeEventListener("g108:sse-push", onSsePush as any);
      window.removeEventListener("visibilitychange", onVis);
    };
  }, [status, uid, externalCount]);

  if (!count || count <= 0) {
    return asText ? <span aria-hidden="true" style={{ marginLeft: 8 }} /> : null;
  }

  const badge =
    <span className="chat-badge" aria-label={`Непрочитанных сообщений: ${count}`}>
      {count}
      <style jsx>{`
        .chat-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 6px;
          border-radius: 9999px;
          font-size: 11px;
          line-height: 1;
          background: #1d4ed8;
          color: #fff;
          margin-left: 8px;
        }
      `}</style>
    </span>;

  return badge;
}
