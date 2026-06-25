import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from "h3";
import { ensureDictSeeds, getMockDictTypeList, isoNow } from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

const ALLOWED_KEYS = ["name", "remark", "is_enabled"] as const;

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const idStr = getRouterParam(event, "id");
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "id must be a number");
  }

  const raw = (await readBody(event)) as Record<string, unknown>;
  const list = getMockDictTypeList();
  const idx = list.findIndex((x) => x.id === id && x.deleted_at === 0);
  if (idx < 0) {
    setResponseStatus(event, 404);
    return useResponseError("NotFound", `dict-type ${id} not found`);
  }

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in raw) patch[key] = raw[key];
  }
  // name 校验
  if ("name" in patch) {
    const rawName = patch.name;
    const name =
      typeof rawName === "string"
        ? rawName.trim()
        : typeof rawName === "number"
          ? String(rawName).trim()
          : "";
    if (!name) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "name cannot be empty");
    }
    if (name.length > 64) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "name must be ≤ 64 chars");
    }
    patch.name = name;
  }
  // is_enabled 校验
  if ("is_enabled" in patch) {
    const v = Number(patch.is_enabled);
    if (v !== 0 && v !== 1) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "is_enabled must be 0 or 1");
    }
    patch.is_enabled = v as 0 | 1;
  }

  list[idx] = {
    ...list[idx],
    ...patch,
    updated_at: isoNow(),
    updated_by: 0,
  };
  return useResponseSuccess(list[idx]);
});
