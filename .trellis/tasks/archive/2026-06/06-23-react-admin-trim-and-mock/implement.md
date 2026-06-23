# implement.md — 精简 react-admin 对齐 vben 并对接 mock

## A. Development Strategy

- **开发模式**：单 agent 直接执行（不派 subagent）
- **代码隔离**：当前 master 分支直接改（不 worktree、不开新分支）
- **流程**：默认流程（写代码 → `pnpm build:check` / `pnpm lint` → 验证），非 TDD
- **架构审查**：disabled（不在任务内开 `trellis-improve-codebase-architecture`）
- **Review-gate contract: explicit-selection-v1**

**Enabled optional review gates**：
- `trellis-spec-review`
- `trellis-code-review`
- `trellis-code-architecture-review`

**Disabled optional review gates**：
- `trellis-merge-review`
- `trellis-improve-codebase-architecture`

Review-gate 执行顺序（仅针对 enabled）：`trellis-spec-review` → `trellis-code-review` → `trellis-code-architecture-review`。

## B. Implementation Checklist

### Phase 1: 网络与基础

1. 启动 mock：`cd apps/backend-mock-template && pnpm start`（默认 3000 端口；如冲突需用 `--port`）
2. 修改 `apps/react-admin/.env.development`：
   - `VITE_API_URL=` 留空（前端走相对路径，依赖 Vite `/api` 代理到 mock 端口）
   - `VITE_PROXY=[["/api","http://localhost:3000/"]]` 替换原 `/admin` 代理
3. 修改 `apps/react-admin/.env.production`：清空或留同源
4. 修改 `apps/react-admin/vite.config.ts` 的 `server.proxy`：将 `/api` 代理到 `http://localhost:3000`，并设置 `changeOrigin: true`

### Phase 1.5: mock backend 调整（已先行完成）

5. ✅ `apps/backend-mock-template/api/auth/refresh.post.ts` 改为返回 `useResponseSuccess({ accessToken })`
6. ✅ `apps/backend-mock-template/utils/cookie-utils.ts` 按 `process.env.NODE_ENV` 切换 `sameSite` / `secure`
7. ✅ `apps/backend-mock-template/middleware/1.api.ts` 放行 `/api/system/user/*` 的 POST/PUT/DELETE
8. ✅ `apps/backend-mock-template/api/auth/login.post.ts` 过滤 password 字段不返回
9. ✅ `apps/backend-mock-template/api/system/user/list.ts` 改为返回 user-shaped 数据
10. ✅ `apps/backend-mock-template/api/system/user/create.post.ts` + `[id].put.ts` + `[id].delete.ts` 新增；`utils/mock-data.ts` 导出 `getMockUserList()`

### Phase 2: API 层重写（决策 Q1：彻底替换）

4. 创建 `src/api/types/{auth,user,menu,common}.ts`：手写 vben 风格类型
5. 创建 `src/api/rest/request.ts`：薄封装 `requestApi` 的 GET/POST/PUT/DELETE
6. 创建 `src/api/rest/auth.ts`：`login` / `logout` / `refreshToken` / `getAuthCodes`（或叫 `getAccessCodes`）
7. 创建 `src/api/rest/user.ts`：`getUserInfo` / `listUsers` / `createUser` / `updateUser` / `deleteUser`
8. 创建 `src/api/rest/menu.ts`：`getAllMenus`
9. 删除 `src/api/generated/**` 整个目录
10. 删除或重写 `src/api/client.ts`（不再有 `createApiClient`）
11. 重写 `src/api/hooks/auth.ts` / `src/api/hooks/user.ts`：内部调用 `api/rest/*` 替代 `apiClient.*`
12. 删除未用 hooks（见 design.md §1.2），给保留下来的非 auth/user hook 加 `@deprecated` JSDoc
13. 改 `src/api/index.ts`：只导出 `api/rest/*` + `api/hooks/{auth,user}`

### Phase 3: Store / Hooks 调整（决策 Q2 + Q5 + 记住我）

