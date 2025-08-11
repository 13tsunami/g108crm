// app/api/chat/sse/[id]/route.ts  — ПОЛНЫЙ ФАЙЛ
import { NextRequest } from "next/server";
import { subscribe } from "@/lib/chatSSE";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const { id } = ctx.params;

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribe(id, controller);

      controller.enqueue(new TextEncoder().encode(`event: open\ndata: ${JSON.stringify({ ok: true })}\n\n`));

      const ping = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
      }, 25000);

      const abort = () => {
        clearInterval(ping);
        unsubscribe();
        try { controller.close(); } catch {}
      };

      req.signal.addEventListener("abort", abort);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
