-- V1: 建 sys_user 表（Q5 决策：部分对齐 v5 约定）
--   采纳：snake_case / BIGINT UNSIGNED 主键 / utf8mb4_0900_ai_ci / InnoDB / 显式 uniq_ 索引
--   不加：deleted_at / is_enabled / 7 字段审计（Q5 决策）

CREATE TABLE IF NOT EXISTS sys_user (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    username    VARCHAR(64)      NOT NULL DEFAULT '',
    password    VARCHAR(255)     NOT NULL DEFAULT '',
    nickname    VARCHAR(64)      NOT NULL DEFAULT '',
    status      TINYINT          NOT NULL DEFAULT 1         COMMENT '0=禁用 1=启用',
    create_time DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_sys_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='系统用户表';
