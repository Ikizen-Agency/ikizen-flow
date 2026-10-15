import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpCenter, HelpCenterSkeleton } from "@/modules/help/ui/help-center";

export const metadata: Metadata = { title: "Help & Support" };

export default function HelpPage() {
  return (
    <Suspense fallback={<HelpCenterSkeleton />}>
      <HelpCenter />
    </Suspense>
  );
}
