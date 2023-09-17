-- Migration number: 0000 	 2023-09-11T00:01:43.576Z
-- SQLite

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  salt TEXT NOT NULL,
  password TEXT NOT NULL,
  roles TEXT NOT NULL,
  config TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);