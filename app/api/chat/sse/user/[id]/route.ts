// гарантируем нодовый рантайм и отсутствие кеша
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { subscribeUser } from "../../../_bus";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const uid = params.id;
  let closed = false;
  let ping: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        if (closed) return;
        try {
          controller.enqueue(`event: push\ndata: ${JSON.stringify(data)}\n\n`);
        } catch { /* no-op */ }
      };

      unsubscribe = subscribeUser(uid, send);

      try { controller.enqueue(`: hello ${uid}\n\n`); } catch {}
      ping = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(`: ping\n\n`); } catch {}
      }, 25_000);
    },

    // ВАЖНО: именно здесь чистим всё при разрыве соединения
    cancel() {
      closed = true;
      try { if (ping) clearInterval(ping); } catch {}
      try { unsubscribe?.(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
