// app/api/realtime/route.ts
import { NextRequest } from "next/server";

type Subscriber = (data: any) => void;
const subs = new Set<Subscriber>();

export function broadcast(event: any) {
  for (const s of Array.from(subs)) {
    try { s(event); } catch {}
  }
}

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };
      subs.add(send);
      // пинг раз в 25с, чтобы соединение не засыпало
      const ping = setInterval(() => controller.enqueue(`: ping\n\n`), 25000);
      send({ type: "hello", at: Date.now() });

      return () => {
        clearInterval(ping);
        subs.delete(send);
      };
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
