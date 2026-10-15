"use server";

import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/request-context";
import { safeNextPath } from "../domain/redirect";
import { registerSchema, signInSchema, type AuthFormState } from "./form-schema";

/** Echoes non-secret fields back to the form after a failed submit. */
function echo(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

function errorCode(error: unknown): string {
  return isAPIError(error) ? String((error.body as { code?: string } | undefined)?.code ?? "") : "";
}

/** Email + password sign-in. Better Auth sets the session cookie through the `nextCookies` plugin. */
export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = echo(formData, ["email"]);
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) return { status: "error", message: "Invalid email or password.", values };
    console.error("signInAction failed", error);
    return { status: "error", message: "We could not sign you in. Please try again.", values };
  }
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect(safeNextPath(formData.get("next")?.toString()));
}

/** Creates the account and signs in; the sign-up hook provisions the new workspace with the user as owner. */
export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = echo(formData, ["name", "email", "workspaceName"]);
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    const code = errorCode(error);
    if (code.startsWith("USER_ALREADY_EXISTS")) {
      return { status: "error", fieldErrors: { email: ["An account with this email already exists. Sign in instead."] }, values };
    }
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { status: "error", fieldErrors: { password: [isAPIError(error) ? error.message : "Invalid password."] }, values };
    }
    console.error("registerAction failed", error);
    return { status: "error", message: "We could not create your account. Please try again.", values };
  }
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // An already-expired session still ends on the login page.
    if (!isAPIError(error)) console.error("signOutAction failed", error);
  }
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/login");
}
