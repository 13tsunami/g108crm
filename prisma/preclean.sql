DELETE FROM TaskAssignee
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM TaskAssignee GROUP BY taskId, userId
);
