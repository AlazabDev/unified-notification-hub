import { getServerEnv, isEnabledEnv } from "./env.server";
import { hmacSha256Hex, safeEqual, sha256Hex } from "./edge-crypto.server";

export type AuthorizedSource = {
  id?: string;
  tenantId: string;
  sourceKey: string;
  domain?: string;
  sourceType?: "meta" | "uberfix" | "accounting" | "system" | "custom";
};

export type IngestAuthResult =
  | { ok: true; source: AuthorizedSource }
  | {
      ok: false;
      status: 401 | 403 | 429 | 503;
      code:
        | "missing_token"
        | "invalid_token"
        | "inactive_source"
        | "missing_signature"
        | "invalid_signature"
        | "stale_signature"
        | "server_misconfigured"
        | "rate_limited";
    };

type SourceRow = {
  id: string;
  tenant_id: string;
  source_key: string;
  domain: string;
  source_type: AuthorizedSource["sourceType"];
  active: boolean;
  hmac_enabled: boolean;
  hmac_secret_env_name: string | null;
  rate_limit_per_minute: number;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function jsonHeaders(token: string) {
  return {
    apikey: token,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function findSourceByTokenHash(tokenHash: string): Promise<SourceRow | undefined> {
  const url = getServerEnv("SUPABASE_URL")?.replace(/\/$/, "");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return undefined;

  const query = new URLSearchParams({
    select:
      "id,tenant_id,source_key,domain,source_type,active,hmac_enabled,hmac_secret_env_name,rate_limit_per_minute",
    bearer_token_hash: `eq.${tokenHash}`,
    limit: "1",
  });

  const response = await fetch(`${url}/rest/v1/notification_sources?${query}`, {
    headers: jsonHeaders(key),
  });

  if (!response.ok) {
    throw new Error(`source_lookup_failed:${response.status}`);
  }

  const rows = (await response.json()) as SourceRow[];
  return rows[0];
}

async function touchSourceLastSeen(sourceId: string) {
  const url = getServerEnv("SUPABASE_URL")?.replace(/\/$/, "");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;

  const query = new URLSearchParams({ id: `eq.${sourceId}` });
  await fetch(`${url}/rest/v1/notification_sources?${query}`, {
    method: "PATCH",
    headers: jsonHeaders(key),
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

async function verifyHmacIfEnabled(
  request: Request,
  rawBody: string,
  row: SourceRow,
): Promise<IngestAuthResult | undefined> {
  if (!row.hmac_enabled) return undefined;

  const timestamp = request.headers.get("x-azab-timestamp") ?? "";
  const signature = request.headers.get("x-azab-signature") ?? "";
  if (!timestamp || !signature) {
    return { ok: false, status: 401, code: "missing_signature" };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > FIVE_MINUTES_MS) {
    return { ok: false, status: 401, code: "stale_signature" };
  }

  const secretEnvName = row.hmac_secret_env_name;
  const secret = secretEnvName ? getServerEnv(secretEnvName) : undefined;
  if (!secret) {
    return { ok: false, status: 503, code: "server_misconfigured" };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  if (!safeEqual(signature, expected)) {
    return { ok: false, status: 401, code: "invalid_signature" };
  }

  return undefined;
}

/**
 * Public webhook ingestion is only safe when every external caller proves
 * possession of a configured source token. If Supabase source registry is not
 * configured yet, a single INGEST_TOKEN fallback is allowed for local/dev only.
 */
export async function authorizeIngestRequest(
  request: Request,
  rawBody: string,
): Promise<IngestAuthResult> {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return { ok: false, status: 401, code: "missing_token" };
  }

  const tokenHash = await sha256Hex(bearerToken);

  try {
    const source = await findSourceByTokenHash(tokenHash);
    if (source) {
      if (!source.active) return { ok: false, status: 403, code: "inactive_source" };

      const hmacError = await verifyHmacIfEnabled(request, rawBody, source);
      if (hmacError) return hmacError;

      void touchSourceLastSeen(source.id);
      return {
        ok: true,
        source: {
          id: source.id,
          tenantId: source.tenant_id,
          sourceKey: source.source_key,
          domain: source.domain,
          sourceType: source.source_type,
        },
      };
    }
  } catch (error) {
    console.error("notification_source_auth_lookup_failed", error);
    if (isEnabledEnv("REQUIRE_SUPABASE")) {
      return { ok: false, status: 503, code: "server_misconfigured" };
    }
  }

  const configuredToken = getServerEnv("INGEST_TOKEN");
  const allowOpenDevIngest = isEnabledEnv("ALLOW_PUBLIC_INGEST_WITHOUT_TOKEN");

  if (!configuredToken) {
    return allowOpenDevIngest
      ? {
          ok: true,
          source: {
            tenantId: "default",
            sourceKey: "dev-open-ingest",
            sourceType: "custom",
          },
        }
      : { ok: false, status: 503, code: "server_misconfigured" };
  }

  if (bearerToken !== configuredToken) {
    return { ok: false, status: 401, code: "invalid_token" };
  }

  return {
    ok: true,
    source: {
      tenantId: "default",
      sourceKey: "env-token",
      sourceType: "custom",
    },
  };
}
