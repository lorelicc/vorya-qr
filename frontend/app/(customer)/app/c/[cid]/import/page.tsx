import type { Metadata } from "next";
import { ImportWizard } from "@/components/import/ImportWizard";

export const metadata: Metadata = { title: "Importa da CSV" };

export default function ImportPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Importa da CSV</h1>
          <p>Crea molti link e QR in una volta, con ZIP dei file e riepilogo degli URL brevi.</p>
        </div>
      </div>
      <ImportWizard />
    </div>
  );
}
