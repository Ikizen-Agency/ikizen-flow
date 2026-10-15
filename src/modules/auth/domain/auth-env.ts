/** Development-only secret. Never accepted at runtime in production. */
export const DEV_AUTH_SECRET = "ikizen-flow-development-secret-do-not-use-in-production";
const DEFAULT_BASE_URL = "http://localhost:3000";
const MIN_SECRET_LENGTH = 32;

export interface AuthEnv {
  secret: string;
  baseURL: string;
}

/**
 * Resolves Better Auth settings from the environment. Development falls back to safe local defaults;
 * a production server without a strong `BETTER_AUTH_SECRET` refuses to start. `next build` is allowed
 * to compile with the development secret because no request is ever served with it.
 */
export function resolveAuthEnv(env: Record<string, string | undefined>): AuthEnv {
  const baseURL = env.BETTER_AUTH_URL?.trim() || DEFAULT_BASE_URL;
  const secret = env.BETTER_AUTH_SECRET?.trim();
  const isProductionRuntime = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";

  if (!isProductionRuntime) return { secret: secret || DEV_AUTH_SECRET, baseURL };
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required in production. Generate one with `openssl rand -base64 32`.");
  if (secret.length < MIN_SECRET_LENGTH || secret === DEV_AUTH_SECRET) {
    throw new Error(`BETTER_AUTH_SECRET must be a unique value of at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
  return { secret, baseURL };
}
