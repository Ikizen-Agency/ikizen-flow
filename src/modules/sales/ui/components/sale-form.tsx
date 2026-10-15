"use client";

import { useActionState, useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { dollarsToCents, formatMoney } from "@/shared/domain/money";
import { formatDate } from "@/shared/domain/time";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { computeOrderTotals, dueDateFor, type OrderCategory, type PaymentTerms } from "../../domain/order";
import { createOrderAction } from "../actions";
import { EARLY_SETTLEMENT_BPS, INITIAL_SALE_FORM_STATE, MAX_LINE_ITEMS } from "../form-schema";

export interface SaleItemDraft {
  title: string;
  description: string;
  quantity: string;
  unit: "unit" | "hours";
  unitRate: string;
}

export interface SaleFormProps {
  customers: ReadonlyArray<{ id: number; company: string; email: string; outstandingCents: number }>;
  categoryOptions: ReadonlyArray<{ value: OrderCategory; label: string }>;
  termsOptions: ReadonlyArray<{ value: PaymentTerms; label: string }>;
  nextReference: string;
  /** Server "now" (ISO) so the due date preview matches the server clock. */
  todayIso: string;
  retainerTemplate: ReadonlyArray<SaleItemDraft>;
  lastOrderItems: ReadonlyArray<SaleItemDraft> | null;
  /** Highlight + focus the form (arrived from the topbar "Create New" shortcut). */
  highlighted?: boolean;
}

type ItemRow = SaleItemDraft & { key: number };

let nextKey = 1;
const withKeys = (items: ReadonlyArray<SaleItemDraft>): ItemRow[] => items.map((i) => ({ ...i, key: nextKey++ }));
const EMPTY_ITEM: SaleItemDraft = { title: "", description: "", quantity: "1", unit: "unit", unitRate: "" };

function safeCents(value: string): number {
  try {
    return Math.max(0, dollarsToCents(value));
  } catch {
    return 0;
  }
}

function safeQuantity(value: string): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

const fieldShell = "flex h-11 items-center gap-space-sm rounded-control border border-line bg-card px-3 focus-within:border-accent focus-within:shadow-focus";
const label = "text-label-md text-ink-muted";

function Step({ n, text, state }: { n: number; text: string; state: "done" | "current" | "todo" }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
          state === "todo" ? "text-ink-subtle" : "bg-accent text-white",
        )}
      >
        {state === "done" ? <Icon name="check" size={12} /> : n}
      </span>
      <span className={cn("text-label-sm", state === "todo" ? "text-ink-subtle" : "text-accent")}>{text}</span>
    </li>
  );
}

