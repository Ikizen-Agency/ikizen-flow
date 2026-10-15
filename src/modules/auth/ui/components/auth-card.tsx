import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/shared/shell/logo";

export interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Centered Level 2 card with the Ikizen Flow mark, used by the sign-in and registration pages. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-margin-mobile py-space-xl">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-space-lg flex items-center justify-center gap-space-sm">
          <Logo size={36} />
          <span className="text-headline-sm text-ink">Ikizen Flow</span>
        </Link>
        <section className="rounded-modal border border-line bg-card p-space-lg shadow-level-2 sm:p-space-xl">
          <header className="mb-space-lg space-y-space-xs text-center">
            <h1 className="text-headline-md text-ink">{title}</h1>
            <p className="text-body-sm text-ink-subtle">{description}</p>
          </header>
          {children}
        </section>
        <p className="mt-space-md text-center text-body-sm text-ink-subtle">{footer}</p>
      </div>
    </main>
  );
}

export function AuthCardSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-margin-mobile">
      <div className="h-[460px] w-full max-w-[420px] animate-pulse rounded-modal border border-line bg-card" aria-busy="true" aria-label="Loading" />
    </main>
  );
}
