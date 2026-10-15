import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const MIN_PASSWORD_LENGTH = 8;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name.").max(80, "Name is too long."),
  email,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(128, "Password is too long."),
  workspaceName: z.string().trim().min(2, "Name your workspace.").max(60, "Workspace name is too long."),
});

export type RegisterValues = z.output<typeof registerSchema>;

export interface AuthFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "workspaceName", string[]>>;
  /** Submitted values (never the password), echoed back after a failed submit. */
  values?: Record<string, string>;
}

export const INITIAL_AUTH_STATE: AuthFormState = { status: "idle" };
