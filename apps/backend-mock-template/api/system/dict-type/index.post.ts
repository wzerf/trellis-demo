import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { ensureDictSeeds, getMockDictTypeList, isoNow, nextDictId } from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PLATFORM_PATTERN = /^$|^[A-Za-z0-9_-]{1,32}$/;

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const body = (await readBody(event)) as {
    code?: string;
    platform?: string;
    name?: string;
    remark?: string;
    is_enabled?: 0 | 1;
  };

  const code = (body?.code ?? "").trim();
  const platform = body?.platform ?? "";
  const name = (body?.name ?? "").trim();

  if (!code) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "code is required");
  }
  if (!CODE_PATTERN.test(code)) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "code must match ^[a-z][a-z0-9_]{0,63}$");
  }
  if (typeof body?.platform !== "undefined" && !PLATFORM_PATTERN.test(platform)) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "platform must match ^[A-Za-z0-9_-]{1,32}$ or empty");
  }
  if (!name) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "name is required");
  }
  if (name.length > 64) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "name must be ≤ 64 chars");
  }

  const list = getMockDictTypeList();
  const conflict = list.find(
    (x) => x.deleted_at === 0 && x.code === code && x.platform === platform,
  );
  if (conflict) {
    setResponseStatus(event, 400);
    return useResponseError(
      "BadRequest",
      `code ${code} already exists in platform ${platform || "(通用)"}`,
    );
  }

  const now = isoNow();
  const newRow = {
    id: nextDictId(),
    code,
    platform,
    name,
    remark: body?.remark ?? "",
    is_enabled: (body?.is_enabled ?? 1) as 0 | 1,
    deleted_at: 0,
    created_at: now,
    updated_at: now,
    created_by: 0,
    updated_by: 0,
  };
  list.unshift(newRow);
  return useResponseSuccess(newRow);
});
