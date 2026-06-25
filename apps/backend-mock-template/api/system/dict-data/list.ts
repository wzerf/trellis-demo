import { defineEventHandler, getQuery } from "h3";
import {
  ensureDictSeeds,
  getMockDictDataList,
  getMockDictTypeList,
  type DictData,
} from "~/utils/mock-data";
import { usePageResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const rawQuery = getQuery(event);
  // 兼容 ?typeCode=foo&typeCode=bar 与 ?typeCode[]=foo&typeCode[]=bar
  const typeCode = (rawQuery.typeCode ?? rawQuery["typeCode[]"]) as string | string[] | undefined;
  const { page = 1, pageSize = 20, typeId, label, value, status } = rawQuery;
  let filtered: DictData[] = getMockDictDataList().filter((x) => x.deleted_at === 0);

  if (typeId !== undefined && typeId !== "") {
    const t = Number(typeId);
    if (Number.isFinite(t)) {
      filtered = filtered.filter((x) => x.type_id === t);
    }
  }
  if (typeCode) {
    const q = String(typeCode as string);
    const typeIds = new Set(
      getMockDictTypeList()
        .filter((x) => x.deleted_at === 0 && x.code.includes(q))
        .map((x) => x.id),
    );
    filtered = filtered.filter((x) => typeIds.has(x.type_id));
  }
  if (label) {
    const q = String(label as string);
    filtered = filtered.filter((x) => x.label.includes(q));
  }
  if (value) {
    const q = String(value as string);
    filtered = filtered.filter((x) => x.value.includes(q));
  }
  if (["0", "1"].includes(status as string)) {
    filtered = filtered.filter((x) => x.is_enabled === Number(status));
  }
  filtered.sort((a, b) => a.sort - b.sort || a.id - b.id);

  // join typeCode（仅 list 返回）
  const typeMap = new Map(getMockDictTypeList().map((t) => [t.id, t.code]));
  const items = filtered.map((x) => ({ ...x, typeCode: typeMap.get(x.type_id) ?? "" }));

  return usePageResponseSuccess(page as string, pageSize as string, items);
});
