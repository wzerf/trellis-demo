# design.md — 精简 react-admin 对齐 vben 并对接 mock

## 1. 架构与边界

### 1.1 顶层

```
apps/react-admin/                          # 前端 (React 19 + Vite + antd v6)
├── src/
│   ├── api/
│   │   ├── rest/                           # 【新】vben 风格 REST hooks
│   │   │   ├── request.ts                  # 复刻 vben 的 fetch wrappers
│   │   │   ├── auth.ts                     # login/logout/refresh/codes
│   │   │   ├── user.ts                     # getUserInfo / listUsers / createUser / ...
│   │   │   └── menu.ts                     # getAllMenus
│   │   ├── hooks/                          # 保留 auth.ts / user.ts,重写内部调用
│   │   ├── types/                          # 【新】vben 风格的类型定义
│   │   └── index.ts                        # 重新导出
│   ├── stores/
│   │   └── auth.ts                         # 字段重命名 / 去掉 refreshTokenValue
│   ├── router/
│   │   └── index.tsx                       # 改 pageMap,接 GET /menu/all
│   ├── pages/
│   │   ├── core/auth/login/                # 保留
│   │   ├── app/dashboard/                  # 保留
│   │   └── app/system/user/                # 保留(对齐 vben 的 /system/user/list)
│   └── layouts/                            # 保留 4 个
└── .env.development                       # 改 VITE_API_URL 到 mock 端口

apps/backend-mock-template/                 # 保持不动
```

### 1.2 模块边界

- **`@/api/rest/*`**：唯一允许发 HTTP 请求的位置。其它模块必须通过这些 hooks / fetchers。
- **`@/stores/auth.ts`**：唯一访问 token / userInfo 的位置（组件通过 selector 拿）。
- **`@/router/index.tsx`**：唯一拼装路由的位置（动态 + 静态合并）。
- **删除的目录**：
  - `src/api/generated/**`（gRPC 生成代码）
  - `src/api/hooks/{dict,file,file-transfer,internal-message,language,login-audit-log,login-policy,menu,operation-audit-log,org-unit,permission,permission-audit-log,permission-group,policy-evaluation-log,position,role,task,tenant,user-profile,api-audit-log,api,admin-portal,data-access-audit-log}.ts`（标记 `@deprecated` 或删除）
  - `src/api/client.ts`（不再有 `createApiClient`）
  - `src/pages/app/{opm,permission,log,tenant,internal-message}/**` 目录保留（用户要求保留代码），但路由不再注册
  - `src/pages/app/system/{dict,file,language,login-policy,task}/**` 同上

## 2. 数据流与契约

### 2.1 登录流

```
LoginForm
  └── useAuthStore.login({ username, password })        # 明文，不再 encryptPassword
        ├── requestApi({ path: '/auth/login', method: 'POST', body: { username, password } })
        │     └── mock → { id, username, realName, roles, accessToken, ... } (refreshToken 仅写入 cookie, 不暴露)
        ├── set({ accessToken, accessTokenExpireAt = now + 7200*1000 })
        ├── fetchUserInfo()
        │     └── GET /user/info → { id, username, realName, roles, homePath, ... }
        │     └── set({ userInfo })
        ├── startRefreshTimer()                          # 启动定时刷新
        └── window.location.href = userInfo.homePath ?? '/dashboard'
```

### 2.2 路由流

```
AppRouter.useEffect([isAuthenticated, accessMode])
  ├── 若 isAuthenticated:
  │     ├── useAuth().getUserPermissionCodes()           # GET /auth/codes
  │     └── fetchAllDictEntries()                        # 预加载字典(可选)
  └── createAccessibleRouter(accessMode, {
        routes: allRoutes,                                # 静态 + 模块路由
        permissions: getAccessStatic().getAllPermissions(),
        fetchMenuListAsync: async () => {
          const items = await getAllMenusApi();           # GET /menu/all
          // mock 返回 Dashboard + Demos；保留命中 pageMap 的项，避免空白菜单
          return items.filter((m) => pageMapKeyHit(m, pageMap));
        },
        layoutMap, pageMap, ...
      })
```

