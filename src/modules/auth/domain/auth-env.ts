/** Development-only secret. Never accepted at runtime in production. */
export const DEV_AUTH_SECRET = "ikizen-flow-development-secret-do-not-use-in-production";
const DEFAULT_BASE_URL = "http://localhost:3000";
const MIN_SECRET_LENGTH = 32;

export interface AuthEnv {
  secret: string;
  baseURL: string;
  /** Origins allowed to call the auth endpoints: the base URL plus, on Vercel, the deployment URLs. */
  trustedOrigins: string[];
}

type Env = Record<string, string | undefined>;

/** `https://<host>` for a Vercel system variable (they hold a bare host name), or null when unset. */
function vercelOrigin(host: string | undefined): string | null {
  const value = host?.trim();
  return value ? `https://${value}` : null;
}

/**
 * Public origin of the app: `BETTER_AUTH_URL`, otherwise (on Vercel) the production domain for production
 * deployments and the deployment URL for previews, otherwise `http://localhost:3000`.
 */
function resolveBaseURL(env: Env): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return configured;
  if (env.VERCEL === "1") {
    const production = vercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
    const deployment = vercelOrigin(env.VERCEL_URL);
    const vercelURL = env.VERCEL_ENV === "production" ? production ?? deployment : deployment ?? production;
    if (vercelURL) return vercelURL;
  }
  return DEFAULT_BASE_URL;
}

function resolveTrustedOrigins(env: Env, baseURL: string): string[] {
  const origins = [new URL(baseURL).origin];
  if (env.VERCEL === "1") {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
      const origin = vercelOrigin(host);
      if (origin && !origins.includes(origin)) origins.push(origin);
    }
  }
  return origins;
}

/**
 * Resolves Better Auth settings from the environment. Development falls back to safe local defaults;
 * a production server without a strong `BETTER_AUTH_SECRET` refuses to start. `next build` is allowed
 * to compile with the development secret because no request is ever served with it.
 */
export function resolveAuthEnv(env: Env): AuthEnv {
  const baseURL = resolveBaseURL(env);
  const trustedOrigins = resolveTrustedOrigins(env, baseURL);
  const secret = env.BETTER_AUTH_SECRET?.trim();
  const isProductionRuntime = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";

  if (!isProductionRuntime) return { secret: secret || DEV_AUTH_SECRET, baseURL, trustedOrigins };
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required in production. Generate one with `openssl rand -base64 32`.");
  if (secret.length < MIN_SECRET_LENGTH || secret === DEV_AUTH_SECRET) {
    throw new Error(`BETTER_AUTH_SECRET must be a unique value of at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
  return { secret, baseURL, trustedOrigins };
}
