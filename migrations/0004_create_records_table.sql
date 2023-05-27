-- Migration number: 0004 	 2023-05-26T02:03:34.955Z

-- SQLite

CREATE TABLE records (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    fields TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX records_slug_index ON records (slug);