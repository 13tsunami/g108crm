// app/api/_utils.ts
import { NextRequest } from "next/server";

export function getUserId(req: NextRequest): string | null {
  // 1) явный заголовок (удобно в dev и тестах)
  const h = req.headers.get("x-user-id");
  if (h && h.trim()) return h.trim();

  // 2) кука uid=<id>
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/i);
  if (m) try { return decodeURIComponent(m[1]); } catch {}
  return null;
}
