# 字典管理 vue-vben-admin (web-naive) 前端

## 目标

在 `apps/vue-vben-admin/apps/web-naive` 中落地字典管理 UI：路由 `/system/dict`，列表页采用 master-detail 双表 + drawer 交互（参考 Open Design 原型 `index.html` 的 `.dual-tables` 与 `.drawer` 样式）。调用 `backend-mock-template` 提供的 `/api/system/dict-type/*` 与 `/api/system/dict-data/*`。

## 范围

新增：

- `src/api/system/dict-type.ts`：list / getAll / getById / create / update / delete。
- `src/api/system/dict-data.ts`：list / getByTypeCode / create / update / delete。
- `src/api/system/index.ts`：re-export。
- `src/views/system/dict/index.vue`：单文件 dict 管理页（master-detail 双表 + 顶部面包屑 + 抽屉表单）。
- `src/views/system/dict/modules/dict-type-drawer.vue`：字典类型新建/编辑抽屉。
- `src/views/system/dict/modules/dict-data-drawer.vue`：字典项新建/编辑抽屉。
- `src/router/routes/modules/system.ts`：新增 system 路由 + `/system/dict` 子路由（仿照 dashboard.ts）。
- `src/locales/langs/zh-CN/system.json`：新增字典管理文案（与 react-admin locales 对齐：typeCode / typeName / entryValue / entryLabel / status 等）。
- `src/locales/langs/en-US/system.json`：同上英文。

修改：

- `src/api/core/index.ts`：从 `./system` re-export。
- `src/router/routes/index.ts`：dynamic route glob 自动覆盖，无需手动改；新增 system.ts 即可被自动收集。

## 验收标准

- [ ] `pnpm --filter web-naive dev` 启动后，登录（`vben/123456`）进入侧栏「系统管理 / 字典管理」路由。
- [ ] 左侧字典类型表加载 5 条种子，按 code / name / 状态可过滤；分页正常；启用开关可即时切换。
- [ ] 点击左侧某条后，右侧字典项表加载该 type 下的所有条目，按 label / value / 状态可过滤。
- [ ] 「新建类型 / 编辑类型 / 删除类型」+「新建条目 / 编辑条目 / 删除条目」都能弹出抽屉；校验失败有 toast；成功后抽屉关闭且表格刷新。
- [ ] 删除字典类型时若仍有字典项，前端拦截并提示「请先清空字典项」（不调 API）。
- [ ] 启用 / 禁用切换走 NSwitch；禁用项 label / value 灰显。
- [ ] 全程无 console error / 未捕获的 TS 错误。

## 非目标

- 不引入 ProTable / 高级组件，保持单 .vue 文件 + 原生 Naive UI（NDataTable / NDrawer / NForm）。
- 不实现字典下拉组件与全局字典缓存（按需后续单独任务）。
- 不做权限码绑定（按钮统一显示，不依赖角色）。

## 风险

- web-naive 工程没有现成的 system 视图，需要从 0 建；文件命名与目录结构参考 `views/dashboard/`。
- i18n key 必须挂在 `system` namespace 下，避免污染 `_core`；路由 meta.title 用 `$t('system.dict.title')`。
- protoType 的 CSS 类是 .dual-tables / .drawer 等命名，本次实现不复用这些 CSS，而是用 Naive UI 自带 `n-grid + n-card` 排版，整体布局节奏（顶部过滤栏 + 两列网格 + 抽屉）保持一致。