import { WorkspaceShell } from "@/shared/shell/workspace-shell";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
