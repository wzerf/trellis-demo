import { defineEventHandler, getQuery } from "h3";
import { ensureDictSeeds, getMockDictTypeList, type DictType } from "~/utils/mock-data";
import { usePageResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const { page = 1, pageSize = 20, code, name, status } = getQuery(event);
  const shared = getMockDictTypeList();

  let filtered: DictType[] = shared.filter((x) => x.deleted_at === 0);
  if (code) {
    const q = String(code).toLowerCase();
    filtered = filtered.filter((x) => x.code.toLowerCase().includes(q));
  }
  if (name) {
    const q = String(name);
    filtered = filtered.filter((x) => x.name.includes(q));
  }
  if (["0", "1"].includes(status as string)) {
    filtered = filtered.filter((x) => x.is_enabled === Number(status));
  }
  // 按 id 升序，便于观察
  filtered.sort((a, b) => a.id - b.id);

  return usePageResponseSuccess(page as string, pageSize as string, filtered);
});
