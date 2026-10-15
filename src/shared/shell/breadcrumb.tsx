"use client";

import { usePathname } from "next/navigation";
import { pageTitleFor } from "./navigation";

/** "Workspace / <workspace name> / <page>" for the current route. */
export function Breadcrumb({ workspaceName }: { workspaceName: string }) {
  const page = pageTitleFor(usePathname());
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="flex min-w-0 items-center gap-space-sm">
        <li className="text-label-md text-ink-subtle">Workspace</li>
        <li aria-hidden className="text-body-sm text-outline">
          /
        </li>
        <li className={page ? "truncate text-label-md text-ink-muted" : "truncate text-headline-sm text-ink"}>{workspaceName}</li>
        {page ? (
          <>
            <li aria-hidden className="text-body-sm text-outline">
              /
            </li>
            <li aria-current="page" className="truncate text-headline-sm text-ink">
              {page}
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
