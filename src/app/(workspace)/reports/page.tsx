import type { Metadata } from "next";
import { ComingSoon } from "@/shared/shell/coming-soon";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      icon="bar_chart"
      description="Revenue, utilisation and pipeline reporting across the studio."
    />
  );
}
