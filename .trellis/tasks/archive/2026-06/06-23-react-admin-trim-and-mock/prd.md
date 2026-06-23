# 精简 react-admin 对齐 vben 并对接 mock

## Goal

将 `apps/react-admin` 精简为与 `apps/vue-vben-admin`（web-naive 简化版）等价的最小可用骨架（登录 + Dashboard + 用户管理 + 基础布局），并把所有 HTTP 接口从当前指向 Go gRPC 后端（`http://localhost:7788`）改为指向 `apps/backend-mock-template`（Nitro/vben 风格 REST API）。

## Confirmed Facts（来自代码勘探）

- `apps/react-admin/package.json` 是 ant-design-pro 风格 React 19 + Vite 项目，依赖 ProComponents / antd v6 / TanStack Query / Zustand / i18next / axios。
- `apps/react-admin/src/api/client.ts` 当前通过 `createApiClient(transport)` 调用 `@/api/generated/admin/service/v1` 的 gRPC-style service（`apiClient.authenticationService.Login`、`apiClient.userService.*`、`apiClient.adminPortalService.GetNavigation` 等）。请求实际由 `@/core/transport/rest` 的 `RequestClient`（基于 axios）发送。
- `.env.development` 当前指向 `VITE_API_URL=http://localhost:7788`（Go 后端 gRPC 风格），跨域代理 `[["/admin", "http://127.0.0.1:7788/"]]`。
- `apps/backend-mock-template`（Nitro + h3）已提供 vben 风格 REST：
  - `POST /auth/login` → `{ accessToken, refreshToken, ...user }`，refreshToken 写入 cookie
  - `POST /auth/logout` → 清 cookie
  - `POST /auth/refresh` → 新 accessToken
  - `GET /auth/codes` → 权限码数组
  - `GET /user/info` → 用户信息
  - `GET /menu/all` → 路由菜单
  - `GET /system/user/list`、`GET /system/role/list`、`GET /system/menu/list`、`GET /system/dept/list` 等
  - mock 用户：`vben / 123456`（super）、`admin / 123456`（admin）、`jack / 123456`（user）
