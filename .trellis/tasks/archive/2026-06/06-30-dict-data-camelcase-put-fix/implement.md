# 字典管理接口全端驼峰 + 修复 PUT 400 — 执行清单

## 0. 准备

- 拉取最新 master：`git fetch origin && git status`（确保工作区干净）。
- 阅读 PRD（`prd.md`）+ design（`design.md`）。
- 确认本地 `pnpm -C apps/backend-mock-template dev` 能起来（必要时用 `pnpm dev:mock`）。
- 确认前端 `pnpm -C apps/react-admin dev` 能起来（Vite 默认端口）。
- 当前任务：`06-30-dict-data-camelcase-put-fix`，开发分支：`fix/dict-data-camelcase-put`。

## 1. 实现顺序

> 推荐顺序：**mock → React-Admin → Vue**，因为 React-Admin 改动会影响手工 curl 验收结果。
> 任何一步完成后立即跑 Phase 3「验证命令」做局部回归，再进入下一步。

### 1.1 后端 mock（先做）

1. **新增 `apps/backend-mock-template/utils/dict-camel.ts`**
   - 实现 `TO_CAMEL / TO_SNAKE / pickCamelKeys / toCamelRow`。
   - 单元自测：脑内跑一遍 `pickCamelKeys({tag_type:'x'}, ['tagType'])` 应返回 `{tagType:'x'}`。

2. **改 `apps/backend-mock-template/api/system/dict-data/index.post.ts`**
   - body 类型改 camelCase（`tagType / isDefault / isEnabled`）。
   - 用 `pickCamelKeys` 取值（接受 snake/camel）。
   - `isDefault` boolean → `0|1`；`isEnabled` 接受 `0|1|boolean` 归一。
   - 返回 `toCamelRow(newRow)`。

3. **改 `apps/backend-mock-template/api/system/dict-data/[id].put.ts`**
   - `ALLOWED_KEYS` 改为 `['value','label','sort','isDefault','platform','tagType','isEnabled','remark']`。
   - patch 取值改用 `pickCamelKeys`。
   - 每个校验块改读 camelCase 字段。
   - 返回 `toCamelRow(list[idx])`。
   - 错误信息提到 camelCase 字段名。

4. **改 `apps/backend-mock-template/api/system/dict-data/[id].delete.ts`**
   - 返回 `toCamelRow(list[idx])`。

5. **改 `apps/backend-mock-template/api/system/dict-data/list.ts`**
   - items 走 `.map(toCamelRow)`。
   - query string 键保持不变。

6. **改 `apps/backend-mock-template/api/system/dict-data/by-type/[code].ts`**
   - items 走 `.map(toCamelRow)`。

7. **改 `apps/backend-mock-template/api/system/dict-data/batch.post.ts`**
   - 返回 `{action, affected, ids}` 不变。

8. **改 `apps/backend-mock-template/api/system/dict-type/*`（6 个文件）**
   - `index.post.ts` / `[id].put.ts`：body 类型与 `ALLOWED_KEYS` 改 camelCase；返回 `toCamelRow`。
   - `[id].delete.ts` / `[id].ts`：返回 `toCamelRow`。
   - `list.ts` / `all.ts`：items 走 `.map(toCamelRow)`。
   - `batch.post.ts`：返回结构不变。

9. **自测 mock**
   - `curl -X GET http://localhost:7001/api/system/dict-data/list?typeCode[]=sys_switch_status&platform=react-admin&includeGeneral=true` → items 字段 camelCase。
   - `curl -X PUT http://localhost:7001/api/system/dict-data/1051 -H 'Content-Type: application/json' -d '{"value":"enabled","label":"启用","sort":3,"is_default":0,"platform":"react-admin","tag_type":"warning","is_enabled":1,"remark":""}'` → 200。
   - 同 body 把 snake 换 camelCase → 仍 200。

### 1.2 React-Admin

10. **改 `apps/react-admin/src/api/rest/types.ts`**
    - `DictType` / `DictData` / `Create*/Update*` 字段全部 snake→camel。

11. **改 `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx`**
    - 删除 `tag_type: finalTagType` 改写，改 `tagType: finalTagType`。
    - `is_default / is_enabled` → `isDefault / isEnabled`。
    - 表单 `name="is_enabled"` → `name="isEnabled"`。
    - 编辑回显读 `source.tagType / source.isDefault / source.isEnabled`。
    - `FormValues.is_enabled` → `FormValues.isEnabled`。

