-- Migration number: 0002 	 2023-09-11T01:05:23.436Z
-- SQLite

CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  altText TEXT NOT NULL,
  contentType TEXT NOT NULL,
  size INTEGER NOT NULL, -- bytes
  path TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE upload_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);