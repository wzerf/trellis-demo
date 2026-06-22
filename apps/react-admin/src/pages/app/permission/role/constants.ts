/**
 * 角色模块枚举映射常量
 */

type TFn = (key: string, options?: Record<string, any>) => string;

// ========== 角色状态（与菜单模块一致：ON/OFF） ==========

export const STATUS_COLORS: Record<string, string> = {
  ON: 'success',
  OFF: 'error',
};

export function getStatusMap(t: TFn) {
  return {
    ON: { text: t('statusMap.ON'), color: STATUS_COLORS.ON },
    OFF: { text: t('statusMap.OFF'), color: STATUS_COLORS.OFF },
  };
}

export function getStatusOptions(t: TFn) {
  return [
    { label: t('statusMap.ON'), value: 'ON' },
    { label: t('statusMap.OFF'), value: 'OFF' },
  ];
}

// ========== 权限树构建 ==========

interface TreeNode {
  key: number;
  title: string;
  children?: TreeNode[];
}

/**
 * 根据权限组和权限列表构建权限树
 * 权限组作为父节点，权限作为子节点
 */
export function buildPermissionTree(
  groups: Array<{ id?: number | string; title?: string; name?: string; code?: string }>,
  permissions: Array<{
    id?: number | string;
    title?: string;
    name?: string;
    code?: string;
    groupId?: number | string;
  }>,
): TreeNode[] {
  return (groups || []).map((group) => {
    const groupChildren = (permissions || [])
      .filter((p) => String(p.groupId) === String(group.id))
      .map((p) => ({
        key: Number(p.id),
        title: p.title || p.name || p.code || String(p.id),
      }));

    return {
      key: Number(group.id),
      title: group.title || group.name || group.code || String(group.id),
      children: groupChildren,
    };
  });
}

/**
 * 从权限树勾选值中提取所有数字 ID（过滤掉非数字值）
 */
export function filterNumbers(values: any[]): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .flat(Infinity)
    .filter((v) => typeof v === 'number' && !isNaN(v))
    .map((v) => Number(v));
}