**pageMap key 命中规则**（详见实现）：
- 后端 `component` 字段如 `/dashboard/analytics/index` → 标准化为 `/dashboard/analytics`
- 命中 `pageMap` 任一键（`/dashboard`、`/dashboard/index`、`/dashboard.tsx`、`/dashboard/index.tsx`）即保留
- 不命中则过滤掉（同时把 children 一并清空），避免路由渲染时找不到组件报错
- Demos 路径（如 `/demos/access/admin-visible`）在 react-admin 中无对应文件 → 过滤掉，sidebar 不会出现

### 2.3 拦截器流

```
RequestClient.onError / onReAuthenticate
  ├── 401 → refreshToken():
  │     ├── POST /auth/refresh (空 body)                  # cookie 自动带,mock 直接读
  │     ├── 响应是 useResponseSuccess({ accessToken })    # mock 已修
  │     ├── 成功 → set({ accessToken, accessTokenExpireAt })
  │     └── 失败 → forceLogout()                          # 清 storage + 跳登录页
  └── 其它错误 → getErrorMsg() 国际化
```

**Cookie sameSite/secure 行为**（mock 端修改）：
- `process.env.NODE_ENV === 'production'`：`SameSite=None; Secure`，要求 HTTPS 才发送
- 开发态：fallback 到 `SameSite=Lax` 且不强制 `Secure`，HTTP 开发能正常工作
- 前端 Vite 必须配 `server.proxy['/api']` → `http://localhost:3000`，保证同源才能正确携带 cookie
- `.env.development` 中 `VITE_API_URL` 设为 `''`（空串走相对路径），配合 Vite proxy

### 2.4 mock 契约差异点

| 项 | mock 实际 | 现 react-admin 假设 | 调整 |
| --- | --- | --- | --- |
| 登录返回字段 | `accessToken`、`refreshToken`（cookie）、`id`/`username`/`realName`/`roles`/`homePath?`，已不再包含 `password` | `access_token`/`refresh_token`/`expires_in`/`refresh_expires_in` | store 改用驼峰 + 写死 expiresIn=7200 |
| 密码 | 明文 | AES 加密 | login 链路去掉 `encryptPassword` |
| refreshToken | HttpOnly cookie | 请求体字段 | 去掉 `refreshTokenValue` 字段，依赖 cookie |
| refresh 响应 | 已修复为 `useResponseSuccess({ accessToken })` | 假设是裸字符串 | 拦截器按 wrapped 解析 |
| Cookie sameSite | dev `lax`，prod `none` | 假设 dev 也 `none+secure`（HTTP 失败） | dev 走 `lax`，配合 Vite `/api` 代理同源 |
| 用户列表 | `GET /system/user/list` 返回 `{items,total}` 包装的 user-shaped 数据 | `identityservicev1_ListUserResponse {items,total}` | 新写类型；`/system/user/*` 的 POST/PUT/DELETE 已可用（mock 中间件放行） |
| 菜单 | `GET /menu/all` 返回 Dashboard + Demos | `adminPortalService.GetNavigation {items}` | 前端 pageMap 命中过滤 |
| 权限码 | `GET /auth/codes` 返回 `["AC_100100",...]` | 现假设类似 | 复用 vben access 工具的 `hasAccessByAuth` |
| 记住我 | n/a | 需支持 | 自定义 zustand persist storage：remember=true → localStorage；false → sessionStorage |

## 3. 兼容性 / 迁移

- **gRPC 后端不再使用**：`.env.development` 改 `VITE_API_URL=http://localhost:3000`（mock 实际端口，nitro 默认 3000，需启动一次确认）。`VITE_PROXY` 删 `/admin` 配置，新增 `/api → http://localhost:3000`。
- **持久化 key 变更**：`auth-storage` 内容从 `{accessToken, refreshTokenValue, accessTokenExpireAt, refreshTokenExpireAt}` 改为 `{accessToken, accessTokenExpireAt}`，无 refreshToken。需在 `bootstrap` 启动时清理一次旧 key 防止 hydrate 失败（`partialize` 自动丢弃，但旧 localStorage 残留可以忽略）。
- **localStorage 清理**：保留 `auth-storage` / `user-storage`，删除 `auth-storage` 里 `refreshTokenValue` 字段（zustand persist 会自动忽略 partialize 没暴露的字段）。
- **路由变化**：所有 `/admin` 前缀消失（因为没有 `/admin` 代理了）。原 `/#/dashboard` 这种 hash router？检查实际是否用 `createBrowserRouter`。

