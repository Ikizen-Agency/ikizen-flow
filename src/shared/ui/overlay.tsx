"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface OverlayProps {
  /** URL to navigate to when the overlay is dismissed (scrim click, Escape). */
  closeHref: string;
  /** "modal" is centered; "drawer" slides in from the right edge. */
  variant?: "modal" | "drawer";
  /** id of the element that names the dialog. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Level 3 surface with a scrim, driven by the URL: render it when a search param is present and
 * dismiss it by navigating to `closeHref`. Keeps deep links (`?create=1`, `?customer=12`) working.
 */
export function Overlay({ closeHref, variant = "modal", labelledBy, className, children }: OverlayProps) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.replace(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [closeHref, router]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex bg-scrim backdrop-blur-sm",
        variant === "modal" ? "items-center justify-center p-space-md" : "justify-end",
      )}
      onClick={() => router.replace(closeHref, { scroll: false })}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex flex-col overflow-hidden bg-card shadow-level-3 outline-none",
          variant === "modal"
            ? "max-h-[calc(100vh-2rem)] w-full max-w-lg rounded-modal"
            : "h-full w-full max-w-lg overflow-y-auto",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
