PRAGMA foreign_keys = OFF;

-- 1) Новая таблица Thread с нужными колонками + title NOT NULL
CREATE TABLE "Thread__new" (
  "id"              TEXT      PRIMARY KEY,
  "aId"             TEXT,
  "bId"             TEXT,
  "lastMessageAt"   DATETIME,
  "lastMessageText" TEXT,
  "title"           TEXT      NOT NULL DEFAULT ''
);

-- 2) Перекладываем данные. Если в старой таблице был title, сохраняем его.
--    Иначе пробуем собрать человекочитаемый заголовок из имён участников (если есть),
--    иначе оставляем пустую строку (дефолт).
INSERT INTO "Thread__new"(id, aId, bId, lastMessageAt, lastMessageText, title)
SELECT
  t.id,
  t.aId,
  t.bId,
  t.lastMessageAt,
  t.lastMessageText,
  CASE
    WHEN typeof(t.title) = 'text' AND t.title IS NOT NULL AND t.title <> '' THEN t.title
    WHEN u1.name IS NOT NULL AND u2.name IS NOT NULL THEN (u1.name || ' ↔ ' || u2.name)
    ELSE ''
  END AS title
FROM "Thread" t
LEFT JOIN "User" u1 ON u1.id = t.aId
LEFT JOIN "User" u2 ON u2.id = t.bId;

-- 3) Меняем таблицы местами
DROP TABLE "Thread";
ALTER TABLE "Thread__new" RENAME TO "Thread";

-- 4) Индексы (идемпотентно)
CREATE INDEX IF NOT EXISTS "thread_last_idx" ON "Thread"("lastMessageAt","id");

PRAGMA foreign_keys = ON;
