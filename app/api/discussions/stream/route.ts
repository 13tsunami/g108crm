import { initDbOnce, getClients } from "../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initDbOnce();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch {}
      };

      const clients = getClients();
      clients.add(send);

      // привет + пинг
      send(JSON.stringify({ type: "hello", at: Date.now() }));
      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch {}
      }, 25000);

      return () => {
        clearInterval(ping);
        clients.delete(send);
        try { controller.close(); } catch {}
      };
    }
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
