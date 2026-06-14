-- V1（prod 副本）：与 dev V1 内容一致，但不包含 V2 种子
--   用于 application-prod.yml 的 spring.flyway.locations

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
