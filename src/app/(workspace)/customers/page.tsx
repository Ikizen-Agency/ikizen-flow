import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersDirectory, CustomersDirectorySkeleton } from "@/modules/customers/ui/customers-directory";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <Suspense fallback={<CustomersDirectorySkeleton />}>
      <CustomersDirectory searchParams={searchParams} />
    </Suspense>
  );
}
