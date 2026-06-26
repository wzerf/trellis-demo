import { defineEventHandler, getQuery, getRouterParam, setResponseStatus } from "h3";
import { ensureDictSeeds, getMockDictDataList, getMockDictTypeList } from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const code = getRouterParam(event, "code");
  if (!code) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "code is required");
  }

  const { platform } = getQuery(event);

  // 找到所有未删除、且 code 匹配的字典类型
  let types = getMockDictTypeList().filter((t) => t.deleted_at === 0 && t.code === code);
  if (types.length === 0) {
    setResponseStatus(event, 404);
    return useResponseError("NotFound", `dict-type code=${code} not found`);
  }

  // platform 过滤：传入非空值时，仅返回该平台 + 通用（platform=''）的字典类型
  if (typeof platform === "string" && platform.length > 0) {
    const p = platform;
    types = types.filter((t) => t.platform === p || t.platform === "");
  }
  const typeIds = new Set(types.map((t) => t.id));

  const items = getMockDictDataList()
    .filter((d) => typeIds.has(d.type_id) && d.is_enabled === 1)
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  return useResponseSuccess(items);
});
