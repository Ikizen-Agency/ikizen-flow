import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "./icon";

const control =
  "w-full rounded-control border border-line-strong bg-card px-3 text-body-md text-ink transition-shadow " +
  "focus:border-accent focus:shadow-focus focus:outline-none " +
  "aria-[invalid=true]:border-danger disabled:bg-well disabled:text-ink-subtle";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Leading Material Symbol, e.g. "search". */
  icon?: string;
}

export function Input({ icon, className, ...rest }: InputProps) {
  if (!icon) return <input className={cn(control, "h-[38px] py-2", className)} {...rest} />;
  return (
    <div className="relative flex items-center">
      <Icon name={icon} size={18} className="pointer-events-none absolute left-3 text-ink-placeholder" />
      <input className={cn(control, "h-[38px] py-2 pl-9", className)} {...rest} />
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-[38px] py-2 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...rest} />;
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error message, wired for accessibility by `htmlFor`. */
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-label-md text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-body-sm text-danger-strong">
          {error}
        </p>
      ) : hint ? (
        <p className="text-body-sm text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
