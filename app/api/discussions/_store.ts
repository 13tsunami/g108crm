// app/api/discussions/_store.ts
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type VoteState = 1 | -1 | 0;

export type Attachment = {
  id: string;
  type: "image" | "video" | "file";
  url: string;
  name?: string | null;
  size?: number | null;
};

export type StoredComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName?: string | null;
  text: string;
  createdAt: string;
  votes: Record<string, VoteState>;
};

export type StoredPost = {
  id: string;
  authorId: string;
  authorName?: string | null;
  title?: string | null;
  text: string;
  createdAt: string;
  attachments: Attachment[];
  votes: Record<string, VoteState>;
  comments: StoredComment[];
};

type DbShape = { posts: StoredPost[] };

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "discussions");
const DB_FILE = path.join(DATA_DIR, "discussions.json");

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function loadDb(): Promise<DbShape> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.posts)) return parsed as DbShape;
  } catch {}
  return { posts: [] };
}

async function saveDb(db: DbShape) {
  await ensureDirs();
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

declare global {
  // eslint-disable-next-line no-var
  var __g108DiscussDb: DbShape | undefined;
  // eslint-disable-next-line no-var
  var __g108DiscussClients: Set<(payload: any) => void> | undefined;
}

function getMemDb(): DbShape {
  if (!global.__g108DiscussDb) {
    throw new Error("DB not initialized");
  }
  return global.__g108DiscussDb;
}

export async function initDbOnce() {
  if (!global.__g108DiscussDb) {
    global.__g108DiscussDb = await loadDb();
  }
  if (!global.__g108DiscussClients) global.__g108DiscussClients = new Set();
}

export function getClients() {
  if (!global.__g108DiscussClients) global.__g108DiscussClients = new Set();
  return global.__g108DiscussClients;
}

export function broadcast(payload: any) {
  const json = JSON.stringify(payload);
  for (const send of getClients()) {
    try { send(json); } catch {}
  }
}

export function listPosts(meId?: string | null) {
  const db = getMemDb();
  return db.posts.map(p => {
    const votes = Object.values(p.votes || {});
    const votesUp = votes.filter(v => v === 1).length;
    const votesDown = votes.filter(v => v === -1).length;
    const myVote = meId ? (p.votes?.[meId] ?? 0) : 0;
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: p.authorName ?? null,
      title: p.title ?? null,
      text: p.text,
      createdAt: p.createdAt,
      attachments: p.attachments || [],
      commentsCount: p.comments.length,
      votesUp, votesDown, myVote,
    };
  });
}

export function getPost(postId: string) {
  const db = getMemDb();
  return db.posts.find(p => p.id === postId) || null;
}

export async function createPost(args: {
  authorId: string; authorName?: string | null;
  title?: string | null; text: string;
  attachments: Attachment[];
}) {
  const db = getMemDb();
  const now = new Date().toISOString();
  const post: StoredPost = {
    id: randomUUID(),
    authorId: args.authorId,
    authorName: args.authorName ?? null,
    title: args.title ?? null,
    text: args.text,
    createdAt: now,
    attachments: args.attachments || [],
    votes: {},
    comments: [],
  };
  db.posts.unshift(post);
  await saveDb(db);
  broadcast({ type: "post:new", post: serializePost(post) });
  return post;
}

export async function votePost(postId: string, userId: string, value: VoteState) {
  const db = getMemDb();
  const p = db.posts.find(x => x.id === postId);
  if (!p) return null;
  if (value === 0) delete p.votes[userId];
  else p.votes[userId] = value;
  await saveDb(db);
  const serial = serializePost(p, userId);
  broadcast({
    type: "vote:update",
    postId: p.id,
    votesUp: serial.votesUp,
    votesDown: serial.votesDown,
    myVote: serial.myVote
  });
  return serial;
}

