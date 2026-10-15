import type { Metadata } from "next";
import { ComingSoon } from "@/shared/shell/coming-soon";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <ComingSoon
      title="Invoices"
      icon="receipt_long"
      description="Issue, track and reconcile client invoices and settlements."
    />
  );
}
