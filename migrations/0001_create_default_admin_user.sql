-- Migration number: 0001 	 2022-12-10T16:34:13.872Z

-- SQLite

INSERT INTO users (name, email, password, roles, created_at, updated_at) VALUES ('admin', 'admin', 'admin', 'admin', NOW(), NOW());