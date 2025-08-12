PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS "ChatState" (
  "threadId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "hiddenAt"  DATETIME,
  "clearedAt" DATETIME,
  PRIMARY KEY ("threadId","userId")
);

CREATE INDEX IF NOT EXISTS "chatstate_user_idx"   ON "ChatState"("userId");
CREATE INDEX IF NOT EXISTS "chatstate_thread_idx" ON "ChatState"("threadId");

PRAGMA foreign_keys = ON;
