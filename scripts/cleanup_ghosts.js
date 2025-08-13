// scripts/cleanup-ghosts.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const GHOST_ID = "ghost";

function sortPair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

async function ensureCanonicalGhost() {
  await prisma.user.upsert({
    where: { id: GHOST_ID },
    update: {},
    create: {
      id: GHOST_ID,
      name: "Пользователь удалён",
      role: "system_ghost",
      username: null,
      email: null,
      phone: null,
      classroom: null,
      avatarUrl: null,
      telegram: null,
      about: null,
      notifyEmail: false,
      notifyTelegram: false,
      subjects: null,
      methodicalGroups: null,
      passwordHash: null,
      lastSeen: null,
    },
  });
}

async function moveThreadToPair(thread, targetA, targetB) {
  const existing = await prisma.thread.findFirst({
    where: { aId: targetA, bId: targetB },
    select: { id: true },
  });
  if (existing) {
    await prisma.$transaction([
      prisma.message.updateMany({ where: { threadId: thread.id }, data: { threadId: existing.id } }),
      prisma.chatRead.updateMany({ where: { threadId: thread.id }, data: { threadId: existing.id } }),
      prisma.thread.delete({ where: { id: thread.id } }),
    ]);
  } else {
    await prisma.thread.update({
      where: { id: thread.id },
      data: { aId: targetA, bId: targetB },
    });
  }
}

async function consolidateOne(ghostUser) {
  const gid = ghostUser.id;

  // Треды этого ghost -> на канонического
  const threads = await prisma.thread.findMany({
    where: { OR: [{ aId: gid }, { bId: gid }] },
    select: { id: true, aId: true, bId: true },
  });
  for (const t of threads) {
    const other = t.aId === gid ? t.bId : t.aId;
    const [A, B] = sortPair(GHOST_ID, other);
    await moveThreadToPair(t, A, B);
  }

  // Сообщения этого ghost -> на канонического
  await prisma.message.updateMany({ where: { authorId: gid }, data: { authorId: GHOST_ID } });

  // На всякий: join-таблицы (обычно пусто для призраков)
  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { userId: gid } }),
    prisma.taskAssignee.deleteMany({ where: { userId: gid } }),
    prisma.chatRead.deleteMany({ where: { userId: gid } }),
  ]);

  // Удаляем самого ghost_<...>
  await prisma.user.delete({ where: { id: gid } });
}

async function main() {
  await ensureCanonicalGhost();

  // Берём всех "призраков", кроме канонического
  const ghosts = await prisma.user.findMany({
    where: {
      role: "system_ghost",
      NOT: { id: GHOST_ID },
    },
    select: { id: true, name: true },
  });

  let ok = 0, fail = 0;
  for (const g of ghosts) {
    try {
      await consolidateOne(g);
      ok++;
    } catch (e) {
      console.error(`❌ Не удалось удалить ${g.id}:`, e.message);
      fail++;
    }
  }

  console.log(`✅ Готово. Удалено призраков: ${ok}. Ошибок: ${fail}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
