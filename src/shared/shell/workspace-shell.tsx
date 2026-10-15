import type { ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Global app shell: sidebar/rail, topbar, mobile bottom nav and the constrained content canvas. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <Topbar />
      <div className="pt-topbar pb-bottom-nav md:pb-0 md:pl-rail lg:pl-sidebar">
        <main className="mx-auto w-full max-w-canvas px-margin-mobile py-space-lg md:px-space-lg lg:px-margin lg:py-space-xl">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
