import { getServerEnv, isEnabledEnv } from "./env.server";

export type IngestAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: "missing_token" | "invalid_token" | "server_misconfigured" };

/**
 * Public webhook ingestion is only safe when every external caller proves
 * possession of the configured token. For local prototypes only, set
 * ALLOW_PUBLIC_INGEST_WITHOUT_TOKEN=true.
 */
export function authorizeIngestRequest(request: Request): IngestAuthResult {
  const configuredToken = getServerEnv("INGEST_TOKEN");
  const allowOpenDevIngest = isEnabledEnv("ALLOW_PUBLIC_INGEST_WITHOUT_TOKEN");

  if (!configuredToken) {
    return allowOpenDevIngest
      ? { ok: true }
      : { ok: false, status: 503, code: "server_misconfigured" };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredToken}`;

  if (!authorization) {
    return { ok: false, status: 401, code: "missing_token" };
  }

  if (authorization !== expected) {
    return { ok: false, status: 401, code: "invalid_token" };
  }

  return { ok: true };
}
