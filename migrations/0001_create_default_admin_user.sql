-- Migration number: 0001 	 2022-12-10T16:34:13.872Z

-- SQLite

INSERT INTO users (id, name, email, salt, password, roles, created_at, updated_at) VALUES ('01H1B2DY8VH2NKAW89WSNEN7ZC', 'admin', 'admin', '63d84400bbfec879d8089ec7b5f044d49b2fe39b6486bd7b273cbbae26bfb3e85eb622f3b89ccef35ee90f5ea9393fbf6591951cf6d49231ce0bde55258a276e', '$2a$12$aqv2aPQGAL9kSHteiiYMne8phPK/w6MAukGiXobkP59ONBw/vwpb.', 'admin', DATE(), DATE());