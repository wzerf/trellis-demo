import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from "h3";
import {
  ensureDictSeeds,
  getMockDictDataList,
  isAllowedDictDataPlatform,
  isoNow,
} from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

const ALLOWED_KEYS = [
  "value",
  "label",
  "sort",
  "is_default",
  "platform",
  "is_enabled",
  "remark",
] as const;

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const idStr = getRouterParam(event, "id");
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "id must be a number");
  }

  const raw = (await readBody(event)) as Record<string, unknown>;
  const list = getMockDictDataList();
  const idx = list.findIndex((x) => x.id === id && x.deleted_at === 0);
  if (idx < 0) {
    setResponseStatus(event, 404);
    return useResponseError("NotFound", `dict-data ${id} not found`);
  }

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in raw) patch[key] = raw[key];
  }

  if ("value" in patch) {
    const rawValue = patch.value;
    const v =
      typeof rawValue === "string"
        ? rawValue.trim()
        : typeof rawValue === "number"
          ? String(rawValue).trim()
          : "";
    if (!v) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "value cannot be empty");
    }
    if (v.length > 64) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "value must be ≤ 64 chars");
    }
    const conflict = list.find(
      (x) => x.id !== id && x.deleted_at === 0 && x.type_id === list[idx].type_id && x.value === v,
    );
    if (conflict) {
      setResponseStatus(event, 400);
      return useResponseError(
        "BadRequest",
        `value ${v} already exists in type ${list[idx].type_id}`,
      );
    }
    patch.value = v;
  }
  if ("label" in patch) {
    const rawLabel = patch.label;
    const l =
      typeof rawLabel === "string"
        ? rawLabel.trim()
        : typeof rawLabel === "number"
          ? String(rawLabel).trim()
          : "";
    if (!l) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "label cannot be empty");
    }
    if (l.length > 128) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "label must be ≤ 128 chars");
    }
    patch.label = l;
  }
  if ("sort" in patch) {
    const s = Number(patch.sort);
    if (!Number.isFinite(s)) {
      setResponseStatus(event, 400);
      return useResponseError("BadRequest", "sort must be a number");
    }
    patch.sort = s;
  }
  if ("is_default" in patch) {
    patch.is_default = patch.is_default ? 1 : 0;
  }
  if ("platform" in patch) {
    if (!isAllowedDictDataPlatform(patch.platform)) {
      setResponseStatus(event, 400);
      return useResponseError(
        "BadRequest",
        "platform must be one of general|react-admin|vue-admin",
      );
    }
  }
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
