import { defineEventHandler, getQuery } from "h3";
import { ensureDictSeeds, getMockDictTypeList } from "~/utils/mock-data";
import { useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const { status } = getQuery(event);
  let items = getMockDictTypeList().filter((x) => x.deleted_at === 0);
  if (["0", "1"].includes(status as string)) {
    items = items.filter((x) => x.is_enabled === Number(status));
  }
  items.sort((a, b) => a.id - b.id);
  return useResponseSuccess(items);
});
