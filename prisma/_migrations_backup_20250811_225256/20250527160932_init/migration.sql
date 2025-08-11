/*
  Warnings:

  - You are about to drop the `_UserRoles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserSubjects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `lastActive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `online` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "_UserRoles_B_index";

-- DropIndex
DROP INDEX "_UserRoles_AB_unique";

-- DropIndex
DROP INDEX "_UserSubjects_B_index";

-- DropIndex
DROP INDEX "_UserSubjects_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_UserRoles";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_UserSubjects";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "RoleOnUser" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "RoleOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleOnUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubjectOnUser" (
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "subjectId"),
    CONSTRAINT "SubjectOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubjectOnUser_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "birthday" DATETIME NOT NULL,
    "classroom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("birthday", "classroom", "id", "name", "phone") SELECT "birthday", "classroom", "id", "name", "phone" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
