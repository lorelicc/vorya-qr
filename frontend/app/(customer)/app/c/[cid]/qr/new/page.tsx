import type { Metadata } from "next";
import { NewQr } from "@/components/qr/wizard/NewQr";

export const metadata: Metadata = { title: "Nuovo QR" };

export default async function NewQrPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const from = Number((await searchParams).from);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nuovo codice QR</h1>
          <p>Quattro passaggi: tipo, contenuto, design, salva e scarica.</p>
        </div>
      </div>
      <NewQr fromId={Number.isSafeInteger(from) && from > 0 ? from : null} />
    </div>
  );
}
