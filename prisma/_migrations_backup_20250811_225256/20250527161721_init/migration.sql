-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoleOnUser" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "RoleOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoleOnUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RoleOnUser" ("roleId", "userId") SELECT "roleId", "userId" FROM "RoleOnUser";
DROP TABLE "RoleOnUser";
ALTER TABLE "new_RoleOnUser" RENAME TO "RoleOnUser";
CREATE TABLE "new_SubjectOnUser" (
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "subjectId"),
    CONSTRAINT "SubjectOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectOnUser_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SubjectOnUser" ("subjectId", "userId") SELECT "subjectId", "userId" FROM "SubjectOnUser";
DROP TABLE "SubjectOnUser";
ALTER TABLE "new_SubjectOnUser" RENAME TO "SubjectOnUser";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
