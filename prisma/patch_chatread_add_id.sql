-- Добавляем колонку id в ChatRead «правильным» путём: пересборка таблицы.
PRAGMA foreign_keys = OFF;

CREATE TABLE "ChatRead__new" (
  "id"         TEXT      PRIMARY KEY,
  "threadId"   TEXT      NOT NULL,
  "userId"     TEXT      NOT NULL,
  "lastReadAt" DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Перекладываем данные, одновременно убирая дубликаты (берём самое новое lastReadAt)
INSERT INTO "ChatRead__new"(id, threadId, userId, lastReadAt)
SELECT
  lower(hex(randomblob(16)))               AS id,
  t.threadId,
  t.userId,
  t.lastReadAt
FROM (
  SELECT threadId, userId, MAX(lastReadAt) AS lastReadAt
  FROM "ChatRead"
  GROUP BY threadId, userId
) AS t;

DROP TABLE "ChatRead";
ALTER TABLE "ChatRead__new" RENAME TO "ChatRead";

-- Индексы и уникальность, чтобы Prisma/Studio были довольны
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRead_thread_user_unique" ON "ChatRead"("threadId","userId");
CREATE INDEX IF NOT EXISTS "read_user_idx" ON "ChatRead"("userId");
CREATE INDEX IF NOT EXISTS "read_thread_idx" ON "ChatRead"("threadId");

PRAGMA foreign_keys = ON;
