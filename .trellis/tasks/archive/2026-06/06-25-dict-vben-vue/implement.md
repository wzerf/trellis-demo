# 字典管理 vue-vben-admin (web-naive) — 执行计划

## 策略

- 不引入第三方组件，不破坏现有 i18n / 路由结构。
- 单 .vue 主页 + 3 个子组件；保持目录 `views/system/dict/` 与原项目 `views/dashboard/` 同构。
- API 封装在 `src/api/system/` 下，与 `src/api/core/` 平级但不混淆 core（core 是 auth/menu/user）。

## 顺序

1. **API 封装**
   - `src/api/system/dict-type.ts`
   - `src/api/system/dict-data.ts`
   - `src/api/system/index.ts`
   - `src/api/core/index.ts`：增加 `export * from '../system';`（注意 ../ 是向上跳一级，从 core 到 src/api）

2. **路由**
   - `src/router/routes/modules/system.ts`

3. **i18n**
   - `src/locales/langs/zh-CN/system.json`（追加；如有 system 块则合并）
   - `src/locales/langs/en-US/system.json`
   - `src/locales/index.ts` 注册 system 命名空间（若还没有）

4. **视图**
   - `src/views/system/dict/index.vue`
   - `src/views/system/dict/modules/dict-type-drawer.vue`
   - `src/views/system/dict/modules/dict-data-drawer.vue`
   - `src/views/system/dict/modules/shared.ts`

5. **本地验证**
   - 启动 mock：`pnpm --filter backend-mock-template dev`（端口 4000）
   - 启动 web-naive：`pnpm --filter web-naive dev`（端口 5173 左右）
   - 浏览器登录 → 侧栏「系统管理 / 字典管理」→ 看到种子数据 → CRUD 流程通过
   - console 无报错

## 闸门

- `pnpm --filter web-naive typecheck`（若工程未配该 script，则 `pnpm --filter web-naive build`）通过。
- 浏览器实测：列表 → 选中 → 新建 → 编辑 → 删除，全流程无报错；启用开关同步。
- 后端响应被前端正确消费（Network 面板每条都是 200）。

## 风险与回滚

- 路由 system.ts 一旦加入侧栏自动出现，若菜单显示混乱可在 meta.order 调整。
- i18n 文件如果原本就有 `system` 命名空间，需要在合并时不要覆盖已有 key（先 grep `system.title` / `system.dict`）。
- 组件 file 若命名拼错会被 Vite 自动发现但页面空白，因此本地必须 `pnpm dev` 至少手动触发一次。

## 完成判据

- 「字典管理」入口出现在侧栏，点进去可见左右两表。
- 双表 + drawer 交互节奏与 Open Design 原型对齐（顶部过滤栏 + 主表 + 行内操作 + 右侧抽屉）。
- 不改动其它模块；只新增。