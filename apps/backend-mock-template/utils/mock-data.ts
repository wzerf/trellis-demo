export interface UserInfo {
  id: number;
  password: string;
  realName: string;
  roles: string[];
  username: string;
  homePath?: string;
}

export interface TimezoneOption {
  offset: number;
  timezone: string;
}

export const MOCK_USERS: UserInfo[] = [
  {
    id: 0,
    password: "123456",
    realName: "Vben",
    roles: ["super"],
    username: "vben",
  },
  {
    id: 1,
    password: "123456",
    realName: "Admin",
    roles: ["admin"],
    username: "admin",
    homePath: "/workspace",
  },
  {
    id: 2,
    password: "123456",
    realName: "Jack",
    roles: ["user"],
    username: "jack",
    homePath: "/analytics",
  },
];

export const MOCK_CODES = [
  // super
  {
    codes: ["AC_100100", "AC_100110", "AC_100120", "AC_100010"],
    username: "vben",
  },
  {
    // admin
    codes: ["AC_100010", "AC_100020", "AC_100030"],
    username: "admin",
  },
  {
    // user
    codes: ["AC_1000001", "AC_1000002"],
    username: "jack",
  },
];

const dashboardMenus = [
  {
    meta: {
      order: -1,
      title: "page.dashboard.title",
    },
    name: "Dashboard",
    path: "/dashboard",
    redirect: "/analytics",
    children: [
      {
        name: "Analytics",
        path: "/analytics",
        component: "/dashboard/analytics/index",
        meta: {
          affixTab: true,
          title: "page.dashboard.analytics",
        },
      },
      {
        name: "Workspace",
        path: "/workspace",
        component: "/dashboard/workspace/index",
        meta: {
          title: "page.dashboard.workspace",
        },
      },
    ],
  },
];

const createDemosMenus = (role: "admin" | "super" | "user") => {
  const roleWithMenus = {
    admin: {
      component: "/demos/access/admin-visible",
      meta: {
        icon: "mdi:button-cursor",
        title: "demos.access.adminVisible",
      },
      name: "AccessAdminVisibleDemo",
      path: "/demos/access/admin-visible",
    },
    super: {
      component: "/demos/access/super-visible",
      meta: {
        icon: "mdi:button-cursor",
        title: "demos.access.superVisible",
      },
      name: "AccessSuperVisibleDemo",
      path: "/demos/access/super-visible",
    },
    user: {
      component: "/demos/access/user-visible",
      meta: {
        icon: "mdi:button-cursor",
        title: "demos.access.userVisible",
      },
      name: "AccessUserVisibleDemo",
      path: "/demos/access/user-visible",
    },
  };

  return [
    {
      meta: {
        icon: "ic:baseline-view-in-ar",
        keepAlive: true,
        order: 1000,
        title: "demos.title",
      },
      name: "Demos",
      path: "/demos",
      redirect: "/demos/access",
      children: [
        {
          name: "AccessDemos",
          path: "/demosaccess",
          meta: {
            icon: "mdi:cloud-key-outline",
            title: "demos.access.backendPermissions",
          },
          redirect: "/demos/access/page-control",
          children: [
            {
              name: "AccessPageControlDemo",
              path: "/demos/access/page-control",
              component: "/demos/access/index",
              meta: {
                icon: "mdi:page-previous-outline",
                title: "demos.access.pageAccess",
              },
            },
            {
              name: "AccessButtonControlDemo",
              path: "/demos/access/button-control",
              component: "/demos/access/button-control",
              meta: {
                icon: "mdi:button-cursor",
                title: "demos.access.buttonControl",
              },
            },
            {
              name: "AccessMenuVisible403Demo",
              path: "/demos/access/menu-visible-403",
              component: "/demos/access/menu-visible-403",
              meta: {
                authority: ["no-body"],
                icon: "mdi:button-cursor",
                menuVisibleWithForbidden: true,
                title: "demos.access.menuVisible403",
              },
            },
            roleWithMenus[role],
          ],
        },
      ],
    },
  ];
};

export const MOCK_MENUS = [
  {
    menus: [...dashboardMenus, ...createDemosMenus("super")],
    username: "vben",
  },
  {
    menus: [...dashboardMenus, ...createDemosMenus("admin")],
    username: "admin",
  },
  {
    menus: [...dashboardMenus, ...createDemosMenus("user")],
    username: "jack",
  },
];

