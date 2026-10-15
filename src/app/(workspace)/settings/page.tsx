import type { Metadata } from "next";
import { ComingSoon } from "@/shared/shell/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      icon="settings"
      description="Workspace preferences, members, billing and integrations."
    />
  );
}