14. 改 `src/stores/auth.ts`：
    - 删 `refreshTokenValue` / `refreshTokenExpireAt` 字段
    - `login` 改为明文 password，去掉 `encryptPassword` 调用
    - `login` 内部：调 `loginApi` → 存 `accessToken` → 调 `getUserInfoApi` → 存 `userInfo` → `startRefreshTimer`
    - `refreshToken` 简化为 `POST /auth/refresh`（依赖 cookie，空 body），从响应 `data.accessToken` 取新 token
    - `logout` 不再清 `refreshTokenValue`（已无该字段）
    - `partialize` 移除 `refreshTokenValue` / `refreshTokenExpireAt`
    - **「记住我」支持**：
      - 引入 `src/core/storage/conditional-storage.ts`：`createConditionalStorage(remember: boolean)` 返回自定义 zustand `PersistStorage`
      - `remember=true` → `createJSONStorage(() => localStorage)`
      - `remember=false` → `createJSONStorage(() => sessionStorage)`
      - 持久化 name 固定为 `auth-storage`，但 `sessionStorage` 中只在当前 tab 存活
      - 在 `useAuthStore.persist` 上挂自定义 `storage`，store 暴露一个 `setStorage(remember: boolean)` 方法，登录时由 `login` action 内部调用
    - 兼容旧 `auth-storage`：bootstrap 启动时清一次 localStorage 旧 key 中的 `refreshTokenValue` 字段
15. 改 `src/hooks/useTokenRefresh.ts`：跟随 store 调整
16. 改 `src/hooks/useAuth.ts`：把 `fetchUserProfile` 切换到 `getUserInfo` 的新 hook
17. 改 `src/bootstrap.ts`：注入的 `refreshToken` 回调去掉取 `refreshTokenValue` 的逻辑；启动时执行 `localStorage.removeItem('auth-storage-legacy')` 之类清理（如有）
18. 检查 `src/core/transport/rest/request-client.ts` / `preset-interceptors.ts`：401 拦截器逻辑（如有手动调 logout 则保持；如读 `refreshTokenValue` 则改为无值调用 `/auth/refresh`）

### Phase 4: Router 调整（决策 Q3：与 vben 一致）

19. 改 `src/router/index.tsx`：
    - 删 `apiClient.adminPortalService.GetNavigation({})` 调用
    - 改为 `fetchAllMenus()` （来自 `@/api/rest/menu`）
    - **菜单过滤**：在 `fetchMenuListAsync` 中调用 `filterMenusByPageMap(items, pageMap)`，过滤掉 component 路径在 pageMap 中没有命中的菜单项；命中规则见 `design.md §2.2`
    - pageMap 路径无需改（glob 已处理）
    - layoutMap 已包含 `BasicLayout`（= `AuthenticatedLayout`），保持
20. 验证 `src/router/modules/` 下的路由：保留 `dashboard.tsx`、`system.tsx`（**新增 user 路由**，见 Phase 5）、其它可保留但 `pageMap` 不注册（即不删除文件）；最终路由只导出 dashboard + system/user
21. `src/router/modules/{internal-message,log,opm,permissions,tenant}.tsx` 文件保留，**路由不再被加载**（不修改文件，由 Phase 5 决定是否需要从 `AppRouter` 移除导入）

### Phase 5: 页面与功能裁剪

22. 保留 `src/pages/app/dashboard/**`
23. **新建** `src/pages/app/system/user/index.tsx`（用户管理页，PRD 验收点）：
    - 使用 `ProTable` 渲染列表：columns = `[username, realName, email, phone, status(Badge), roles, createTime]`
    - 工具栏「新建」按钮 → 弹 `ModalForm` → 调 `POST /api/system/user`
    - 行内「编辑」按钮 → 弹 `DrawerForm` → 调 `PUT /api/system/user/:id`
    - 行内「删除」按钮 → `Popconfirm` → 调 `DELETE /api/system/user/:id`，成功后 `tableRef.reload()`
    - 搜索项：username、realName、status（Select）
    - 分页：`pageSize=10`