export const MOCK_MENU_LIST = [
  {
    id: 1,
    name: "Workspace",
    status: 1,
    type: "menu",
    icon: "mdi:dashboard",
    path: "/workspace",
    component: "/dashboard/workspace/index",
    meta: {
      icon: "carbon:workspace",
      title: "page.dashboard.workspace",
      affixTab: true,
      order: 0,
    },
  },
  {
    id: 2,
    meta: {
      icon: "carbon:settings",
      order: 9997,
      title: "system.title",
      badge: "new",
      badgeType: "normal",
      badgeVariants: "primary",
    },
    status: 1,
    type: "catalog",
    name: "System",
    path: "/system",
    children: [
      {
        id: 201,
        pid: 2,
        path: "/system/menu",
        name: "SystemMenu",
        authCode: "System:Menu:List",
        status: 1,
        type: "menu",
        meta: {
          icon: "carbon:menu",
          title: "system.menu.title",
        },
        component: "/system/menu/list",
        children: [
          {
            id: 20_101,
            pid: 201,
            name: "SystemMenuCreate",
            status: 1,
            type: "button",
            authCode: "System:Menu:Create",
            meta: { title: "common.create" },
          },
          {
            id: 20_102,
            pid: 201,
            name: "SystemMenuEdit",
            status: 1,
            type: "button",
            authCode: "System:Menu:Edit",
            meta: { title: "common.edit" },
          },
          {
            id: 20_103,
            pid: 201,
            name: "SystemMenuDelete",
            status: 1,
            type: "button",
            authCode: "System:Menu:Delete",
            meta: { title: "common.delete" },
          },
        ],
      },
      {
        id: 202,
        pid: 2,
        path: "/system/dept",
        name: "SystemDept",
        status: 1,
        type: "menu",
        authCode: "System:Dept:List",
        meta: {
          icon: "carbon:container-services",
          title: "system.dept.title",
        },
        component: "/system/dept/list",
        children: [
          {
            id: 20_401,
            pid: 202,
            name: "SystemDeptCreate",
            status: 1,
            type: "button",
            authCode: "System:Dept:Create",
            meta: { title: "common.create" },
          },
          {
            id: 20_402,
            pid: 202,
            name: "SystemDeptEdit",
            status: 1,
            type: "button",
            authCode: "System:Dept:Edit",
            meta: { title: "common.edit" },
          },
          {
            id: 20_403,
            pid: 202,
            name: "SystemDeptDelete",
            status: 1,
            type: "button",
            authCode: "System:Dept:Delete",
            meta: { title: "common.delete" },
          },
        ],
      },
    ],
  },
  {
    id: 9,
    meta: {
      badgeType: "dot",
      order: 9998,
      title: "demos.vben.title",
      icon: "carbon:data-center",
    },
    name: "Project",
    path: "/vben-admin",
    type: "catalog",
    status: 1,
    children: [
      {
        id: 901,
        pid: 9,
        name: "VbenDocument",
        path: "/vben-admin/document",
        component: "IFrameView",
        type: "embedded",
        status: 1,
        meta: {
          icon: "carbon:book",
          iframeSrc: "https://doc.vben.pro",
          title: "demos.vben.document",
        },
      },
      {
        id: 902,
        pid: 9,
        name: "VbenGithub",
        path: "/vben-admin/github",
        component: "IFrameView",
        type: "link",
        status: 1,
        meta: {
          icon: "carbon:logo-github",
          link: "https://github.com/vbenjs/vue-vben-admin",
          title: "Github",
        },
      },
      {
        id: 903,
        pid: 9,
        name: "VbenAntdv",
        path: "/vben-admin/antdv",
        component: "IFrameView",
        type: "link",
        status: 0,
        meta: {
          icon: "carbon:hexagon-vertical-solid",
          badgeType: "dot",
          link: "https://ant.vben.pro",
          title: "demos.vben.antdv",
        },
      },
    ],
  },
  {
    id: 10,
    component: "_core/about/index",
    type: "menu",
    status: 1,
    meta: {
      icon: "lucide:copyright",
      order: 9999,
      title: "demos.vben.about",
    },
    name: "About",
    path: "/about",
  },
];

export function getMenuIds(
  menus: { id: number; children?: { id: number; children?: unknown[] }[] }[],
): number[] {
  const ids: number[] = [];
  menus.forEach((item) => {
    ids.push(item.id);
    if (item.children && item.children.length > 0) {
      ids.push(
        ...getMenuIds(
          item.children as { id: number; children?: { id: number; children?: unknown[] }[] }[],
        ),
      );
    }
  });
  return ids;
}

/**
 * 共享的可变用户列表，给 system/user 的 CRUD handler 使用。
 */
const mockUserList: any[] = [];

export function getMockUserList() {
  return mockUserList;
}

/**
 * 时区选项
 */
export const TIME_ZONE_OPTIONS: TimezoneOption[] = [
  {
    offset: -5,
    timezone: "America/New_York",
  },
  {
    offset: 0,
    timezone: "Europe/London",
  },
  {
    offset: 8,
    timezone: "Asia/Shanghai",
  },
  {
    offset: 9,
    timezone: "Asia/Tokyo",
  },
  {
    offset: 9,
    timezone: "Asia/Seoul",
  },
];

// ============================================================
// 字典管理（dict_type / dict_data）
// 字段对齐 Open Design 原型 mql4ww2b-schema.sql
// ============================================================