export function listComments(postId: string, meId?: string | null) {
  const p = getPost(postId);
  if (!p) return [];
  return p.comments.map(c => {
    const vals = Object.values(c.votes || {});
    const votesUp = vals.filter(v => v === 1).length;
    const votesDown = vals.filter(v => v === -1).length;
    const myVote = meId ? (c.votes?.[meId] ?? 0) : 0;
    return {
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      authorName: c.authorName ?? null,
      text: c.text,
      createdAt: c.createdAt,
      votesUp, votesDown, myVote,
    };
  });
}

export async function addComment(postId: string, authorId: string, authorName: string | null, text: string) {
  const db = getMemDb();
  const p = db.posts.find(x => x.id === postId);
  if (!p) return null;
  const c: StoredComment = {
    id: randomUUID(),
    postId,
    authorId,
    authorName: authorName ?? null,
    text,
    createdAt: new Date().toISOString(),
    votes: {},
  };
  p.comments.push(c);
  await saveDb(db);
  const serial = serializeComment(c, authorId);
  broadcast({ type: "comment:new", comment: serial });
  return serial;
}

export async function voteComment(postId: string, commentId: string, userId: string, value: VoteState) {
  const db = getMemDb();
  const p = db.posts.find(x => x.id === postId);
  if (!p) return null;
  const c = p.comments.find(x => x.id === commentId);
  if (!c) return null;
  if (value === 0) delete c.votes[userId];
  else c.votes[userId] = value;
  await saveDb(db);
  const vals = Object.values(c.votes || {});
  const votesUp = vals.filter(v => v === 1).length;
  const votesDown = vals.filter(v => v === -1).length;
  broadcast({ type: "comment:vote", postId, commentId, votesUp, votesDown });
  return { votesUp, votesDown };
}

export function serializePost(p: StoredPost, meId?: string | null) {
  const votes = Object.values(p.votes || {});
  const votesUp = votes.filter(v => v === 1).length;
  const votesDown = votes.filter(v => v === -1).length;
  return {
    id: p.id,
    authorId: p.authorId,
    authorName: p.authorName ?? null,
    title: p.title ?? null,
    text: p.text,
    createdAt: p.createdAt,
    attachments: p.attachments || [],
    commentsCount: p.comments.length,
    votesUp, votesDown,
    myVote: meId ? (p.votes?.[meId] ?? 0) : 0,
  };
}

export function serializeComment(c: StoredComment, meId?: string | null) {
  const vals = Object.values(c.votes || {});
  const votesUp = vals.filter(v => v === 1).length;
  const votesDown = vals.filter(v => v === -1).length;
  return {
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    authorName: c.authorName ?? null,
    text: c.text,
    createdAt: c.createdAt,
    votesUp, votesDown,
    myVote: meId ? (c.votes?.[meId] ?? 0) : 0,
  };
}

export async function saveUpload(file: File): Promise<Attachment> {
  await ensureDirs();
  const id = randomUUID();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const fname = `${id}${ext ? "." + ext : ""}`;
  const ab = await file.arrayBuffer();
  await fs.writeFile(path.join(UPLOAD_DIR, fname), Buffer.from(ab));
  const mime = file.type || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const type: Attachment["type"] = isImage ? "image" : (isVideo ? "video" : "file");
  return { id, type, url: `/uploads/discussions/${fname}`, name: file.name, size: file.size };
}

/**
 * Авторизация из заголовков:
 *  - x-user-id: обязательный идентификатор пользователя
 *  - x-user-name-b64: base64(UTF-8 имя), безопасно для кириллицы
 *  - fallback: x-user-name (ASCII-совместимый)
 */
export function getAuth(req: Request) {
  const uid = req.headers.get("x-user-id") || null;

  // Base64-вариант имени (предпочтительно)
  const nameB64 = req.headers.get("x-user-name-b64");
  if (nameB64) {
    try {
      const name = Buffer.from(nameB64, "base64").toString("utf8");
      return { uid, name };
    } catch {
      // игнор, упадём на ASCII-вариант
    }
  }

  // Fallback: ASCII-имя (если вдруг передали без b64)
  const name = req.headers.get("x-user-name") || null;
  return { uid, name };
}
