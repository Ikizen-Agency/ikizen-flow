"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { Field, Input } from "@/shared/ui/input";
import { registerAction } from "../actions";
import { INITIAL_AUTH_STATE, MIN_PASSWORD_LENGTH } from "../form-schema";
import { FormAlert } from "./form-alert";

const FIELDS = [
  { name: "name", label: "Full name", type: "text", icon: "person", autoComplete: "name" },
  { name: "email", label: "Work email", type: "email", icon: "mail", autoComplete: "email" },
  { name: "password", label: "Password", type: "password", icon: "lock", autoComplete: "new-password", hint: `At least ${MIN_PASSWORD_LENGTH} characters.` },
  { name: "workspaceName", label: "Workspace name", type: "text", icon: "business", autoComplete: "organization", hint: "Your company or team. You will be its owner." },
] as const;

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, INITIAL_AUTH_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-space-md" noValidate>
      {state.message ? <FormAlert message={state.message} /> : null}
      {FIELDS.map((f) => {
        const error = errors[f.name]?.[0];
        return (
          <Field key={f.name} label={f.label} htmlFor={f.name} error={error} hint={"hint" in f ? f.hint : undefined}>
            <Input
              id={f.name}
              name={f.name}
              type={f.type}
              icon={f.icon}
              autoComplete={f.autoComplete}
              required
              defaultValue={f.name === "password" ? undefined : state.values?.[f.name]}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${f.name}-error` : undefined}
            />
          </Field>
        );
      })}
      <Button type="submit" size="lg" icon="rocket_launch" disabled={pending} className="mt-space-xs w-full">
        {pending ? "Creating workspace..." : "Create account"}
      </Button>
    </form>
  );
}
