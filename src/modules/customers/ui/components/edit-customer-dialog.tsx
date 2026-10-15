"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Field, Input, Select } from "@/shared/ui/input";
import { Overlay } from "@/shared/ui/overlay";
import { updateCustomerAction } from "../actions";
import { INITIAL_UPDATE_CUSTOMER_STATE, type UpdateCustomerFieldErrors } from "../form-schema";

type Option = { value: string; label: string };

export interface EditCustomerDialogProps {
  closeHref: string;
  customer: {
    id: number;
    company: string;
    tier: string;
    status: string;
    industry: string;
    contactName: string;
    contactEmail: string;
    billingEmail: string;
    paymentTerms: string;
  };
  tierOptions: ReadonlyArray<Option>;
  statusOptions: ReadonlyArray<Option>;
  termsOptions: ReadonlyArray<Option>;
}

function Options({ options }: { options: ReadonlyArray<Option> }) {
  return options.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));
}

/** "Edit Customer" modal, prefilled with the stored values and backed by the update Server Action. */
export function EditCustomerDialog({ closeHref, customer, tierOptions, statusOptions, termsOptions }: EditCustomerDialogProps) {
  const [state, formAction, pending] = useActionState(updateCustomerAction, INITIAL_UPDATE_CUSTOMER_STATE);
  const v: Record<string, string> = { ...customer, id: String(customer.id), ...state.values };
  const err = (field: keyof UpdateCustomerFieldErrors) => state.fieldErrors?.[field]?.[0];
  const a11y = (field: keyof UpdateCustomerFieldErrors) =>
    err(field) ? { "aria-invalid": true as const, "aria-describedby": `edit-${field}-error` } : {};

  return (
    <Overlay closeHref={closeHref} labelledBy="edit-customer-title">
      <div className="flex items-center justify-between bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-2">
          <Icon name="edit" size={24} className="text-accent" />
          <h2 id="edit-customer-title" className="text-headline-md text-ink">
            Edit Customer
          </h2>
        </div>
        <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:text-ink">
          <Icon name="close" size={20} />
        </Link>
      </div>
      <form action={formAction} noValidate className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
        <input type="hidden" name="id" value={customer.id} />
        {state.message ? (
          <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm text-danger-strong">
            {state.message}
          </p>
        ) : null}
        <Field label="Company Name" htmlFor="edit-company" error={err("company")}>
          <Input id="edit-company" name="company" required defaultValue={v.company} {...a11y("company")} autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field label="Service Tier" htmlFor="edit-tier" error={err("tier")}>
            <Select id="edit-tier" name="tier" defaultValue={v.tier}>
              <Options options={tierOptions} />
            </Select>
          </Field>
          <Field label="Status" htmlFor="edit-status" error={err("status")}>
            <Select id="edit-status" name="status" defaultValue={v.status}>
              <Options options={statusOptions} />
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field label="Key Contact" htmlFor="edit-contactName" error={err("contactName")}>
            <Input id="edit-contactName" name="contactName" required defaultValue={v.contactName} {...a11y("contactName")} />
          </Field>
          <Field label="Email Address" htmlFor="edit-contactEmail" error={err("contactEmail")}>
            <Input id="edit-contactEmail" name="contactEmail" type="email" required defaultValue={v.contactEmail} {...a11y("contactEmail")} />
          </Field>
        </div>
        <Field label="Industry" htmlFor="edit-industry" error={err("industry")}>
          <Input id="edit-industry" name="industry" required defaultValue={v.industry} {...a11y("industry")} />
        </Field>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field label="Billing Email" htmlFor="edit-billingEmail" error={err("billingEmail")} hint="Optional. Defaults to the contact email.">
            <Input id="edit-billingEmail" name="billingEmail" type="email" defaultValue={v.billingEmail} {...a11y("billingEmail")} />
          </Field>
          <Field label="Payment Terms" htmlFor="edit-paymentTerms" error={err("paymentTerms")}>
            <Select id="edit-paymentTerms" name="paymentTerms" defaultValue={v.paymentTerms}>
              <Options options={termsOptions} />
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-space-sm pt-space-sm">
          <Link href={closeHref} scroll={false} className={buttonClasses({ variant: "ghost" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
