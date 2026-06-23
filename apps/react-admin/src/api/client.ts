/**
 * 兼容旧调用方：保留 `apiClient` 命名导出，但底层是空对象。
 * 新代码请直接用 `@/api/rest/auth`、`@/api/rest/user`、`@/api/rest/menu`。
 */
export const apiClient = new Proxy(
  {},
  {
    get() {
      throw new Error(
        '[apiClient] 已废弃。请改用 @/api/rest/{auth,user,menu} 直接调用 REST 接口。',
      );
    },
  },
);
