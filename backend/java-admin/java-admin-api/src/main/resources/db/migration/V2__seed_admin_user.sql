-- V2: 插入默认 admin 用户（Q8 决策：仅 dev profile 加载；prod 用 db/migration-prod 排除）
--   密码：admin123 的 BCrypt 哈希（cost=10）

INSERT IGNORE INTO sys_user (username, password, nickname, status)
VALUES ('admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', 'Administrator', 1);
