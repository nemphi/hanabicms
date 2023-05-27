-- Migration number: 0000 	 2022-12-10T16:08:38.685Z

-- SQLite

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  salt TEXT NOT NULL, -- sha512 salt generated from a nanoid
  password TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT 'user', -- comma separated list of roles
  created_at DATETIME NOT NULL CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL CURRENT_TIMESTAMP
);