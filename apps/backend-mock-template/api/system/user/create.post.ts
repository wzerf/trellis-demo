import { faker } from "@faker-js/faker";
import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { getMockUserList } from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    username?: string;
    realName?: string;
    email?: string;
    phone?: string;
    status?: 0 | 1;
    roles?: string[];
    remark?: string;
  };

  if (!body?.username) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "username is required");
  }

  const list = getMockUserList();
  if (list.some((u) => u.username === body.username)) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", `username ${body.username} already exists`);
  }

  const newUser = {
    id: faker.string.uuid(),
    username: body.username,
    realName: body.realName ?? body.username,
    email: body.email ?? "",
    phone: body.phone ?? "",
    status: (body.status ?? 1) as 0 | 1,
    roles: body.roles ?? ["user"],
    remark: body.remark ?? "",
    createTime: new Date().toISOString(),
  };
  list.unshift(newUser);
  return useResponseSuccess(newUser);
});
