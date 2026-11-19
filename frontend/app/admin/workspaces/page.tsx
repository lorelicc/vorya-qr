import type { Metadata } from "next";
import { WorkspaceList } from "@/components/admin/WorkspaceList";

export const metadata: Metadata = { title: "Spazi di lavoro" };

export default function WorkspacesPage() {
  return <WorkspaceList />;
}
