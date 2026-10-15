import type { Metadata } from "next";
import { Suspense } from "react";
import { TasksWorkspace, TasksWorkspaceSkeleton } from "@/modules/tasks/ui/tasks-workspace";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <Suspense fallback={<TasksWorkspaceSkeleton />}>
      <TasksWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
