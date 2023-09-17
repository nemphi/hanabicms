-- Migration number: 0003 	 2023-09-11T01:05:29.897Z
-- SQLite

CREATE TABLE records (
  id TEXT PRIMARY KEY NOT NULL,
  collection TEXT NOT NULL,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  deletedAt INTEGER
);