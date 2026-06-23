import { defineEventHandler, getRouterParam, setResponseStatus } from "h3";
import { getMockUserList } from "~/utils/mock-data";
import { useResponseError, useResponseSuccess } from "~/utils/response";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    setResponseStatus(event, 400);
    return useResponseError("BadRequest", "id is required");
  }
  const list = getMockUserList();
  const idx = list.findIndex((u) => u.id === id);
  if (idx < 0) {
    setResponseStatus(event, 404);
    return useResponseError("NotFound", `user ${id} not found`);
  }
  const [removed] = list.splice(idx, 1);
  return useResponseSuccess(removed);
});
