-- профиль/контакты
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "telegram" TEXT;
ALTER TABLE "User" ADD COLUMN "about" TEXT;

-- уведомления
ALTER TABLE "User" ADD COLUMN "notifyEmail" INTEGER DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "notifyTelegram" INTEGER DEFAULT 0;

-- хранение массивов как JSON-строк
ALTER TABLE "User" ADD COLUMN "subjects" TEXT;
ALTER TABLE "User" ADD COLUMN "methodicalGroups" TEXT;

-- авторизация
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- индексы (по желанию)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
