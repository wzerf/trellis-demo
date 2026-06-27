import { defineEventHandler, getQuery } from "h3";
import { ensureDictSeeds, getMockDictTypeList, type DictType } from "~/utils/mock-data";
import { usePageResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const query = getQuery(event);
  // axios 1.x 默认把数组序列化为 ?code[]=foo&code[]=bar，h3 的 getQuery 会保留 [] 后缀
  // 兼容两种格式：?code=foo&code=bar 与 ?code[]=foo&code[]=bar
  const code = (query.code ?? query["code[]"]) as string | string[] | undefined;
  const { page = 1, pageSize = 20, name, status, platform } = query;
  const shared = getMockDictTypeList();

  let filtered: DictType[] = shared.filter((x) => x.deleted_at === 0);
  if (Array.isArray(code)) {
    // 多选：精确匹配 code 命中任一
    const codes = new Set((code as unknown[]).map((v) => String(v)));
    if (codes.size > 0) {
      filtered = filtered.filter((x) => codes.has(x.code));
    }
  } else if (code) {
    const q = String(code as string).toLowerCase();
    filtered = filtered.filter((x) => x.code.toLowerCase().includes(q));
  }
  if (name) {
    const q = String(name as string);
    filtered = filtered.filter((x) => x.name.includes(q));
  }
  if (["0", "1"].includes(status as string)) {
    filtered = filtered.filter((x) => x.is_enabled === Number(status));
  }
  // platform 精确筛选。语义：query 里只要存在 platform 这个 key 就走过滤分支；
  // - 不存在（key undefined）= 不过滤，返回全部
  // - 存在且值为 ''             = 只取通用（platform=''）
  // - 存在且值为非空字符串       = 取该平台 + 通用（platform=''）
  // 这样前端可以显式选择「通用」做筛选，不会因为 '' 被替换为 undefined 而被退回「不过滤」。
  if (Object.prototype.hasOwnProperty.call(query, "platform")) {
    const p = typeof platform === "string" ? platform : "";
    filtered = filtered.filter((x) =>
      p === "" ? x.platform === "" : x.platform === p || x.platform === "",
    );
  }
  // 按 id 升序，便于观察
  filtered.sort((a, b) => a.id - b.id);

  return usePageResponseSuccess(page as string, pageSize as string, filtered);
});