24. 保留 `src/pages/core/auth/login/**`，`LoginForm` 增加「记住我」checkbox 状态，调用 `useAuthStore.login({...}, { remember })`
25. **保留** `src/pages/core/auth/register/**` 目录（与 system/dict 一致策略，路由不注册即可）
26. 不注册 `src/pages/app/{opm,permission,log,tenant,internal-message}/**` 路由
27. 不注册 `src/pages/app/system/{dict,file,language,login-policy,task}/**` 路由
28. 保留 `src/pages/core/error/**` 错误页
29. 在 `src/router/modules/system.tsx` 中**新增** user 路由（path: `/system/user`），component 指向 `pages/app/system/user/index.tsx`

### Phase 6: 依赖清理（决策 Q4：保守清理）

29. 删除 `package.json` 确认未引用的依赖：
    - `@tiptap/*` 全家桶（9 个：core / extension-* / pm / react / starter-kit）
    - `md-editor-rt`
    - `monaco-editor`
    - `json-editor-vue`
    - `lowlight`
    - `highlight.js`
    - `@microsoft/fetch-event-source`（如未被 `core/transport/sse` 引用）
    - `echarts-for-react`（如未引用）
    - `@tanstack/react-query-devtools`（devDependencies 中如未用）
    - `vite-plugin-windicss`（如未用 unocss/windicss 同时启用）
30. 删除对应 devDependencies（如 `@types/lodash.clonedeep` 还在，`lodash.clonedeep` 未删则保留）
31. `pnpm install`
32. `pnpm --filter ant-design-pro build:check` 必须通过

### Phase 7: 文档

33. 更新 `apps/react-admin/README.md`：
    - 启动顺序：`cd apps/backend-mock-template && pnpm start` → `pnpm --filter ant-design-pro dev`
    - 默认账号：`vben / 123456`、`admin / 123456`、`jack / 123456`
    - 已裁剪功能清单：system/{dict,file,language,login-policy,task}、opm、permission、log、tenant、internal-message、register、扫码登录

## C. 验证命令

```bash
# 1. 类型 + 构建
pnpm --filter ant-design-pro build:check

# 2. Lint
pnpm --filter ant-design-pro lint

# 3. 启动 mock（终端 1）
cd apps/backend-mock-template && pnpm start

# 4. 启动前端（终端 2）
pnpm --filter ant-design-pro dev
# 浏览器打开 http://localhost:7000

# 5. 手工验收
# - 未登录 → 跳转 /login
# - 勾选「记住我」+ 用 vben/123456 登录 → 跳 dashboard
# - 进入用户管理 → 看到 mock 列表（至少 3 条，含 vben/admin/jack）
# - 新建一条 → 列表刷新（多一条）
# - 编辑某条 → 保存 → 列表刷新（变化生效）
# - 删除某条 → 列表刷新（少一条）
# - F12 Network 看到 /api/auth/login /api/user/info /api/menu/all /api/auth/codes /api/system/user/list 全 200
# - 刷新页面 → 仍登录态
# - 关闭整个浏览器（cmd/ctrl+shift+w）再开 → 仍登录态（localStorage 持久化）
# - 不勾「记住我」登录 → 关闭 tab → 重开 → 跳回登录页（sessionStorage 失效）
# - 侧边栏只有 Dashboard + 用户管理，无 system/dict、opm、permission、log、tenant、internal-message、Demos
# - 退出 → 跳回 /login
```

## D. 风险文件 / 回滚点

- **`src/api/rest/*`** 新建：出错可整目录删
- **`src/stores/auth.ts`**：出错会让所有登录态丢失；保留 git stash
- **`src/router/index.tsx`**：出错会让菜单空白；保留 git stash
- **`src/core/transport/rest/*`** 拦截器：401 处理逻辑若错会循环重定向；优先 mock 一次验证
- **`package.json`**：依赖误删会让 `pnpm install` 失败；保留 git stash

每个 Phase 完成时建议 `git add -A && git commit -m "feat(react-admin): <phase>"`，便于回滚到任意阶段。

## E. 启动 `task.py start` 前 checklist

- [x] prd.md 包含可测试验收标准
- [x] design.md 已写
- [x] implement.md 已写（含 review-gate 策略块、checklist、验证命令、回滚点）
- [x] 用户在对话中确认所有 5 个 open question 决策
- [x] 用户在对话中确认开发策略块（A. Development Strategy）
- [x] 用户批准进入实现
