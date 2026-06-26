import { defineEventHandler, getQuery } from "h3";
import { ensureDictSeeds, getMockDictTypeList } from "~/utils/mock-data";
import { useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const { status, platform } = getQuery(event);
  let items = getMockDictTypeList().filter((x) => x.deleted_at === 0);
  if (["0", "1"].includes(status as string)) {
    items = items.filter((x) => x.is_enabled === Number(status));
  }
  // platform 过滤：传入非空值时返回该平台 + 通用（platform=''）的并集
  if (typeof platform === "string" && platform.length > 0) {
    const p = platform;
    items = items.filter((x) => x.platform === p || x.platform === "");
  }
  items.sort((a, b) => a.id - b.id);
  return useResponseSuccess(items);
});
