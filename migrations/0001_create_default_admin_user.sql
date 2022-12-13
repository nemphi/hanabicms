-- Migration number: 0001 	 2022-12-10T16:34:13.872Z

-- SQLite

INSERT INTO users (name, email, password, roles, created_at, updated_at) VALUES ('admin', 'admin', '$2a$10$76BZVt39vueXvl3tB1yuh.4O0UK.hHrjO9Id8LunA7zzyiF1h03oK', 'admin', DATE(), DATE());