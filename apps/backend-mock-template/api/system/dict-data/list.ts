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
  const { page = 1, pageSize = 20, typeId, label, value, status, platform } = rawQuery;
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
  // platform 过滤：根据所属字典类型的 platform 决定。
  // 传入非空值时，返回该平台类型 + 通用类型（platform=''）下的字典项。
  if (typeof platform === "string" && platform.length > 0) {
    const p = platform;
    const allowedTypeIds = new Set(
      getMockDictTypeList()
        .filter((t) => t.deleted_at === 0 && (t.platform === p || t.platform === ""))
        .map((t) => t.id),
    );
    filtered = filtered.filter((x) => allowedTypeIds.has(x.type_id));
  }
  filtered.sort((a, b) => a.sort - b.sort || a.id - b.id);

  // join typeCode（仅 list 返回）
  const typeMap = new Map(getMockDictTypeList().map((t) => [t.id, t.code]));
  const items = filtered.map((x) => ({ ...x, typeCode: typeMap.get(x.type_id) ?? "" }));

  return usePageResponseSuccess(page as string, pageSize as string, items);
});
