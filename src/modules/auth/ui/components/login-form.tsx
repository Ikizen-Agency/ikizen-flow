"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { Field, Input } from "@/shared/ui/input";
import { signInAction } from "../actions";
import { INITIAL_AUTH_STATE } from "../form-schema";
import { FormAlert } from "./form-alert";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_AUTH_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-space-md" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.message ? <FormAlert message={state.message} /> : null}
      <Field label="Work email" htmlFor="email" error={errors.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          icon="mail"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          icon="lock"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
      </Field>
      <Button type="submit" size="lg" icon="login" disabled={pending} className="mt-space-xs w-full">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
