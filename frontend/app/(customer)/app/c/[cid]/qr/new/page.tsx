import type { Metadata } from "next";
import { QrWizard } from "@/components/qr/wizard/QrWizard";

export const metadata: Metadata = { title: "Nuovo QR" };

export default function NewQrPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nuovo codice QR</h1>
          <p>Quattro passaggi: tipo, contenuto, design, salva e scarica.</p>
        </div>
      </div>
      <QrWizard />
    </div>
  );
}
