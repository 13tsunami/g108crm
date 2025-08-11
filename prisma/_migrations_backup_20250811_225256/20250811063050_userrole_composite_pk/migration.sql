/*
  Warnings:

  - The primary key for the `GroupMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `joinedAt` on the `GroupMember` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `Task` table. All the data in the column will be lost.
  - You are about to alter the column `priority` on the `Task` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `TaskAssigneeGroup` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assignedAt` on the `TaskAssigneeGroup` table. All the data in the column will be lost.
  - The primary key for the `TaskAssigneeUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assignedAt` on the `TaskAssigneeUser` table. All the data in the column will be lost.
  - You are about to drop the column `assignedAt` on the `UserRole` table. All the data in the column will be lost.
  - The required column `id` was added to the `GroupMember` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `TaskAssigneeGroup` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `TaskAssigneeUser` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "Group_name_key";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "description" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GroupMember" ("groupId", "userId") SELECT "groupId", "userId" FROM "GroupMember";
DROP TABLE "GroupMember";
ALTER TABLE "new_GroupMember" RENAME TO "GroupMember";
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "power" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Role" ("createdAt", "id", "name", "power", "slug", "updatedAt") SELECT "createdAt", "id", "name", "power", "slug", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due" DATETIME,
    "status" TEXT DEFAULT 'open',
    "priority" INTEGER DEFAULT 0,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Task" ("createdAt", "description", "id", "priority", "title", "updatedAt") SELECT "createdAt", "description", "id", "priority", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_TaskAssigneeGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "TaskAssigneeGroup_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssigneeGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaskAssigneeGroup" ("groupId", "taskId") SELECT "groupId", "taskId" FROM "TaskAssigneeGroup";
DROP TABLE "TaskAssigneeGroup";
ALTER TABLE "new_TaskAssigneeGroup" RENAME TO "TaskAssigneeGroup";
CREATE UNIQUE INDEX "TaskAssigneeGroup_taskId_groupId_key" ON "TaskAssigneeGroup"("taskId", "groupId");
CREATE TABLE "new_TaskAssigneeUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TaskAssigneeUser_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssigneeUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaskAssigneeUser" ("taskId", "userId") SELECT "taskId", "userId" FROM "TaskAssigneeUser";
DROP TABLE "TaskAssigneeUser";
ALTER TABLE "new_TaskAssigneeUser" RENAME TO "TaskAssigneeUser";
CREATE UNIQUE INDEX "TaskAssigneeUser_taskId_userId_key" ON "TaskAssigneeUser"("taskId", "userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "role" TEXT,
    "birthday" DATETIME,
    "classroom" TEXT,
    "isRoot" BOOLEAN NOT NULL DEFAULT false,
    "about" TEXT,
    "avatarUrl" TEXT,
    "telegram" TEXT,
    "extPhone" TEXT,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("birthday", "classroom", "createdAt", "email", "id", "isRoot", "name", "passwordHash", "phone", "role", "updatedAt", "username") SELECT "birthday", "classroom", "createdAt", "email", "id", "isRoot", "name", "passwordHash", "phone", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "new_UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserRole" ("roleId", "userId") SELECT "roleId", "userId" FROM "UserRole";
DROP TABLE "UserRole";
ALTER TABLE "new_UserRole" RENAME TO "UserRole";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
