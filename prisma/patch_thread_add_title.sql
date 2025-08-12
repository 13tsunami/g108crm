PRAGMA foreign_keys = OFF;

-- добавить недостающую колонку (для существующих строк проставится дефолт)
ALTER TABLE "Thread" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';

-- опционально: заполнить пустые title на основе имён участников
UPDATE "Thread"
SET "title" = (
  SELECT
    CASE
      WHEN u1.name IS NOT NULL AND u2.name IS NOT NULL
        THEN u1.name || ' ↔ ' || u2.name
      ELSE ''
    END
  FROM "User" u1
  JOIN "User" u2 ON u2.id = "Thread".bId
  WHERE u1.id = "Thread".aId
)
WHERE "title" = '';

PRAGMA foreign_keys = ON;

-- индексы (на случай, если их ещё нет — выполнятся идемпотентно)
CREATE UNIQUE INDEX IF NOT EXISTS "thread_pair_unique" ON "Thread"("aId","bId");
CREATE INDEX IF NOT EXISTS "thread_last_idx" ON "Thread"("lastMessageAt","id");
