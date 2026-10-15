"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Field, Input, Select } from "@/shared/ui/input";
import { Overlay } from "@/shared/ui/overlay";
import { createCustomerAction } from "../actions";
import { INITIAL_CREATE_CUSTOMER_STATE } from "../form-schema";

export interface CreateCustomerDialogProps {
  closeHref: string;
  tierOptions: ReadonlyArray<{ value: string; label: string }>;
  statusOptions: ReadonlyArray<{ value: string; label: string }>;
}

/** "Add New Customer" modal backed by a Server Action with field-level validation errors. */
export function CreateCustomerDialog({ closeHref, tierOptions, statusOptions }: CreateCustomerDialogProps) {
  const [state, formAction, pending] = useActionState(createCustomerAction, INITIAL_CREATE_CUSTOMER_STATE);
  const v = state.values ?? {};
  const err = (field: keyof NonNullable<typeof state.fieldErrors>) => state.fieldErrors?.[field]?.[0];
  const invalid = (field: keyof NonNullable<typeof state.fieldErrors>) => (err(field) ? true : undefined);
  const describedBy = (field: string) => (state.fieldErrors?.[field as never] ? `${field}-error` : undefined);

  return (
    <Overlay closeHref={closeHref} labelledBy="create-customer-title">
      <div className="flex items-center justify-between bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-2">
          <Icon name="domain_add" size={24} className="text-accent" />
          <h2 id="create-customer-title" className="text-headline-md text-ink">
            Add New Customer
          </h2>
        </div>
        <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:text-ink">
          <Icon name="close" size={20} />
        </Link>
      </div>
      <form action={formAction} noValidate className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
        {state.message ? (
          <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm text-danger-strong">
            {state.message}
          </p>
        ) : null}
        <Field label="Company Name" htmlFor="company" error={err("company")}>
          <Input id="company" name="company" placeholder="e.g. Acme Corporation" required defaultValue={v.company} aria-invalid={invalid("company")} aria-describedby={describedBy("company")} autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field label="Service Tier" htmlFor="tier" error={err("tier")}>
            <Select id="tier" name="tier" defaultValue={v.tier ?? tierOptions[0]?.value}>
              {tierOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="status" error={err("status")}>
            <Select id="status" name="status" defaultValue={v.status ?? statusOptions[0]?.value}>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field label="Key Contact" htmlFor="contactName" error={err("contactName")}>
            <Input id="contactName" name="contactName" placeholder="Full name" required defaultValue={v.contactName} aria-invalid={invalid("contactName")} aria-describedby={describedBy("contactName")} />
          </Field>
          <Field label="Email Address" htmlFor="contactEmail" error={err("contactEmail")}>
            <Input id="contactEmail" name="contactEmail" type="email" placeholder="contact@domain.com" required defaultValue={v.contactEmail} aria-invalid={invalid("contactEmail")} aria-describedby={describedBy("contactEmail")} />
          </Field>
        </div>
        <Field label="Industry" htmlFor="industry" error={err("industry")}>
          <Input id="industry" name="industry" placeholder="e.g. Healthcare" required defaultValue={v.industry} aria-invalid={invalid("industry")} aria-describedby={describedBy("industry")} />
        </Field>
        <Field
          label="Initial Engagement Amount ($)"
          htmlFor="initialAmount"
          error={err("initialAmount")}
          hint="Optional. Saved as a draft work order for this client."
        >
          <Input id="initialAmount" name="initialAmount" inputMode="decimal" placeholder="25000" defaultValue={v.initialAmount} aria-invalid={invalid("initialAmount")} aria-describedby={describedBy("initialAmount")} />
        </Field>
        <div className="flex items-center justify-end gap-space-sm pt-space-sm">
          <Link href={closeHref} scroll={false} className={buttonClasses({ variant: "ghost" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Customer"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
