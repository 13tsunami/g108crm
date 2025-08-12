// scripts/fix-thread-pairs.cjs
/* Запуск:
   1) taskkill /F /IM node.exe 2>$null
   2) node scripts/fix-thread-pairs.cjs
*/
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function listNullPairThreadIds() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM "Thread" WHERE "aId" IS NULL OR "bId" IS NULL;`
  );
  return rows.map(r => r.id);
}

function pickTwoParticipants(msgs, reads) {
  // приоритет — по реальным авторам последних сообщений
  const lastDistinct = [];
  const seen = new Set();
  for (let i = msgs.length - 1; i >= 0 && lastDistinct.length < 2; i--) {
    const u = msgs[i].authorId;
    if (!seen.has(u)) { seen.add(u); lastDistinct.push(u); }
  }

  // добиваем до двух теми, кто числится в ChatRead
  for (const r of reads) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      lastDistinct.push(r.userId);
      if (lastDistinct.length === 2) break;
    }
  }

  // если так и не набрали двоих — вернём пусто
  if (lastDistinct.length < 2) return null;

  // выбираем двоих и сортируем, чтобы соблюсти инвариант пары (a<=b)
  const [a, b] = lastDistinct.slice(0, 2);
  const [sa, sb] = [a, b].sort();
  return [sa, sb];
}

async function backfillPairs() {
  const ids = await listNullPairThreadIds();
  if (!ids.length) {
    console.log("✔ Тредов с NULL-парой не найдено.");
    return;
  }
  console.log(`→ Нужно починить тредов: ${ids.length}`);

  for (const tid of ids) {
    const msgs = await prisma.message.findMany({
      where: { threadId: tid },
      orderBy: { createdAt: "asc" },
      select: { authorId: true, createdAt: true },
    });

    const reads = await prisma.chatRead.findMany({
      where: { threadId: tid },
      orderBy: { lastReadAt: "asc" },
      select: { userId: true },
    });

    // если совсем пусто — чистим
    if (msgs.length === 0 && reads.length === 0) {
      await prisma.chatRead.deleteMany({ where: { threadId: tid } });
      await prisma.message.deleteMany({ where: { threadId: tid } });
      await prisma.thread.delete({ where: { id: tid } });
      console.log("  • удалён пустой тред:", tid);
      continue;
    }

    // попытка собрать пару
    const pair = pickTwoParticipants(msgs, reads);
    if (!pair) {
      // односторонняя переписка — удаляем как битый
      await prisma.chatRead.deleteMany({ where: { threadId: tid } });
      await prisma.message.deleteMany({ where: { threadId: tid } });
      await prisma.thread.delete({ where: { id: tid } });
      console.log("  • удалён односторонний тред:", tid);
      continue;
    }

    const [aId, bId] = pair;
    await prisma.thread.update({
      where: { id: tid },
      data: { aId, bId },
    });

    const last = await prisma.message.findFirst({
      where: { threadId: tid },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, text: true },
    });

    await prisma.thread.update({
      where: { id: tid },
      data: {
        lastMessageAt: last ? last.createdAt : null,
        lastMessageText: last ? last.text : null,
      },
    });

    // если title пуст — попробуем сформировать из имён пользователей
    const users = await prisma.user.findMany({
      where: { id: { in: [aId, bId] } },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(users.map(u => [u.id, u.name || u.id]));
    const title = `${nameById[aId] ?? aId} ↔ ${nameById[bId] ?? bId}`;

    await prisma.$executeRawUnsafe(
      `UPDATE "Thread" SET "title" = COALESCE(NULLIF(title, ''), ?) WHERE id = ?;`,
      title, tid
    );

    console.log(`  • починен тред ${tid}: ${aId} ↔ ${bId}`);
  }
}

async function dedupeByPair() {
  // пары с дублями
  const pairs = await prisma.$queryRawUnsafe(`
    SELECT aId, bId, COUNT(*) cnt
    FROM "Thread"
    WHERE aId IS NOT NULL AND bId IS NOT NULL
    GROUP BY aId, bId
    HAVING COUNT(*) > 1;
  `);

  if (!pairs.length) {
    console.log("✔ Дубликатов пар не найдено.");
    return;
  }
  console.log(`→ Найдено дублей пар: ${pairs.length}`);

  for (const { aId, bId } of pairs) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT t.id as id, COALESCE(MAX(m.createdAt), 0) AS ts
      FROM "Thread" t
      LEFT JOIN "Message" m ON m.threadId = t.id
      WHERE t.aId = ? AND t.bId = ?
      GROUP BY t.id
      ORDER BY ts DESC;
    `, aId, bId);

    const main = rows[0].id;
    const dups = rows.slice(1).map(r => r.id);

    for (const d of dups) {
      await prisma.message.updateMany({ where: { threadId: d }, data: { threadId: main } });

      const reads = await prisma.chatRead.findMany({ where: { threadId: d } });
      for (const r of reads) {
        const cur = await prisma.chatRead.findUnique({
          where: { threadId_userId: { threadId: main, userId: r.userId } },
          select: { lastReadAt: true },
        });
        const newer = !cur || r.lastReadAt > cur.lastReadAt;
        await prisma.chatRead.upsert({
          where: { threadId_userId: { threadId: main, userId: r.userId } },
          create: { threadId: main, userId: r.userId, lastReadAt: r.lastReadAt },
          update: newer ? { lastReadAt: r.lastReadAt } : {},
        });
      }
      await prisma.chatRead.deleteMany({ where: { threadId: d } });
      await prisma.thread.delete({ where: { id: d } });

      console.log(`  • слит дубль ${d} → ${main} (${aId}__${bId})`);
    }

    // пересчёт last* у главного
    const last = await prisma.message.findFirst({
      where: { threadId: main },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, text: true },
    });
    await prisma.thread.update({
      where: { id: main },
      data: {
        lastMessageAt: last ? last.createdAt : null,
        lastMessageText: last ? last.text : null,
      },
    });
  }
}

async function ensureUniqueIndex() {
  // создадим уникальный индекс (если его ещё нет)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "thread_pair_unique" ON "Thread"("aId","bId");`
  );
}

(async function main() {
  try {
    await backfillPairs();
    await dedupeByPair();
    await ensureUniqueIndex();
    console.log("✔ Готово.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
