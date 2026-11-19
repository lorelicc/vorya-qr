import type { Metadata } from "next";
import { StylesPage } from "@/components/styles/StylesPage";

export const metadata: Metadata = { title: "Stili" };

export default function Styles() {
  return <StylesPage />;
}
