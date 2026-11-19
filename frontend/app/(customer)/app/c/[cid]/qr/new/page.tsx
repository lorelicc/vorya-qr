import type { Metadata } from "next";
import { QrEditor } from "@/components/qr/QrEditor";

export const metadata: Metadata = { title: "Nuovo QR" };

export default function NewQrPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nuovo codice QR</h1>
          <p>Scegli il tipo, inserisci l’URL e personalizza l’aspetto.</p>
        </div>
      </div>
      <QrEditor />
    </div>
  );
}
