import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/modules/auth/ui/components/auth-card";
import { InviteScreen } from "@/modules/team/ui/invite-screen";

export const metadata: Metadata = { title: "Workspace invitation" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <InviteScreen params={params} />
    </Suspense>
  );
}