## 4. 重要权衡

- **保留 pageMap + 后端 component 机制**（决策 Q3）：与 vben 一致，代价是 `src/router/index.tsx` 仍较复杂，bug 面比纯静态路由大。好处是后续要新增业务页时只需在后端菜单数据里加一条。
- **去掉 refreshTokenValue 字段**（决策 Q2）：与 mock cookie 设计对齐，store 字段更少；代价是失去"前端能看见 refreshToken"的可见性，未来如果要切到 OIDC 风格（refreshToken 不放 cookie）需要回填。
- **登录后再调 `/user/info`**（决策 Q5）：多一次请求；好处是 userInfo 形状独立于登录响应，便于 mock 升级时不动 login flow。
- **保守清理依赖**（决策 Q4）：避免误删，代价是 `package.json` 仍有冗余（vben 中没有的包）。
- **彻底替换 gRPC generated 目录**（决策 Q1）：diff 大、调用方全部更新，类型需手写；好处是 `api/rest/` 目录与契约一一对应。

## 5. 运维 / 回滚

- **回滚点 1**：如果 `pnpm --filter ant-design-pro build:check` 失败，回退到删 `src/api/rest/`、恢复旧的 `src/api/generated/` + `src/api/client.ts`。
- **回滚点 2**：如果菜单渲染异常但功能正常，回退到 `src/router/index.tsx` 旧的 `adminPortalService.GetNavigation`。
- **回滚点 3**：包依赖清理如引发运行时错误（极少见），回退 `package.json` + `pnpm install`。
- **mock 启动验证**：`cd apps/backend-mock-template && pnpm start`，浏览器访问 `http://localhost:3000/api/auth/login` POST 应返回 mock user 数据。
- **环境前置**：mock 必须先启动；前端 `pnpm --filter ant-design-pro dev` 期望 7000 端口（已固定）；同时启动 `pnpm dev` 在仓库根目录会启所有 app（如果配置）。
- **数据安全**：登录失败提示不要回显密码；refreshToken 不写入 localStorage 后彻底无 XSS 面。

## 6. 风险点

- **dashboard 图表数据**：现版本图表数据是写死的字符串，不发请求；不依赖后端，迁移到 mock 后行为不变。
- **layoutMap 中 BasicLayout 名字**：现代码用 `BasicLayout`，mock 返回的 `component` 字段需要匹配（如 `BasicLayout`、`IFrameView`），不一致会导致菜单点击空白。
- **pageMap 路径格式**：mock 菜单中 `component` 字段如 `/system/user/list` 需要映射到 `src/pages/app/system/user/list.tsx`（去掉 `/pages/app` 前缀），glob 路径已处理。
- **i18n key 缺失**：Dashboard 中 `t('stats.users')` 等 key 必须保留；不要在裁剪 i18n 文件时把 dashboard 的 key 删了。
- **react-activation KeepAlive**：Dashboard 不需要；如未使用，可以保留（保守清理）也可在第二轮清。
- **user list 字段 shape 变更**：mock 现返回 user-shaped 数据（username/realName/email/phone/roles/createTime），UI 必须用 ProTable 的 column 定义对齐；状态字段 `status: 0|1` 用 `Badge` 渲染。
- **mutations 已被 mock 中间件放行**：`/api/system/user/*` 下的 POST/PUT/DELETE 可用；其它 system 路径仍被拦截（保持 mock 的「演示环境」原则）。
- **register 目录策略**：与 system/dict 等保持一致，**保留目录 + 路由不注册**，避免破坏 i18n key（`'auth:register.*'`）。
