type SendFn = (evt: any) => void;
type SubMap = Map<string, Set<SendFn>>;

const g = globalThis as any;
if (!g.__chat_bus) {
  g.__chat_bus = { subs: new Map() as SubMap };
}
const bus: { subs: SubMap } = g.__chat_bus;

export function subscribeUser(userId: string, send: SendFn) {
  if (!bus.subs.has(userId)) bus.subs.set(userId, new Set());
  bus.subs.get(userId)!.add(send);
  return () => bus.subs.get(userId)?.delete(send);
}

export function pushToUser(userId: string, payload: any) {
  const set = bus.subs.get(userId);
  if (!set) return;
  for (const s of Array.from(set)) {
    try { s(payload); } catch {}
  }
}

export function pushToMany(userIds: string[], payload: any) {
  for (const id of userIds) pushToUser(id, payload);
}

// Удобные шорткаты под типы событий, которые слушает страница
export function pushThreadUpdated(to: string[]) {
  pushToMany(to, { type: "thread-updated" });
}
export function pushMessage(to: string[], threadId: string, data: any) {
  pushToMany(to, { type: "message", threadId, data });
}
export function pushTyping(to: string[], threadId: string) {
  pushToMany(to, { type: "typing", threadId });
}
