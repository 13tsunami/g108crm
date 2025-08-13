import { NextRequest, NextResponse } from "next/server";
import { initDbOnce, listPosts, createPost, saveUpload, getAuth } from "./_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDbOnce();
  const { uid } = getAuth(req);
  const data = listPosts(uid);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  await initDbOnce();
  const { uid, name } = getAuth(req);
  if (!uid) return new NextResponse("Unauthorized: X-User-Id required", { status: 401 });

  const fd = await req.formData(); // multipart/form-data
  const title = (fd.get("title") as string) || "";
  const text = (fd.get("text") as string) || "";

  const files = fd.getAll("files").filter(Boolean) as File[];
  if (!title && !text && files.length === 0) {
    return new NextResponse("Empty post", { status: 400 });
  }

  const attachments = [];
  for (const f of files) {
    try { attachments.push(await saveUpload(f)); } catch {}
  }

  const post = await createPost({ authorId: uid, authorName: name, title: title || null, text, attachments });
  return NextResponse.json(post);
}
