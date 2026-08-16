export type ResourceState<T> =
  | { status: "ready"; data: T }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string };

export type JsonBody = Record<string, unknown>;

export function resourceStateFromResponse<T>(
  response: { ok: boolean; status: number },
  body: JsonBody,
  pick: (body: JsonBody) => T | undefined,
): ResourceState<T> {
  const picked = pick(body);
  if (response.ok && picked !== undefined) {
    return { status: "ready", data: picked };
  }

  const message =
    typeof body.error === "string" && body.error.trim()
      ? body.error
      : "Not found";

  if (response.status === 404 || (response.ok && picked === undefined)) {
    return { status: "not_found", message };
  }

  return {
    status: "error",
    message: typeof body.error === "string" && body.error.trim()
      ? body.error
      : "Failed to load",
  };
}
