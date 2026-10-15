import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsPage, SettingsPageSkeleton } from "@/modules/settings/ui/settings-page";

export const metadata: Metadata = { title: "Settings" };

export default function Settings({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPage searchParams={searchParams} />
    </Suspense>
  );
}
