-- Migration number: 0000 	 2022-12-10T16:08:38.685Z

-- SQLite

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  roles VARCHAR(255) NOT NULL DEFAULT 'user', -- comma separated list of roles
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);