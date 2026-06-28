# dict-data tag_type schema + mock

## Goal

为 `dict_data` 表增加 `tag_type` 字段并同步后端 mock 的类型与 CRUD 校验。

## Requirements

1. `backend/db/schema.sql` Section 10：给 `dict_data` 表加 `tag_type VARCHAR(32) NOT NULL DEFAULT 'default' COMMENT '预设样式标识(...)'`，位置在 `platform` 之后
2. 顶部注释加 v9 changelog
3. `apps/backend-mock-template/utils/mock-data.ts`：
   - `DictData` interface 加 `tag_type: string`
   - 导出 `ALLOWED_TAG_TYPES / TagType / isAllowedTagType`
   - `buildDictDataSeeds()` 的 seed helper 默认写入 `tag_type: 'default'`
4. `apps/backend-mock-template/api/system/dict-data/index.post.ts`：body 解析 `tag_type`，校验、写入
5. `apps/backend-mock-template/api/system/dict-data/[id].put.ts`：`ALLOWED_KEYS` 加 `'tag_type'`，校验
6. `apps/backend-mock-template/api/system/dict-data/list.ts`：items 自然带 tag_type（如有显式 pick 字段需保留）

## Acceptance Criteria

- [ ] schema.sql 中 `dict_data` 表加 `tag_type` 字段，默认 `'default'`，注释完整
- [ ] schema.sql 顶部版本注释记录 v9 变更
- [ ] mock-data.ts 导出 ALLOWED_TAG_TYPES（17 项）与守卫
- [ ] 种子数据写入 tag_type='default' 不报错
- [ ] POST 带 `tag_type: 'success'` → 200；带 `tag_type: 'foo'` → 400
- [ ] PUT 带 `tag_type: 'success'` → 200；非法值 → 400
- [ ] list 返回 items 包含 tag_type 字段

## Notes

- 父任务 design.md / implement.md 已记录完整契约，本子任务只动 DB + mock
- 不加索引（Q1 决策）
- tag_type 候选集固定 17 项（Q3 决策）