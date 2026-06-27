import { defineEventHandler, getQuery } from "h3";
import { ensureDictSeeds, getMockDictTypeList, type DictType } from "~/utils/mock-data";
import { useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const query = getQuery(event);
  // 兼容 ?code=foo&code=bar 与 ?code[]=foo&code[]=bar
  const code = (query.code ?? query["code[]"]) as string | string[] | undefined;
  const { status, platform, name } = getQuery(event);
  let items: DictType[] = getMockDictTypeList().filter((x) => x.deleted_at === 0);

  if (Array.isArray(code)) {
    const codes = new Set((code as unknown[]).map((v) => String(v)));
    if (codes.size > 0) {
      items = items.filter((x) => codes.has(x.code));
    }
  } else if (code) {
    const q = String(code as string).toLowerCase();
    items = items.filter((x) => x.code.toLowerCase().includes(q));
  }
  if (name) {
    const q = String(name as string);
    items = items.filter((x) => x.name.includes(q));
  }
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
