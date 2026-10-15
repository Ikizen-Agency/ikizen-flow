import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/modules/auth/ui/components/auth-card";
import { RegisterForm } from "@/modules/auth/ui/components/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your workspace"
      description="Set up Ikizen Flow for your team in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-label-md text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
