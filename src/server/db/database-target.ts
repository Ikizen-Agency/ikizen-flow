/**
 * Pure decisions about where the CLI scripts point: a printable target that never carries credentials,
 * and the guard that keeps `pnpm db:seed` (which deletes every row) away from a remote database by accident.
 */
type Env = Readonly<Record<string, string | undefined>>;

export const CONFIRM_REMOTE_SEED_VAR = "IKIZEN_CONFIRM_REMOTE_SEED";

const UNRECOGNIZED_TARGET = "remote database (unrecognized URL)";

export function isRemoteDatabaseUrl(url: string): boolean {
  return !url.startsWith("file:");
}

function remoteHost(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/** What scripts may print: the host of a remote database, or the path of a local file. */
export function databaseTarget(url: string): string {
  if (!isRemoteDatabaseUrl(url)) return url.split("?")[0]!;
  return remoteHost(url) ?? UNRECOGNIZED_TARGET;
}

export type SeedDecision = { allowed: true } | { allowed: false; reason: string };

/** A remote database is only seeded when the confirmation variable names exactly the host being wiped. */
export function decideSeed(url: string, env: Env): SeedDecision {
  if (!isRemoteDatabaseUrl(url)) return { allowed: true };
  const host = remoteHost(url);
  if (!host) return { allowed: false, reason: "db:seed refused: DATABASE_URL has no recognizable host, so the remote target cannot be confirmed." };
  if (env[CONFIRM_REMOTE_SEED_VAR] === host) return { allowed: true };
  return {
    allowed: false,
    reason: `db:seed refused: it deletes every row in ${host}. To seed this remote database on purpose, run it again with ${CONFIRM_REMOTE_SEED_VAR}=${host}.`,
  };
}
