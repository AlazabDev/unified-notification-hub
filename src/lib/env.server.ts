type EnvRecord = Record<string, string | undefined>;

type MaybeProcess = {
  env?: EnvRecord;
};

/**
 * Runtime-agnostic environment reader.
 *
 * TanStack Start can run in Node-like local dev and Cloudflare Worker-like edge
 * runtimes. This helper avoids hard-coding a single runtime API in domain code.
 */
export function getServerEnv(name: string): string | undefined {
  const maybeProcess = (globalThis as unknown as { process?: MaybeProcess }).process;
  return maybeProcess?.env?.[name];
}

export function requireServerEnv(name: string): string {
  const value = getServerEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isEnabledEnv(name: string): boolean {
  const value = getServerEnv(name)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
