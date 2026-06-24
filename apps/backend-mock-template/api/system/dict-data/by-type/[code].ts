import { defineEventHandler, getRouterParam, setResponseStatus } from "h3";
import { ensureDictSeeds, getMockDictDataList, getMockDictTypeList } from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const code = getRouterParam(event, "code");
  if (!code) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "code is required");
  }

  const type = getMockDictTypeList().find((t) => t.deleted_at === 0 && t.code === code);
  if (!type) {
    setResponseStatus(event, 404);
    return useResponseError("NotFound", `dict-type code=${code} not found`);
  }

  const items = getMockDictDataList()
    .filter((d) => d.type_id === type.id && d.is_enabled === 1)
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  return useResponseSuccess(items);
});
