-- Таблицы, если их нет
CREATE TABLE IF NOT EXISTS "Thread" (
  "id" TEXT PRIMARY KEY,
  "aId" TEXT,
  "bId" TEXT,
  "lastMessageAt" DATETIME,
  "lastMessageText" TEXT
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ChatRead" (
  "threadId" TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("threadId","userId")
);

-- Колонки, если таблица Thread уже была старой
PRAGMA foreign_keys=off;
CREATE TABLE IF NOT EXISTS "_Thread_tmp" AS SELECT * FROM "Thread" LIMIT 0;
ALTER TABLE "_Thread_tmp" ADD COLUMN "aId" TEXT;
ALTER TABLE "_Thread_tmp" ADD COLUMN "bId" TEXT;
ALTER TABLE "_Thread_tmp" ADD COLUMN "lastMessageAt" DATETIME;
ALTER TABLE "_Thread_tmp" ADD COLUMN "lastMessageText" TEXT;
INSERT INTO "_Thread_tmp"("id") SELECT "id" FROM "Thread" WHERE "id" IS NOT NULL AND "id" <> '';
DROP TABLE "Thread";
ALTER TABLE "_Thread_tmp" RENAME TO "Thread";
PRAGMA foreign_keys=on;

-- Индексы
CREATE UNIQUE INDEX IF NOT EXISTS "thread_pair_unique" ON "Thread"("aId","bId");
CREATE INDEX IF NOT EXISTS "thread_last_idx" ON "Thread"("lastMessageAt","id");
CREATE INDEX IF NOT EXISTS "msg_thread_time_idx" ON "Message"("threadId","createdAt");
CREATE INDEX IF NOT EXISTS "msg_author_idx" ON "Message"("authorId");
CREATE INDEX IF NOT EXISTS "read_user_idx" ON "ChatRead"("userId");
CREATE INDEX IF NOT EXISTS "read_thread_idx" ON "ChatRead"("threadId");
