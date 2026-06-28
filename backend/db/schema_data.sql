-- ============================================================
-- 字典数据 — dict_type / dict_data 初始数据
-- 文件:    backend/db/schema_data.sql
-- 执行顺序: 依赖 schema.sql（先建表，再插数据）
-- 软删约定: 数据均为"未删"状态（deleted_at = 0）
-- 平台约定:
--   - dict_type  v7 移除 platform 字段
--   - dict_data  v8 platform ∈ {general, react-admin, vue-admin}
--                 v9 tag_type 前端按标识映射 ant Tag 颜色 / vben Tag color
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Section 1: dict_type
-- ============================================================

INSERT INTO dict_type (code, name, remark, is_enabled, deleted_at, created_by, updated_by)
VALUES
    ('platform', '归属平台', '前端按 platform 过滤通用/平台专属字典项', 1, 0, 0, 0),
    ('common_status', '通用状态', '跨模块通用启用/禁用状态', 1, 0, 0, 0);


-- ============================================================
-- Section 2: dict_data
-- 依赖 dict_type.id；先插入 dict_type 后由 SELECT 取 id 绑定
-- ============================================================

-- 2.1 归属平台(platform)
INSERT INTO dict_data (type_id, value, label, sort, is_default, platform, tag_type, is_enabled, deleted_at, remark, created_by, updated_by)
SELECT t.id, 'general',     '通用',     1, 1, 'general',     'default', 1, 0, '跨平台通用', 0, 0
FROM dict_type t WHERE t.code = 'platform' AND t.deleted_at = 0;

INSERT INTO dict_data (type_id, value, label, sort, is_default, platform, tag_type, is_enabled, deleted_at, remark, created_by, updated_by)
SELECT t.id, 'react-admin', 'React Admin', 2, 0, 'react-admin', 'default', 1, 0, 'React Admin 端专属', 0, 0
FROM dict_type t WHERE t.code = 'platform' AND t.deleted_at = 0;

INSERT INTO dict_data (type_id, value, label, sort, is_default, platform, tag_type, is_enabled, deleted_at, remark, created_by, updated_by)
SELECT t.id, 'vue-admin',   'Vue Admin', 3, 0, 'vue-admin',   'default', 1, 0, 'Vue Admin 端专属', 0, 0
FROM dict_type t WHERE t.code = 'platform' AND t.deleted_at = 0;


-- 2.2 通用状态(common_status)
INSERT INTO dict_data (type_id, value, label, sort, is_default, platform, tag_type, is_enabled, deleted_at, remark, created_by, updated_by)
SELECT t.id, 'enabled',  '启用',  1, 1, 'general', 'success', 1, 0, '启用', 0, 0
FROM dict_type t WHERE t.code = 'common_status' AND t.deleted_at = 0;

INSERT INTO dict_data (type_id, value, label, sort, is_default, platform, tag_type, is_enabled, deleted_at, remark, created_by, updated_by)
SELECT t.id, 'disabled', '禁用', 2, 0, 'general', 'default',  1, 0, '禁用', 0, 0
FROM dict_type t WHERE t.code = 'common_status' AND t.deleted_at = 0;


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- End of schema_data.sql
-- ============================================================
