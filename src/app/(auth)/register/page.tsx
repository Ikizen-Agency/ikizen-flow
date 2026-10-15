import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeNextPath } from "@/modules/auth/domain/redirect";
import { AuthCard, AuthCardSkeleton } from "@/modules/auth/ui/components/auth-card";
import { RegisterForm } from "@/modules/auth/ui/components/register-form";

export const metadata: Metadata = { title: "Create account" };

async function RegisterScreen({ searchParams }: { searchParams: PageProps<"/register">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const invited = next.startsWith("/invite/");
  return (
    <AuthCard
      title={invited ? "Create your account" : "Create your workspace"}
      description={
        invited
          ? "Use the email address the invitation was sent to. You also get a workspace of your own."
          : "Set up Ikizen Flow for your team in under a minute."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="text-label-md text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <RegisterScreen searchParams={searchParams} />
    </Suspense>
  );
}