12. **改 `apps/react-admin/src/pages/app/system/dict/modules/dict-type-drawer.tsx`**
    - 表单 `name="is_enabled"` → `name="isEnabled"`，提交 payload 同步改。

13. **改 `apps/react-admin/src/pages/app/system/dict/index.tsx`**
    - `DictDict.tag_type → tagType`；`buildDictMaps` 改读 `d.tagType`。
    - renderStatus / renderPlatform 读 `r.isEnabled / r.isDefault`（已有 destructure 就同步改）。

14. **改 `apps/react-admin/src/api/hooks/dict.ts`**（如有必要）
    - 仅当类型错误出现时才动；正常情况 type alias 切换后能通过编译。

15. **自测 React-Admin**
    - `pnpm -C apps/react-admin typecheck`。
    - 启动 dev，手动「编辑字典项」保存 → Network 看到 body 字段 camelCase 且 200。
    - 「新建字典项」保存 → 200。
    - 「批量启用 / 禁用 / 删除」 → 200。

### 1.3 Vue-Vben-Admin

16. **改 `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts`**
    - 类型全 camelCase（同 R3 列表）。

17. **改 `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`**
    - schema 字段：`tag_type → tagType`、`is_enabled → isEnabled`。
    - 表格列：`field: 'is_enabled' → 'isEnabled'`、`field: 'is_default' → 'isDefault'`、`field: 'updated_at' → 'updatedAt'`。
    - `useTypeFormSchema` 字段 `is_enabled` → `isEnabled`。

18. **改 `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue`**
    - 编辑回显：`d.tag_type / d.is_default / d.is_enabled` → `d.tagType / d.isDefault / d.isEnabled`。
    - 提交 payload：同步 camelCase。

19. **改 `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form-type.vue`**（如存在）
    - `is_enabled` → `isEnabled`。

20. **自测 Vue**
    - `pnpm -C apps/vue-vben-admin typecheck:web-naive`（或对应脚本）。
    - 启动 dev，手动新建/编辑/批量 → 200 + 字段 camelCase。

## 2. Review 闸门

- **Phase 1.5 → Phase 2**：`task.py review` 必须看到 prd / design / implement 三份产物。
- **Phase 2 → Phase 3**：每个端改完后立即跑 `trellis-check`，直到无 P0/P1 才推进下一个端。
- **Phase 3.5**：用真机 + curl 跑完 Acceptance Criteria 全清单。

## 3. 验证命令

```bash
# 类型检查
pnpm -C apps/react-admin typecheck
pnpm -C apps/vue-vben-admin typecheck:web-naive

# mock 自测
curl -s 'http://localhost:7001/api/system/dict-data/list?page=1&pageSize=5&platform=react-admin' | jq '.data.items[0]'
curl -s -X PUT http://localhost:7001/api/system/dict-data/1051 \
  -H 'Content-Type: application/json' \
  -d '{"value":"enabled","label":"启用","sort":3,"is_default":0,"platform":"react-admin","tag_type":"warning","is_enabled":1,"remark":""}' | jq .

curl -s -X PUT http://localhost:7001/api/system/dict-data/1051 \
  -H 'Content-Type: application/json' \
  -d '{"value":"enabled","label":"启用","sort":3,"isDefault":false,"platform":"react-admin","tagType":"warning","isEnabled":true,"remark":""}' | jq .

curl -s 'http://localhost:7001/api/system/dict-type/list?page=1&pageSize=5' | jq '.data.items[0]'

# 端到端
# React-Admin: 打开字典管理 → 编辑某条 → 提交 → Network 看 200 + camelCase body
# Vue: 同上
```

## 4. 回滚点

- **回滚 mock**：revert 第 1 个 commit（`chore(dict-mock)`），旧前端 snake 入参仍能工作。
- **回滚 React-Admin**：revert 第 2 个 commit。回归到旧前端+旧 mock，行为与当前 master 一致。
- **回滚 Vue**：revert 第 3 个 commit。
- **全量回滚**：`git revert <merge-commit>` 一把梭。

## 5. 拆分 commit（建议）

```
chore(dict-mock): support camelCase input/output for dict-type/dict-data handlers
refactor(react-admin): switch dict types + UI to camelCase
refactor(vue-vben-admin): switch dict types + UI to camelCase
```

每个 commit 自带 typecheck 通过 + 至少一条 curl 200 验证。