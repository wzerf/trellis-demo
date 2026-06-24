# 字典管理 react-admin 前端

## 目标

在 `apps/react-admin` 中落地字典管理 UI：路由 `/system/dict`，列表页采用 master-detail 双表 + drawer 交互。替换现有 stub（`src/api/hooks/dict.ts` 与 `src/hooks/useDictCache.ts` 抛错版本）。调用 `backend-mock-template` 提供的同一组 `/api/system/dict-type/*` 与 `/api/system/dict-data/*`。

## 范围

新增：

- `src/api/rest/dict-type.ts`：list / all / detail / create / update / delete。
- `src/api/rest/dict-data.ts`：list / byTypeCode / create / update / delete。
- `src/api/hooks/dict.ts`：替换 stub；导出 useQuery / useMutation hooks。
- `src/api/hooks/index.ts`：re-export `./dict`。
- `src/api/rest/types.ts`：新增 DictType / DictData 类型 + 列表 / 创建 / 更新请求类型。
- `src/api/rest/index.ts`：re-export dict-type / dict-data。
- `src/pages/app/system/dict/index.tsx`：主页（双表 + 抽屉 + 开关）。
- `src/pages/app/system/dict/modules/dict-type-drawer.tsx`：字典类型新建/编辑抽屉。
- `src/pages/app/system/dict/modules/dict-data-drawer.tsx`：字典项新建/编辑抽屉。
- `src/router/modules/system.tsx`：在 system 父路由下加 `dict` 子路由（仿照 user）。
- `src/locales/zh-CN/_modules/dict-type.json`：扩充已有占位文案。
- `src/locales/zh-CN/_modules/dict-entry.json`：扩充。
- `src/locales/en-US/_modules/dict-type.json`：同。
- `src/locales/en-US/_modules/dict-entry.json`：同。
- `src/locales/zh-CN/_core/routes.json`：在 system 下追加 dict 路由的 title。
- `src/locales/en-US/_core/routes.json`：同。

修改：

- `src/api/rest/request.ts`：保持现有 REST 客户端不变（无需新增拦截器）。
- `src/router/index.tsx`：动态加载模块可能自动覆盖，但建议同时显式注册。

## 验收标准

- [ ] `pnpm --filter react-admin dev` 启动后，登录（`vben/123456`）进入侧栏「系统管理 / 字典管理」路由。
- [ ] 字典类型表加载 5 条种子，code / name / 状态可过滤；分页正常。
- [ ] 字典类型点击行后右侧字典项表自动加载该 type 的所有条目。
- [ ] 「新建类型 / 编辑类型 / 删除类型」+「新建条目 / 编辑条目 / 删除条目」均走 Ant Modal / Drawer，校验失败 message.error；成功后 message.success 且表格 refetch。
- [ ] 删除字典类型时若仍有字典项，后端 400 → 前端 message.error 显示「请先清空字典项」。
- [ ] 启用 / 禁用切换走 Antd Switch，状态字段同步 is_enabled。
- [ ] 现有 `src/hooks/useDictCache.ts` 与 `src/api/hooks/dict.ts` 不再抛错（删除 stub 注释 / 重写为真实实现）。
- [ ] 全程无 console error / TS 类型错误。

## 非目标

- 不引入 ProTable / ProComponents；保持原生 Antd Table。
- 不实现字典下拉组件与全局字典缓存（沿用 stub 行为即可：返回空数组）。
- 不做权限码绑定（按钮统一显示）。

## 风险

- react-admin 当前 dict 路由没注册，要确保 `router/modules/system.tsx` 注册 dict 后菜单可见。
- `useDictCache.ts` 旧调用方可能依赖返回空数组的语义；保持 stub 兼容（仍返回空 + 提供主动加载接口）。
- i18n 文件已存在但 key 集合可能不全，需要扩充并确保与 vue-vben-admin 同步（最终两份独立的语言文件，但 key 命名对齐）。
