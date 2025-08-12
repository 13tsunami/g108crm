// app/api/realtime/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendFn = (data: any) => void;

// Глобальный реестр подписчиков (переживает HMR)
const g = globalThis as any;
if (!g.__realtime_bus) g.__realtime_bus = { subs: new Set<SendFn>() };
const subs: Set<SendFn> = g.__realtime_bus.subs;

// Используется приложением для пуша событий
export function broadcast(payload: any) {
  for (const fn of Array.from(subs)) {
    try { fn(payload); } catch { /* noop */ }
  }
}

export async function GET(req: NextRequest) {
  let closed = false;
  let ping: ReturnType<typeof setInterval> | null = null;
  let sendRef: SendFn | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send: SendFn = (data) => {
        if (closed) return;
        try {
          controller.enqueue(`event: push\ndata: ${JSON.stringify(data)}\n\n`);
        } catch { /* поток уже закрыт */ }
      };
      sendRef = send;
      subs.add(send);

      // привет + keepalive
      try { controller.enqueue(`: hello\n\n`); } catch {}
      ping = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(`: ping\n\n`); } catch {}
      }, 25_000);

      // на случай, если клиент оборвал запрос (abort)
      const abort = () => {
        if (closed) return;
        closed = true;
        try { if (ping) clearInterval(ping); } catch {}
        try { if (sendRef) subs.delete(sendRef); } catch {}
        try { controller.close(); } catch {}
      };
      // у NextRequest есть signal
      (req as any).signal?.addEventListener?.("abort", abort);
    },

    // ВАЖНО: очистка именно здесь, а не return из start()
    cancel() {
      if (closed) return;
      closed = true;
      try { if (ping) clearInterval(ping); } catch {}
      try { if (sendRef) subs.delete(sendRef); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
