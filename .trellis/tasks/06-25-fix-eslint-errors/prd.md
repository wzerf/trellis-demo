# 修复 react-admin 全部 eslint 错误 + backend-mock-template tsconfig 优化

## 背景

`pnpm -C apps/react-admin exec eslint --fix` 已跑完,但还有 185 errors / 23 warnings,分布在 64 个文件。
`pnpm exec vp check --fix` 留 0 errors / 64 warnings,全部在 `apps/backend-mock-template/`。

## 目标

1. `pnpm -C apps/react-admin exec eslint` 退出码 0(允许残留非阻断 warning)。
2. `pnpm exec vp check` 退出码 0,backend-mock-template 部分消除 no-base-to-string 与 no-useless-default-assignment warning。

## 修复范围

### react-admin eslint(185 errors + 23 warnings)

| 规则 | 数量 | 处理方式 |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | 134 | 根据 import / 调用上下文推断真实类型;必要时引入 `unknown` + 类型守卫。 |
| `@typescript-eslint/no-unused-vars` | 19 | 移除未使用变量/参数(下划线前缀参数除外);若需保留可加 `_` 前缀。 |
| `react-hooks/exhaustive-deps` | 19 | 补齐缺失依赖或重构逻辑使依赖可声明;实在不行用 `useMemo`/`useCallback` 内部化。 |
| `react-hooks/set-state-in-effect` | 9 | 把 effect 内的同步 setState 改成初始化/计算/事件处理,必要时用 `useSyncExternalStore` 替代。 |
| `@typescript-eslint/no-non-null-assertion` | 5 | 替换为可选链 + 显式分支;仅在确有运行时保证时改用类型断言。 |
| `react-hooks/rules-of-hooks` | 3 | 调整 hooks 顺序,确保 hooks 在所有 early return 之前调用。 |
| `react-refresh/only-export-components` | 2 | 把非组件导出抽到独立文件。 |
| `@typescript-eslint/no-empty-object-type` | 1 | 改用 `type` 别名或合并继承类型。 |
| `no-empty-function` 等 warning | 12 | 加注释/补 return/参数重构。 |
| `max-params` warning | 2 | 合并相邻参数为 options 对象。 |
| `brace-style` warning | 1 | 让 `pnpm exec vp staged` 自动修。 |

### backend-mock-template tsconfig

- 在 `apps/backend-mock-template/tsconfig.json` 显式开启 `strictNullChecks: true`,消除 biome 的 `no-useless-default-assignment` 提示。
- `String(item.xxx)` 改为 `item.xxx.toString()` 或显式类型断言,消除 `no-base-to-string`。

## 验收

```bash
pnpm -C apps/react-admin exec eslint
pnpm exec vp check
```

两条都退出码 0(或只剩可接受的 warning)。

## 实施策略

1. **非 any 类优先**(约 60 处):unused-vars、no-non-null-assertion、rules-of-hooks、refactor 文件拆分、empty object type,这些 1-3 行就能改完。
2. **any 类型**(134 处):按文件分批;先从 `utils/`、`hooks/`、`core/` 开始(这些是其它文件依赖的类型,改一处能消多处的间接 any)。
3. **hooks 规则**:exhaustive-deps 与 set-state-in-effect 涉及行为,需要逐处判断后修改。
4. **backend-mock-template**:tsconfig 改动一行;`String(item.xxx)` 全局替换。

每完成一批都跑一遍 eslint 验证。