/** "Create New Sale" work-order composer: terms, deliverable breakdown, live totals, draft or confirm. */
export function SaleForm(props: SaleFormProps) {
  const { customers, categoryOptions, termsOptions } = props;
  const [state, formAction, pending] = useActionState(createOrderAction, INITIAL_SALE_FORM_STATE);
  const [customerId, setCustomerId] = useState("");
  const [terms, setTerms] = useState<PaymentTerms>(termsOptions[0]?.value ?? "net_30");
  const [category, setCategory] = useState<OrderCategory>(categoryOptions[0]?.value ?? "custom_software");
  const [earlySettlement, setEarlySettlement] = useState(true);
  const [items, setItems] = useState<ItemRow[]>(() => withKeys(props.retainerTemplate));

  const customer = customers.find((c) => String(c.id) === customerId);
  const priced = items.map((i) => ({ quantity: safeQuantity(i.quantity), unitRateCents: safeCents(i.unitRate) }));
  const totals = computeOrderTotals(priced, { discountBps: earlySettlement ? EARLY_SETTLEMENT_BPS : 0 });
  const dueDate = useMemo(() => dueDateFor(new Date(props.todayIso), terms), [props.todayIso, terms]);
  const validItems = items.length > 0 && items.every((i, idx) => i.title.trim() && priced[idx]!.quantity > 0 && priced[idx]!.unitRateCents > 0);
  const itemsPayload = JSON.stringify(items.map(({ title, description, quantity, unit, unitRate }) => ({ title, description, quantity, unit, unitRate })));

  const update = (key: number, patch: Partial<SaleItemDraft>) => setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const reset = () => {
    setCustomerId("");
    setTerms(termsOptions[0]?.value ?? "net_30");
    setCategory(categoryOptions[0]?.value ?? "custom_software");
    setEarlySettlement(true);
    setItems(withKeys([EMPTY_ITEM]));
  };

  return (
    <Card
      id="create-sale"
      className={cn("flex flex-col gap-space-lg scroll-mt-24", props.highlighted && "ring-2 ring-accent/40")}
      aria-labelledby="create-sale-title"
    >
      <div className="flex flex-col gap-space-md sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-space-sm">
            <h2 id="create-sale-title" className="text-headline-md text-ink">
              Create New Sale
            </h2>
            <Badge tone="info">Work Order</Badge>
          </div>
          <p className="mt-1 max-w-sm text-body-sm text-ink-subtle">Author commercial commitments and produce dispatch-ready invoices.</p>
        </div>
        <ol aria-label="Progress" className="flex items-center gap-space-sm rounded-control bg-surface-container-low px-space-sm py-1.5">
          <Step n={1} text="Terms" state={customer ? "done" : "current"} />
          <Icon name="chevron_right" size={14} className="text-ink-subtle" />
          <Step n={2} text="Items" state={validItems ? "done" : customer ? "current" : "todo"} />
          <Icon name="chevron_right" size={14} className="text-ink-subtle" />
          <Step n={3} text="Issue" state={customer && validItems ? "current" : "todo"} />
        </ol>
      </div>

      <form action={formAction} className="flex flex-col gap-space-lg">
        {state.message ? (
          <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm text-danger-strong">
            {state.message}
          </p>
        ) : null}
        <input type="hidden" name="items" value={itemsPayload} />
        {earlySettlement ? <input type="hidden" name="earlySettlement" value="on" /> : null}

        <fieldset className="grid grid-cols-1 gap-space-md rounded-card bg-surface-container-low p-space-md sm:grid-cols-[1.6fr_1fr]">
          <legend className="sr-only">Terms</legend>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="customerId" className={label}>
                Client Account
              </label>
              {customer ? (
                <Badge tone={customer.outstandingCents > 0 ? "warning" : "success"} dot>
                  {formatMoney(customer.outstandingCents)} Outstanding Balance
                </Badge>
              ) : null}
            </div>
            <div className={fieldShell}>
              <Icon name="domain" size={18} className="text-ink-subtle" />
              <select
                id="customerId"
                name="customerId"
                required
                autoFocus={props.highlighted}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                aria-invalid={state.fieldErrors?.customerId ? true : undefined}
                className="h-full w-full min-w-0 cursor-pointer bg-transparent text-body-md text-ink focus:outline-none"
              >
                <option value="">Select a client account...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            {state.fieldErrors?.customerId ? <p className="text-body-sm text-danger-strong">{state.fieldErrors.customerId[0]}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reference" className={label}>
              Order Reference
            </label>
            <div className={cn(fieldShell, "bg-surface-container")}>
              <input
                id="reference"
                readOnly
                value={`#${props.nextReference}`}
                title="Assigned automatically when the order is saved"
                className="tabular w-full min-w-0 bg-transparent text-body-md text-ink focus:outline-none"
              />
              <Icon name="lock" size={16} className="text-ink-subtle" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="paymentTerms" className={label}>
              Payment Schedule
            </label>
            <div className={fieldShell}>
              <Icon name="event_note" size={18} className="text-ink-subtle" />
              <select
                id="paymentTerms"
                name="paymentTerms"
                value={terms}
                onChange={(e) => setTerms(e.target.value as PaymentTerms)}
                className="h-full w-full min-w-0 cursor-pointer bg-transparent text-body-md text-ink focus:outline-none"
              >
                {termsOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Maturity / Due Date</span>
            <div className={cn(fieldShell, "bg-card")} aria-live="polite">
              <Icon name="calendar_today" size={18} className="text-ink-subtle" />
              <span className="text-body-md text-ink">{formatDate(dueDate)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="category" className={label}>
              Service Category
            </label>
            <div className={fieldShell}>
              <Icon name="category" size={18} className="text-ink-subtle" />
              <select
                id="category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as OrderCategory)}
                className="h-full w-full min-w-0 cursor-pointer bg-transparent text-body-md text-ink focus:outline-none"
              >
                {categoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <section aria-labelledby="deliverables-title" className="flex flex-col gap-space-md">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <h3 id="deliverables-title" className="text-headline-sm text-ink">
              Deliverable Breakdown
            </h3>
            <div className="flex items-center gap-space-xs">
              <Button size="sm" variant="ghost" icon="bolt" className="bg-surface-container-low" onClick={() => setItems(withKeys(props.retainerTemplate))}>
                Retainer Template
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon="history"
                className="bg-surface-container-low"
                disabled={!props.lastOrderItems?.length}
                onClick={() => props.lastOrderItems && setItems(withKeys(props.lastOrderItems))}
              >
                Clone Last
              </Button>
            </div>
          </div>
          {state.fieldErrors?.items ? <p className="text-body-sm text-danger-strong">{state.fieldErrors.items[0]}</p> : null}

          {items.map((item, idx) => {
            const lineTotal = priced[idx]!.quantity * priced[idx]!.unitRateCents;
            const n = idx + 1;
            return (
              <div key={item.key} className="flex flex-col gap-space-sm rounded-card border border-line bg-card p-space-md shadow-level-1">
                <div className="flex items-start gap-space-sm">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <input
                      aria-label={`Work item ${n} title`}
                      placeholder="Work item title"
                      value={item.title}
                      onChange={(e) => update(item.key, { title: e.target.value })}
                      className="w-full rounded-sm bg-transparent text-headline-sm text-ink placeholder:text-ink-placeholder focus:shadow-focus focus:outline-none"
                    />
                    <input
                      aria-label={`Work item ${n} description`}
                      placeholder="Scope description (optional)"
                      value={item.description}
                      onChange={(e) => update(item.key, { description: e.target.value })}
                      className="w-full rounded-sm bg-transparent text-body-sm text-ink-muted placeholder:text-ink-placeholder focus:shadow-focus focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    title="Remove line item"
                    aria-label={`Remove work item ${n}`}
                    disabled={items.length === 1}
                    onClick={() => setItems((rows) => rows.filter((r) => r.key !== item.key))}
                    className="rounded-control p-1 text-ink-subtle hover:bg-danger-tint hover:text-danger disabled:opacity-40"
                  >
                    <Icon name="delete" size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 items-end gap-space-sm rounded-control bg-surface-container-low p-space-sm sm:grid-cols-[1fr_1.2fr_0.5fr_1fr]">
                  <label className="flex flex-col gap-1">
                    <span className="text-label-sm text-ink-subtle">Quantity</span>
                    <span className="flex h-9 items-center rounded-control bg-card pr-1">
                      <input
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => update(item.key, { quantity: e.target.value })}
                        className="tabular w-full min-w-0 bg-transparent px-2 text-center text-body-md text-ink focus:outline-none"
                      />
                      <select
                        aria-label={`Work item ${n} unit`}
                        value={item.unit}
                        onChange={(e) => update(item.key, { unit: e.target.value as SaleItemDraft["unit"] })}
                        className="bg-transparent text-body-sm text-ink-subtle focus:outline-none"
                      >
                        <option value="unit">unit</option>
                        <option value="hours">hrs</option>
                      </select>
                    </span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-label-sm text-ink-subtle">Unit Rate</span>
                    <span className="flex h-9 items-center rounded-control bg-card px-2">
                      <span className="text-body-md text-ink-subtle">$</span>
                      <input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.unitRate}
                        onChange={(e) => update(item.key, { unitRate: e.target.value })}
                        className="tabular w-full min-w-0 bg-transparent text-right text-body-md text-ink focus:outline-none"
                      />
                    </span>
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-label-sm text-ink-subtle">Tax</span>
                    <span className="flex h-9 items-center text-body-sm text-ink-subtle">0%</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-label-sm text-ink-subtle">Item Total</span>
                    <span className="tabular flex h-9 items-center justify-end text-headline-sm text-ink">{formatMoney(lineTotal)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            disabled={items.length >= MAX_LINE_ITEMS}
            onClick={() => setItems((rows) => [...rows, ...withKeys([EMPTY_ITEM])])}
            className="flex h-11 items-center justify-center gap-space-sm rounded-card bg-surface-container-low text-label-md text-accent transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <Icon name="add_circle" size={18} />
            Add Work Item
          </button>
        </section>

        <section aria-label="Totals" className="flex flex-col gap-space-sm rounded-card bg-surface-container-low p-space-lg">
          <div className="flex justify-between text-body-md text-ink-muted">
            <span>Subtotal</span>
            <span className="tabular">{formatMoney(totals.subtotalCents)}</span>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-space-sm text-body-md text-success-strong">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={earlySettlement}
                onChange={(e) => setEarlySettlement(e.target.checked)}
                className="size-4 accent-success"
              />
              <Icon name="percent" size={16} />
              Early Settlement Incentive ({EARLY_SETTLEMENT_BPS / 100}%)
            </span>
            <span className="tabular">-{formatMoney(totals.discountCents)}</span>
          </label>
          <div className="flex justify-between text-body-md text-ink-muted">
            <span>Applicable Tax (0% B2B Professional Services)</span>
            <span className="tabular">{formatMoney(totals.taxCents)}</span>
          </div>
          <div className="mt-space-sm flex flex-wrap items-end justify-between gap-space-sm border-t border-line pt-space-md">
            <div>
              <p className="text-headline-sm text-ink">Total Authorized Amount</p>
              <p className="text-body-sm text-ink-subtle">USD Currency · Wire or Automated Clearing House</p>
            </div>
            <p className="tabular text-display-lg text-accent">{formatMoney(totals.totalCents)}</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <Button variant="ghost" size="lg" className="bg-surface-container-low" onClick={reset} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" name="intent" value="draft" variant="ghost" size="lg" icon="bookmark" className="bg-surface-container-low" disabled={pending}>
              Save Draft
            </Button>
          </div>
          <Button type="submit" name="intent" value="confirm" size="lg" trailingIcon="arrow_forward" disabled={pending || !customer || !validItems}>
            {pending ? "Saving..." : "Confirm & Create Invoice"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
