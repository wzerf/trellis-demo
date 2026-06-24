import { defineEventHandler, readBody, setResponseStatus } from "h3";
import {
  ensureDictSeeds,
  getMockDictDataList,
  getMockDictTypeList,
  isoNow,
  nextDictId,
  type DictData,
} from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  ensureDictSeeds();

  const body = (await readBody(event)) as {
    typeId?: number | string;
    value?: string;
    label?: string;
    sort?: number;
    isDefault?: boolean;
    is_enabled?: 0 | 1;
    remark?: string;
  };

  const typeId = Number(body?.typeId);
  const value = (body?.value ?? "").trim();
  const label = (body?.label ?? "").trim();

  if (!Number.isFinite(typeId) || typeId <= 0) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "typeId is required");
  }
  const parent = getMockDictTypeList().find((t) => t.id === typeId && t.deleted_at === 0);
  if (!parent) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", `dict-type ${typeId} not found or deleted`);
  }
  if (!value) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "value is required");
  }
  if (value.length > 64) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "value must be ≤ 64 chars");
  }
  if (!label) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "label is required");
  }
  if (label.length > 128) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "label must be ≤ 128 chars");
  }

  const list = getMockDictDataList();
  const conflict = list.find(
    (x) => x.deleted_at === 0 && x.type_id === typeId && x.value === value,
  );
  if (conflict) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", `value ${value} already exists in type ${typeId}`);
  }

  const now = isoNow();
  const newRow: DictData = {
    id: nextDictId(),
    type_id: typeId,
    value,
    label,
    sort: Number(body?.sort ?? 0),
    is_default: (body?.isDefault ? 1 : 0) as 0 | 1,
    is_enabled: (body?.is_enabled ?? 1) as 0 | 1,
    deleted_at: 0,
    remark: body?.remark ?? "",
    created_at: now,
    updated_at: now,
    created_by: 0,
    updated_by: 0,
  };
  list.unshift(newRow);
  return useResponseSuccess(newRow);
});
