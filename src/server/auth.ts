import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { resolveAuthEnv } from "@/modules/auth/domain/auth-env";
import { makeProvisionWorkspace } from "@/modules/workspaces/application/use-cases";
import { DrizzleWorkspaceDirectory } from "@/modules/workspaces/infrastructure/drizzle-workspace-directory";
import { systemClock } from "@/modules/shared-types";
import { db } from "./db/client";
import { account, session, user, verification } from "./db/schema";

const { secret, baseURL, trustedOrigins } = resolveAuthEnv(process.env);
const provisionWorkspace = makeProvisionWorkspace({ workspaces: new DrizzleWorkspaceDirectory(db), clock: systemClock });

/**
 * Better Auth: email + password with database sessions stored through the Drizzle adapter.
 * Every sign-up (the register page or `POST /api/auth/sign-up/email`) provisions a new workspace owned
 * by the new user; the optional `workspaceName` body field names it.
 */
export const auth = betterAuth({
  appName: "Ikizen Flow",
  secret,
  baseURL,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "sqlite", schema: { user, session, account, verification } }),
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  databaseHooks: {
    user: {
      create: {
        after: async (created, context) => {
          const body = (context?.body ?? {}) as { workspaceName?: unknown };
          await provisionWorkspace({
            userId: created.id,
            name: created.name,
            email: created.email,
            workspaceName: typeof body.workspaceName === "string" ? body.workspaceName.slice(0, 60) : null,
          });
        },
      },
    },
  },
  // Must be last: lets Server Actions set the session cookie through `next/headers`.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