- 现有 `apps/react-admin` 功能范围（远超 vben 最小骨架，需要裁掉）：
  - Dashboard（已实现，含统计卡片、趋势图、雷达图、饼图）
  - system/*（dict、file、language、login-policy、task）— 全部超出核心范围
  - opm/*、permission/*、log/*、tenant/*、internal-message/* — 全部超出核心范围
  - register、找回密码等额外认证流程
- `apps/react-admin/src/api/hooks/` 中 25+ 个 gRPC 风格 hook 文件全部依赖 `@/api/generated/admin/service/v1`。
- `apps/react-admin/src/api/generated/admin/` 是 protoc-gen-typescript-http 生成的代码，不能直接复用（与 mock 的 REST 契约不匹配）。

## Requirements

### 1. 功能范围裁剪

**保留**：
- 登录页（账号 + 密码 + 记住我；保留 vben 默认账号提示）
- Dashboard（沿用现有页面与图表，数据来源允许先用 mock 静态数据，后续按需切换）
- 用户管理（列表 + 搜索 + 新建/编辑/删除），对应对接 `GET/POST/PUT/DELETE /system/user/list`
- 基础布局：MainLayout（侧边栏 + 顶栏 + 标签栏 + 面包屑 + 内容区）、UserLayout（登录容器）、IFrameLayout、BlankLayout
- 菜单 + 权限码（vben 风格 fetch + 缓存）
- 国际化（保留 `zh-CN / en-US`）
- 主题 / 偏好（保留现有 preferences store，不动）
- 错误页（403、404、500）
- 路由守卫（AuthGuard、GuestGuard）

**移除**（保留代码但停止注册路由 / 不接入菜单）：
- system/dict、system/file、system/language、system/login-policy、system/task
- opm/*、permission/*、log/*、tenant/*、internal-message/*
- register、找回密码、扫码登录
- tiptap、md-editor、monaco-editor、json-editor-vue、echarts-for-react 等仅 demo 使用的重型依赖（评估后清理 package.json）
- system/role、system/menu、system/dept 三个管理页（先不保留；若 mock 已提供 list 接口，留待后续再启用）

### 2. 接口对接

将所有 HTTP 调用从 gRPC 风格切到 vben 风格 REST：

| 场景 | URL | 方法 | 备注 |
| --- | --- | --- | --- |
| 登录 | `/auth/login` | POST | 走 mock；password 改为明文（mock 校验明文） |
| 登出 | `/auth/logout` | POST | 走 mock |
| 刷新 Token | `/auth/refresh` | POST | 走 mock（基于 cookie） |
| 权限码 | `/auth/codes` | GET | 走 mock |
| 当前用户 | `/user/info` | GET | 走 mock |
| 用户列表 | `/system/user/list` | GET | 走 mock；保留分页与搜索 |
| 动态菜单 | `/menu/all` | GET | 走 mock |
| 其余 5xx / 网络错误 | 走 RequestClient 拦截器 | — | 复用现有拦截器 |

**关键契约差异与对策**：
- mock 用 `accessToken` 字段（驼峰），现 react-admin store 用 `access_token`（下划线）—— 重写 store 字段名对齐。
- mock 登录返回里直接有 userInfo，react-admin 现 store 登录后会再调一次 `fetchUserProfile`—— 按 Q5 决策，**登录后调一次 `/user/info` 补全**。
- mock 的 refreshToken 通过 HttpOnly cookie，前端读不到—— 按 Q2 决策，**Store 完全删除 `refreshTokenValue` / `refreshTokenExpireAt` 字段**，依赖 cookie；`POST /auth/refresh` 不带 body。
- mock `/auth/refresh` 原返回裸字符串（与其它端点不统一）—— 已修复为 `useResponseSuccess({ accessToken })`。
- mock cookie 在 dev 用 `lax + 非 secure`，prod 用 `none + secure`（按 `process.env.NODE_ENV` 切换）；`apps/backend-mock-template/utils/cookie-utils.ts` 已改。
- mock `/system/user/*` 的 POST/PUT/DELETE 原被中间件全局拦截—— 已修复为只拦 `/api/system/` 下非 user 路径，便于用户管理页做 CRUD。
- mock `/system/user/list` 原返回通用字段（name/status/remark）—— 已改为返回 user-shaped 数据（username/realName/email/phone/roles/createTime），并新增 `create.post.ts` / `[id].put.ts` / `[id].delete.ts` 三个 handler 与 `getMockUserList()` 共享状态。
- mock `/menu/all` 返回 Dashboard + Demos 两组菜单—— 前端在 `router/index.tsx` 的 `fetchMenuListAsync` 中过滤掉 path 不在 `pageMap` 内的项；具体策略见 `design.md §2.2`。
- 现 react-admin 用了 AES 加密密码，mock 不接受加密—— 登录链路去掉 `encryptPassword`。
- mock 登录响应已不再回显 `password` 字段（`apps/backend-mock-template/api/auth/login.post.ts` 已过滤）。

### 3. 网络基础

- `.env.development`：`VITE_API_URL=http://localhost:3000`（mock 默认端口，需查 mock 实际端口并确认）、`VITE_PROXY` 改为把 `/api` 代理到 mock 端口
- `.env.production`：留空或指向同源部署
- `bootstrap.ts` 注入 RequestClient 的方式保持不变（`RequestClient.init` 仍然接收 baseURL 与 refreshToken 回调）

### 4. 代码改动边界

- 删 / 改：`@/api/generated/**`（gRPC 风格生成代码）—— 改为新的 `@/api/rest/**` 目录，用 `requestApi` 直接发请求；或者保留目录但内容替换为新的 REST hook。
- 改：`@/api/client.ts` —— 移除 `createApiClient`，或保持导出但由 REST hook 直接用 `requestApi`。
- 改：`@/api/index.ts` —— 重新导出 REST hooks。
- 改：`@/stores/auth.ts` —— 调整字段命名（`access_token` → `accessToken`），去掉 AES 加密，refresh 流程改 cookie 模式。
- 改：`@/hooks/useAuth.ts`、`@/hooks/useTokenRefresh.ts` —— 跟随 store 调整。
- 改：`@/router/index.tsx` —— 把 `adminPortalService.GetNavigation` 替换为 `GET /menu/all`；`fetchMenuListAsync` 内对返回的菜单做 `pageMap` key 命中过滤（详见 `design.md §2.2`），未命中 `pageMap` 的菜单不渲染；layoutMap 保留 `BasicLayout`（= `AuthenticatedLayout`）。
- 删：未使用的 `api/hooks/{dict,file,file-transfer,internal-message,language,login-audit-log,login-policy,menu,operation-audit-log,org-unit,permission,permission-audit-log,permission-group,policy-evaluation-log,position,role,task,tenant,user-profile,api-audit-log,api,admin-portal,data-access-audit-log}.ts`（保留 `auth.ts`、`user.ts`，重写后端调用）

### 5. 不在本次范围

- vue-vben-admin 中其它业务模块（demos、about、profile、abp、ai 等）
- 注册、找回密码、扫码登录、短信登录
- SSE / 实时通知
- 多租户、暗色 / 亮色之外的主题分支
- 性能测试、E2E、CI 调整
- Mock backend 自身改造（保持现有端点不动）

## Acceptance Criteria

- [ ] `pnpm --filter ant-design-pro dev` 启动后，浏览器能打开 `http://localhost:7000`，未登录时跳转到登录页。
- [ ] 用 mock 内置账号 `vben / 123456`、`admin / 123456`、`jack / 123456` 任一登录成功，跳到 dashboard 页面，顶部显示用户名与角色。
- [ ] 登录后侧边栏至少包含 Dashboard 菜单项（不再包含 system / opm / permission / log / tenant / internal-message）。
- [ ] 用户管理页 `/{admin path}/system/user` 可访问，调用 `GET /system/user/list` 拉取 mock 用户列表（至少展示 3 条），可对单条做编辑并保存，列表刷新后变化生效。
- [ ] F12 Network 面板：`POST /auth/login`、`GET /user/info`、`GET /menu/all`、`GET /auth/codes`、`GET /system/user/list` 全部 200，路径不带 `/admin` 前缀。
- [ ] 刷新页面后仍能保持登录态（accessToken 持久化），但 refreshToken 不再写入 localStorage。
- [ ] 在登录页点击「记住我」复选框后，登录态在浏览器关闭后仍保留。实现方式：自定义 zustand `persist` storage，登录时传 `remember: boolean`，true → `localStorage`、false → `sessionStorage`；登录页 `LoginForm` 暴露复选框，调用 `useAuthStore.login({...}, { remember })` 透传。
- [ ] `pnpm --filter ant-design-pro build:check` 全部通过（`tsc` + `vite build`）。
- [ ] `pnpm --filter ant-design-pro lint` 全部通过。
- [ ] 现有 `apps/react-admin` 中 `src/pages/app/{opm,permission,log,tenant,internal-message}` 与 `src/pages/app/system/{dict,file,language,login-policy,task}` 目录保留但路由不再注册；`@/api/hooks` 中非 `auth / user` 文件可标记 `@deprecated` 或删除（实现选型待 design 阶段决定）。
- [ ] `src/pages/app/system/user/index.tsx` 新建：基于 ProComponents `ProTable` 渲染用户列表（来自 `GET /system/user/list`），含搜索（username、realName、status）、新建/编辑（弹窗调 `POST /api/system/user` 与 `PUT /api/system/user/:id`）、删除（调 `DELETE /api/system/user/:id`）；路由在 `src/router/modules/system.tsx` 中以 `/system/user` 形式注册到 `BasicLayout` 之下，菜单项通过 `meta.title` 显示。
- [ ] `src/pages/core/auth/register/**` 目录**保留**（与 system/dict 等保持一致策略：目录保留 + 路由不注册），避免破坏 i18n key 与未来扩展面。
- [ ] 文档 `apps/react-admin/README.md` 中说明：1) 启动顺序（先 mock 后前端）；2) 默认账号；3) 已裁剪功能清单。

## Open Questions（待设计阶段定）

1. **API 重写策略** ✅ 选 A：**彻底替换**。删除 `src/api/generated/**` 与 `api/client.ts` 中的 `createApiClient`，新建 `src/api/rest/**`，用 `requestApi` 直接发 REST 请求，类型手写。
2. **refreshToken 流程** ✅ 选 A：**去掉 `refreshTokenValue` 字段，依赖 cookie**。Store 删除 `refreshTokenValue` / `refreshTokenExpireAt`，不再从登录响应体取值。`bootstrap.ts` 注入的 `refreshToken` 回调改为直接 `POST /auth/refresh`（mock 内部读 cookie 换新 accessToken）。拦截器在 401 时调用该回调，失败则跳登录页。
3. **菜单来源** ✅ 与 vue-vben-admin 一致：**后端动态菜单 + 保留 pageMap 机制**。调用 `GET /menu/all` 拉菜单，前端用 `pageMap = import.meta.glob('../pages/app/**/*.tsx')` + `layoutMap` 把后端返回的 component 字符串映射到 React 组件，最终由类似 `generateAccessible()` 的函数合并出可访问路由。`src/router/index.tsx` 的 `createAccessibleRouter` 路径已存在，沿用即可。
4. **依赖清理范围** ✅ 选 A：**保守清理**。仅清 vben 中完全没出现且现代码中确认无引用的包：`@tiptap/*` 全家桶、`md-editor-rt`、`monaco-editor`、`json-editor-vue`、`lowlight`、`highlight.js`、`@microsoft/fetch-event-source`、`echarts-for-react`（保留 `echarts` 因为 Dashboard 图要用）、`@tanstack/react-query-devtools`（dev 中如果未用）。`crypto-js` / `lodash` / `lodash.clonedeep` / `react-activation` / `overlayscrollbars` 等保留。清理后必须 `pnpm install` + `pnpm --filter ant-design-pro build:check` 通过。
5. **登录响应字段映射** ✅ 选 A：**登录后再调一次 `/user/info`**。与 vben 形态一致，能拿到 mock 登录响应里没返回的扩展字段（homePath、tenantId、avatar 等）。`stores/auth.ts` 的 `login` action 内部：调 `POST /auth/login` → 存 `accessToken` → 调 `GET /user/info` → 存 `userInfo` → 启动 refresh timer。
