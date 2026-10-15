import type { Metadata } from "next";
import { Suspense } from "react";
import { SalesWorkspace, SalesWorkspaceSkeleton } from "@/modules/sales/ui/sales-workspace";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage({ searchParams }: PageProps<"/sales">) {
  return (
    <Suspense fallback={<SalesWorkspaceSkeleton />}>
      <SalesWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