export interface DictType {
  id: number;
  code: string;
  name: string;
  remark: string;
  is_enabled: 0 | 1;
  deleted_at: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

export interface DictData {
  id: number;
  type_id: number;
  value: string;
  label: string;
  sort: number;
  is_default: 0 | 1;
  is_enabled: 0 | 1;
  deleted_at: number;
  remark: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  /**
   * 关联的字典类型编码，仅在 list 接口里 join 后返回；其他接口不返回该字段。
   */
  typeCode?: string;
}

/**
 * 共享的可变字典类型列表，给 system/dict-type 的 CRUD handler 使用。
 */
const mockDictTypeList: DictType[] = [];

export function getMockDictTypeList() {
  return mockDictTypeList;
}

/**
 * 共享的可变字典数据列表，给 system/dict-data 的 CRUD handler 使用。
 */
const mockDictDataList: DictData[] = [];

export function getMockDictDataList() {
  return mockDictDataList;
}

/**
 * 生成 mock 自增 ID（与 user 列表隔离，足够 demo 使用）。
 */
function nextDictId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * 惰性种子：首次 list 调用时填充。每个 typeId 显式固定，方便 dict-data 关联。
 */
function buildDictTypeSeeds(): DictType[] {
  const now = "2025-01-01T00:00:00.000Z";
  const baseTypes: DictType[] = [
    {
      id: 1,
      code: "sys_user_sex",
      name: "用户性别",
      remark: "用户性别字典",
      is_enabled: 1,
      deleted_at: 0,
      created_at: now,
      updated_at: now,
      created_by: 0,
      updated_by: 0,
    },
    {
      id: 2,
      code: "sys_yes_no",
      name: "系统是否",
      remark: "通用 Y/N",
      is_enabled: 1,
      deleted_at: 0,
      created_at: now,
      updated_at: now,
      created_by: 0,
      updated_by: 0,
    },
    {
      id: 3,
      code: "sys_menu_type",
      name: "菜单类型",
      remark: "DIR / MENU / BUTTON",
      is_enabled: 1,
      deleted_at: 0,
      created_at: now,
      updated_at: now,
      created_by: 0,
      updated_by: 0,
    },
    {
      id: 4,
      code: "sys_notice_type",
      name: "通知类型",
      remark: "通知/公告/提醒",
      is_enabled: 1,
      deleted_at: 0,
      created_at: now,
      updated_at: now,
      created_by: 0,
      updated_by: 0,
    },
    {
      id: 5,
      code: "sys_common_status",
      name: "通用状态",
      remark: "正常 / 停用",
      is_enabled: 1,
      deleted_at: 0,
      created_at: now,
      updated_at: now,
      created_by: 0,
      updated_by: 0,
    },
  ];
  return baseTypes;
}

function buildDictDataSeeds(): DictData[] {
  const now = "2025-01-01T00:00:00.000Z";
  const seed = (
    id: number,
    type_id: number,
    value: string,
    label: string,
    sort: number,
    is_default: 0 | 1 = 0,
  ): DictData => ({
    id,
    type_id,
    value,
    label,
    sort,
    is_default,
    is_enabled: 1,
    deleted_at: 0,
    remark: "",
    created_at: now,
    updated_at: now,
    created_by: 0,
    updated_by: 0,
  });
  // 字典类型单份 1..5；字典项 1001.. 起
  const entries: DictData[] = [];
  // sys_user_sex (type_id=1)
  entries.push(seed(1001, 1, "0", "男", 0, 1));
  entries.push(seed(1002, 1, "1", "女", 1));
  entries.push(seed(1003, 1, "2", "未知", 2));
  // sys_yes_no (type_id=2)
  entries.push(seed(1011, 2, "Y", "是", 0, 1));
  entries.push(seed(1012, 2, "N", "否", 1));
  // sys_menu_type (type_id=3)
  entries.push(seed(1021, 3, "DIR", "目录", 0));
  entries.push(seed(1022, 3, "MENU", "菜单", 1));
  entries.push(seed(1023, 3, "BUTTON", "按钮", 2));
  // sys_notice_type (type_id=4)
  entries.push(seed(1031, 4, "1", "通知", 0));
  entries.push(seed(1032, 4, "2", "公告", 1));
  entries.push(seed(1033, 4, "3", "提醒", 2));
  // sys_common_status (type_id=5)
  entries.push(seed(1041, 5, "0", "正常", 0, 1));
  entries.push(seed(1042, 5, "1", "停用", 1));
  return entries;
}

/**
 * 首次访问 list 时把种子写入共享 list；之后 create/update/delete 改它，list 不会重置。
 */
export function ensureDictSeeds(): void {
  if (mockDictTypeList.length === 0) {
    mockDictTypeList.push(...buildDictTypeSeeds());
  }
  if (mockDictDataList.length === 0) {
    mockDictDataList.push(...buildDictDataSeeds());
  }
}

export { nextDictId, isoNow };
