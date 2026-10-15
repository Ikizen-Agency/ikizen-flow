import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoicesWorkspace, InvoicesWorkspaceSkeleton } from "@/modules/invoices/ui/invoices-workspace";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return (
    <Suspense fallback={<InvoicesWorkspaceSkeleton />}>
      <InvoicesWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
