# 字典管理 backend-mock API — 执行计划

## 策略

- 单包内增量改动（apps/backend-mock-template）。
- 不引入新依赖；沿用现有 `h3` + `@faker-js/faker` + `~/utils/*` 约定。
- 实现顺序：mock-data 种子 → 中间件白名单 → dict-type 6 个 handler → dict-data 5 个 handler → curl 验证。

## 顺序与产物

1. **种子数据**
   - 文件：`apps/backend-mock-template/utils/mock-data.ts`
   - 改动：导出 `DictType / DictData` 类型；新增 `getMockDictTypeList()`、`getMockDictDataList()` 与种子常量；惰性初始化函数 `ensureDictSeeds()` 在 list handler 中调用。
   - 种子覆盖：`sys_user_sex / sys_yes_no / sys_menu_type / sys_notice_type / sys_common_status`，每种 3-4 条。

2. **中间件白名单**
   - 文件：`apps/backend-mock-template/middleware/1.api.ts`
   - 改动：抽 `writeWhitelist` 数组，把 `/api/system/dict-type/` 与 `/api/system/dict-data/` 加入；路径前缀判断改用数组。

3. **dict-type 6 handler**
   - 路径：`apps/backend-mock-template/api/system/dict-type/`
   - 文件：`list.ts / all.ts / [id].ts / index.post.ts / [id].put.ts / [id].delete.ts`
   - 全部沿用 `system/user/*` 的写法（h3 + response utils + setResponseStatus）。
   - 校验与错误码严格对齐 design.md「接口签名」。

4. **dict-data 5 handler**
   - 路径：`apps/backend-mock-template/api/system/dict-data/`
   - 文件：`list.ts / by-type/[code].ts / index.post.ts / [id].put.ts / [id].delete.ts`

5. **本地验证**
   - 命令：`pnpm --filter backend-mock-template dev`（脚本若有别名用 alias；默认端口 4000）。
   - curl 烟测：依次访问 `list / all / detail / create / update / delete` 与 `dict-data` 的同套接口，外加一个失败路径（重复 code / 删除有数据的 type）。
   - 期望：状态码与返回结构符合 PRD。

## 闸门（Gate）

完成上述 1-4 后，做：

```bash
# 启动 mock（后台 / 阻塞均可，按终端约束决定）
pnpm --filter backend-mock-template dev

# 烟测：list / create / delete / 冲突
curl -s 'http://localhost:4000/api/system/dict-type/list?page=1&pageSize=5'
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"code":"tmp_x","name":"TmpX"}' http://localhost:4000/api/system/dict-type
curl -s 'http://localhost:4000/api/system/dict-data/list?typeId=1'
curl -s -X DELETE http://localhost:4000/api/system/dict-type/1   # 应 400 还有 dict-data
```

## 风险与回滚点

- `middleware/1.api.ts` 改动是全局行为变化。若只影响 demo 仍可用，回滚手段：把 `writeWhitelist` 还原成原硬编码 user 例外。
- 新增 mock-data 字段若与已使用字段冲突，需重命名。本任务只新增类型，不复用 user/dept 字段。
- 进程内数据不会持久化；这是预期行为，但要在 README / 提交说明中强调。

## 完成判据

- 12 个 endpoint 全部存在并按设计返回。
- curl 烟测全部通过。
- `middleware/1.api.ts` 不再拦截 dict-type / dict-data 写操作。
- 没有改动 `system/user/*` 的行为。