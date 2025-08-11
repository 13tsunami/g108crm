/*
  Warnings:

  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskAssigneeGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskAssigneeUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserRole` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `createdAt` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `due` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `extPhone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isRoot` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - Added the required column `dueDate` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Role_slug_key";

-- DropIndex
DROP INDEX "TaskAssigneeGroup_taskId_groupId_key";

-- DropIndex
DROP INDEX "TaskAssigneeUser_taskId_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Role";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TaskAssigneeGroup";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TaskAssigneeUser";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserRole";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);
INSERT INTO "new_Group" ("id", "name") SELECT "id", "name" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE TABLE "new_GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GroupMember" ("groupId", "id", "userId") SELECT "groupId", "id", "userId" FROM "GroupMember";
DROP TABLE "GroupMember";
ALTER TABLE "new_GroupMember" RENAME TO "GroupMember";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal'
);
INSERT INTO "new_Task" ("description", "id", "priority", "title") SELECT "description", "id", coalesce("priority", 'normal') AS "priority", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "birthday" DATETIME,
    "classroom" TEXT,
    "role" TEXT,
    "avatarUrl" TEXT,
    "telegram" TEXT,
    "about" TEXT,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
    "subjects" TEXT,
    "methodicalGroups" TEXT,
    "passwordHash" TEXT
);
INSERT INTO "new_User" ("about", "avatarUrl", "birthday", "classroom", "email", "id", "name", "notifyEmail", "notifyTelegram", "passwordHash", "phone", "role", "telegram", "username") SELECT "about", "avatarUrl", "birthday", "classroom", "email", "id", "name", "notifyEmail", "notifyTelegram", "passwordHash", "phone", "role", "telegram", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
