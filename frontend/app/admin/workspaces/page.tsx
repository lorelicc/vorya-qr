import { redirect } from "next/navigation";

/** Old address (0.3): customers now live under /admin/clients. */
export default function WorkspacesPage() {
  redirect("/admin/clients");
}
