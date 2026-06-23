import { faker } from "@faker-js/faker";
import { eventHandler, getQuery } from "h3";
import { verifyAccessToken } from "~/utils/jwt-utils";
import { getMockUserList, MOCK_USERS } from "~/utils/mock-data";
import { unAuthorizedResponse, usePageResponseSuccess } from "~/utils/response";

const formatterCN = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface UserListItem {
  id: string;
  username: string;
  realName: string;
  email: string;
  phone: string;
  status: 0 | 1;
  roles: string[];
  remark: string;
  createTime: string;
}

function generateUserListData(count: number): UserListItem[] {
  const list: UserListItem[] = [];
  // 先用 mock 三个账号作为基础
  for (const u of MOCK_USERS) {
    list.push({
      id: String(u.id),
      username: u.username,
      realName: u.realName,
      email: faker.internet.email({ firstName: u.username }).toLowerCase(),
      phone: faker.phone.number(),
      status: 1,
      roles: u.roles,
      remark: "Built-in mock account",
      createTime: formatterCN.format(new Date("2024-01-01T00:00:00Z")),
    });
  }
  // 再生成若干随机账号凑足 count
  for (let i = list.length; i < count; i++) {
    const fullName = faker.person.fullName();
    // faker v10 移除了 internet.userName()，改用 person.lastName + 数字
    const username = `user_${faker.string.alphanumeric({ length: 6, casing: "lower" })}`;
    list.push({
      id: faker.string.uuid(),
      username,
      realName: fullName,
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number(),
      status: faker.helpers.arrayElement([0, 1]) as 0 | 1,
      roles: faker.helpers.arrayElements(["user", "admin"], { min: 1, max: 2 }),
      remark: faker.lorem.sentence(),
      createTime: formatterCN.format(faker.date.between({ from: "2022-01-01", to: "2025-01-01" })),
    });
  }
  return list;
}

const mockData: UserListItem[] = generateUserListData(20);

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 首次请求时把种子数据写入共享 list；之后 create/update/delete 改它，list 不会重置
  const shared = getMockUserList();
  if (shared.length === 0) {
    shared.push(...mockData);
  }

  const { page = 1, pageSize = 20, username, realName, status } = getQuery(event);
  let listData = shared.slice();
  if (username) {
    listData = listData.filter((item) =>
      item.username.toLowerCase().includes(String(username).toLowerCase()),
    );
  }
  if (realName) {
    listData = listData.filter((item) =>
      item.realName.toLowerCase().includes(String(realName).toLowerCase()),
    );
  }
  if (["0", "1"].includes(status as string)) {
    listData = listData.filter((item) => item.status === Number(status));
  }
  return usePageResponseSuccess(page as string, pageSize as string, listData);
});
