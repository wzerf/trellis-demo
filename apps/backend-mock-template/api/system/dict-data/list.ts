import { defineEventHandler, getQuery } from "h3";
import { ensureDictSeeds, getMockDictDataList, type DictData } from "~/utils/mock-data";
import { usePageResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const { page = 1, pageSize = 20, typeId, label, value, status } = getQuery(event);
  let filtered: DictData[] = getMockDictDataList().filter((x) => x.deleted_at === 0);

  if (typeId !== undefined && typeId !== "") {
    const t = Number(typeId);
    if (Number.isFinite(t)) {
      filtered = filtered.filter((x) => x.type_id === t);
    }
  }
  if (label) {
    const q = String(label);
    filtered = filtered.filter((x) => x.label.includes(q));
  }
  if (value) {
    const q = String(value);
    filtered = filtered.filter((x) => x.value.includes(q));
  }
  if (["0", "1"].includes(status as string)) {
    filtered = filtered.filter((x) => x.is_enabled === Number(status));
  }
  filtered.sort((a, b) => a.sort - b.sort || a.id - b.id);

  return usePageResponseSuccess(page as string, pageSize as string, filtered);
});
