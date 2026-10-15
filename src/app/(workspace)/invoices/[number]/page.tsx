import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoiceDetailSkeleton, InvoiceDetailView } from "@/modules/invoices/ui/invoice-detail";

export const metadata: Metadata = { title: "Invoice" };

export default function InvoicePage({ params }: PageProps<"/invoices/[number]">) {
  return (
    <Suspense fallback={<InvoiceDetailSkeleton />}>
      <InvoiceDetailView params={params} />
    </Suspense>
  );
}
