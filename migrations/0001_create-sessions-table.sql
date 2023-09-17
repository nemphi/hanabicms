-- Migration number: 0001 	 2023-09-11T01:05:14.122Z
-- SQLite

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  token TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);