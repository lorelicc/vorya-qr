import { redirect } from "next/navigation";

/** 0.1 URLs (/app/qr/...) now live under a company. */
export default function LegacyQrPage() {
  redirect("/app");
}
