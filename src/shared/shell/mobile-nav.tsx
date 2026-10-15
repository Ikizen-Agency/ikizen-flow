"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/modules/auth/ui/actions";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import { HELP_ITEM, isActive, NAV_ITEMS } from "./navigation";

const primary = NAV_ITEMS.filter((i) => i.primaryOnMobile);
const secondary = [...NAV_ITEMS.filter((i) => !i.primaryOnMobile), { ...HELP_ITEM, primaryOnMobile: false }];

/** Mobile (< 768px) bottom bar with a "More" sheet for secondary destinations. */
export function MobileNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreActive = secondary.some((i) => isActive(pathname, i.href));

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
      active ? "text-accent" : "text-ink-subtle hover:text-ink",
    );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 flex h-bottom-nav print:hidden border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <Icon name={item.icon} size={22} filled={active} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => setSheetOpen(true)}
          className={itemClass(moreActive)}
        >
          <Icon name="more_horiz" size={22} />
          More
        </button>
      </nav>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-scrim" onClick={() => setSheetOpen(false)} />
          <div
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            className="absolute inset-x-0 bottom-0 rounded-t-modal border border-line bg-card p-space-md pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-level-3"
          >
            <div className="mx-auto mb-space-md h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            <ul className="space-y-space-xs">
              {secondary.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-space-sm rounded-control px-space-sm py-space-sm text-label-md",
                        active ? "bg-accent text-white" : "text-ink-muted hover:bg-well hover:text-ink",
                      )}
                    >
                      <Icon name={item.icon} size={20} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-space-sm rounded-control px-space-sm py-space-sm text-label-md text-ink-muted hover:bg-well hover:text-danger"
                  >
                    <Icon name="logout" size={20} />
                    Log out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
