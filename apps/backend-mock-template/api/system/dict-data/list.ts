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
  if (Array.isArray(typeCode)) {
    // 多选：空数组=无命中；非空数组=精确匹配任一
    if (typeCode.length === 0) {
      filtered = [];
    } else {
      const codes = new Set((typeCode as unknown[]).map((v) => String(v)));
      const typeIds = new Set(
        getMockDictTypeList()
          .filter((x) => x.deleted_at === 0 && codes.has(x.code))
          .map((x) => x.id),
      );
      filtered = filtered.filter((x) => typeIds.has(x.type_id));
    }
  } else if (typeCode) {
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
  // 语义：query 里只要存在 platform 这个 key 就走过滤分支；
  // - 不存在（key undefined）= 不过滤，返回全部
  // - 存在且值为 ''             = 只取通用（platform=''）
  // - 存在且值为非空字符串       = 取该平台 + 通用（platform=''）
  // 这样前端可以显式选择「通用」做筛选，不会因为 '' 被替换为 undefined 而被退回「不过滤」。
  if (Object.prototype.hasOwnProperty.call(rawQuery, "platform")) {
    const p = typeof platform === "string" ? platform : "";
    const allowedTypeIds = new Set(
      getMockDictTypeList()
        .filter(
          (t) =>
            t.deleted_at === 0 &&
            (p === "" ? t.platform === "" : t.platform === p || t.platform === ""),
        )
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
