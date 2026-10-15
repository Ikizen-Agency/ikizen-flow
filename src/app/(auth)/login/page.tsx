import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeNextPath } from "@/modules/auth/domain/redirect";
import { AuthCard, AuthCardSkeleton } from "@/modules/auth/ui/components/auth-card";
import { FormAlert } from "@/modules/auth/ui/components/form-alert";
import { LoginForm } from "@/modules/auth/ui/components/login-form";
import { DEMO_USER } from "@/server/db/seed/data";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  no_workspace: "Your account is not a member of any workspace yet. Ask an owner to invite you.",
};

async function LoginScreen({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const showDemo = process.env.NODE_ENV !== "production";

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your Ikizen Flow workspace."
      footer={
        <>
          New to Ikizen Flow?{" "}
          <Link href="/register" className="text-label-md text-accent hover:underline">
            Create a workspace
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-space-md">
        {error ? <FormAlert message={error} /> : null}
        {showDemo ? (
          <FormAlert tone="info" message={`Demo account (development only): ${DEMO_USER.email} / ${DEMO_USER.password}`} />
        ) : null}
        <LoginForm next={next} />
      </div>
    </AuthCard>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <LoginScreen searchParams={searchParams} />
    </Suspense>
  );
}
